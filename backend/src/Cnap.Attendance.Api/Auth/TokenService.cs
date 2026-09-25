using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Cnap.Attendance.Core.Entities;
using Cnap.Attendance.Infrastructure.Data;
using Cnap.Attendance.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Cnap.Attendance.Api.Auth;

public class JwtOptions
{
    public const string Section = "Jwt";

    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = "cnap-attendance";
    public string Audience { get; set; } = "cnap-attendance";
    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 7;
    /// <summary>Cookies « Secure » : à laisser à true derrière Cloudflare (HTTPS).</summary>
    public bool CookieSecure { get; set; } = true;
}

public static class Claims
{
    public const string DoitChangerMotDePasse = "mdp_a_changer";
}

public record JetonsEmis(string AccessToken, DateTimeOffset AccessExpire, string RefreshToken, DateTimeOffset RefreshExpire);

public class TokenService(AppDbContext db, IOptions<JwtOptions> options, TimeProvider horloge)
{
    private readonly JwtOptions _options = options.Value;

    public async Task<JetonsEmis> EmettreAsync(ApplicationUser utilisateur, string role, CancellationToken ct)
    {
        var maintenant = horloge.GetUtcNow();
        var (refresh, entite) = NouveauRefreshToken(utilisateur.Id, maintenant);
        db.RefreshTokens.Add(entite);
        await db.SaveChangesAsync(ct);
        return Construire(utilisateur, role, maintenant, refresh, entite.ExpiresAt);
    }

    /// <summary>Rotation : l'ancien refresh token est révoqué et remplacé. Null si invalide.</summary>
    public async Task<(JetonsEmis Jetons, Guid UserId)?> RafraichirAsync(string refreshToken, Func<Guid, Task<(ApplicationUser, string)?>> chargerUtilisateur, CancellationToken ct)
    {
        var maintenant = horloge.GetUtcNow();
        var hash = Hacher(refreshToken);
        var existant = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (existant is null) return null;

        if (existant.RevokedAt is not null)
        {
            // Réutilisation d'un jeton déjà tourné : possible vol, on révoque toute la famille.
            if (existant.ReplacedById is not null)
                await RevoquerToutAsync(existant.UserId, ct);
            return null;
        }
        if (!existant.EstValide(maintenant)) return null;

        var utilisateur = await chargerUtilisateur(existant.UserId);
        if (utilisateur is null) return null;

        var (nouveau, entite) = NouveauRefreshToken(existant.UserId, maintenant);
        existant.RevokedAt = maintenant;
        existant.ReplacedById = entite.Id;
        db.RefreshTokens.Add(entite);
        await db.SaveChangesAsync(ct);

        var (user, role) = utilisateur.Value;
        return (Construire(user, role, maintenant, nouveau, entite.ExpiresAt), existant.UserId);
    }

    public async Task RevoquerAsync(string refreshToken, CancellationToken ct)
    {
        var hash = Hacher(refreshToken);
        var maintenant = horloge.GetUtcNow();
        await db.RefreshTokens.Where(t => t.TokenHash == hash && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, maintenant), ct);
    }

    public async Task RevoquerToutAsync(Guid userId, CancellationToken ct)
    {
        var maintenant = horloge.GetUtcNow();
        await db.RefreshTokens.Where(t => t.UserId == userId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, maintenant), ct);
    }

    private JetonsEmis Construire(ApplicationUser utilisateur, string role, DateTimeOffset maintenant, string refresh, DateTimeOffset refreshExpire)
    {
        var accessExpire = maintenant.AddMinutes(_options.AccessTokenMinutes);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, utilisateur.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, utilisateur.Email ?? string.Empty),
            new(JwtRegisteredClaimNames.Name, utilisateur.NomComplet),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(ClaimTypes.Role, role),
            new(Claims.DoitChangerMotDePasse, utilisateur.DoitChangerMotDePasse ? "true" : "false")
        };
        var cle = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Secret));
        var jeton = new JwtSecurityToken(
            _options.Issuer, _options.Audience, claims,
            notBefore: maintenant.UtcDateTime,
            expires: accessExpire.UtcDateTime,
            signingCredentials: new SigningCredentials(cle, SecurityAlgorithms.HmacSha256));
        return new JetonsEmis(new JwtSecurityTokenHandler().WriteToken(jeton), accessExpire, refresh, refreshExpire);
    }

    private (string Valeur, RefreshToken Entite) NouveauRefreshToken(Guid userId, DateTimeOffset maintenant)
    {
        var valeur = Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(64));
        return (valeur, new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TokenHash = Hacher(valeur),
            CreatedAt = maintenant,
            ExpiresAt = maintenant.AddDays(_options.RefreshTokenDays)
        });
    }

    private static string Hacher(string valeur) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(valeur)));
}
