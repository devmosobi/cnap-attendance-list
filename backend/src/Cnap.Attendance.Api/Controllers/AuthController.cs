using Cnap.Attendance.Api.Auth;
using Cnap.Attendance.Api.Infrastructure;
using Cnap.Attendance.Core.Dtos;
using Cnap.Attendance.Infrastructure.Identity;
using Cnap.Attendance.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Cnap.Attendance.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(UserManager<ApplicationUser> users, TokenService tokens, AuthCookies cookies) : ControllerBase
{
    private const string MessageEchec = "Email ou mot de passe incorrect.";

    [HttpPost("login")]
    [EnableRateLimiting(Politiques.RateLimitLogin)]
    public async Task<ActionResult<UtilisateurConnecteDto>> Login(LoginRequest requete, CancellationToken ct)
    {
        var utilisateur = await users.FindByEmailAsync(requete.Email.Trim());
        if (utilisateur is null || !utilisateur.EstActif)
            return Echec(StatusCodes.Status401Unauthorized, MessageEchec);

        if (await users.IsLockedOutAsync(utilisateur))
            return Echec(StatusCodes.Status423Locked, "Compte temporairement verrouillé après plusieurs échecs. Réessayez dans 15 minutes.");

        if (!await users.CheckPasswordAsync(utilisateur, requete.MotDePasse))
        {
            await users.AccessFailedAsync(utilisateur);
            return Echec(StatusCodes.Status401Unauthorized, MessageEchec);
        }
        await users.ResetAccessFailedCountAsync(utilisateur);

        return await ConnecterAsync(utilisateur, ct);
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<UtilisateurConnecteDto>> Refresh(CancellationToken ct)
    {
        var refresh = Request.Cookies[AuthCookies.RefreshCookie];
        if (string.IsNullOrEmpty(refresh))
            return Echec(StatusCodes.Status401Unauthorized, "Session expirée.");

        ApplicationUser? charge = null;
        string role = string.Empty;
        var resultat = await tokens.RafraichirAsync(refresh, async userId =>
        {
            charge = await users.FindByIdAsync(userId.ToString());
            if (charge is null || !charge.EstActif) return null;
            role = (await users.GetRolesAsync(charge)).FirstOrDefault() ?? string.Empty;
            return (charge, role);
        }, ct);

        if (resultat is null || charge is null)
        {
            cookies.Supprimer(Response);
            return Echec(StatusCodes.Status401Unauthorized, "Session expirée.");
        }

        cookies.Ecrire(Response, resultat.Value.Jetons);
        return VersDto(charge, role);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        var refresh = Request.Cookies[AuthCookies.RefreshCookie];
        if (!string.IsNullOrEmpty(refresh))
            await tokens.RevoquerAsync(refresh, ct);
        cookies.Supprimer(Response);
        return NoContent();
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UtilisateurConnecteDto>> Me()
    {
        var utilisateur = await users.FindByIdAsync(User.UtilisateurId().ToString());
        if (utilisateur is null || !utilisateur.EstActif)
            return Echec(StatusCodes.Status401Unauthorized, "Session expirée.");
        var role = (await users.GetRolesAsync(utilisateur)).FirstOrDefault() ?? string.Empty;
        return VersDto(utilisateur, role);
    }

    [Authorize]
    [HttpPost("changer-mot-de-passe")]
    public async Task<ActionResult<UtilisateurConnecteDto>> ChangerMotDePasse(ChangerMotDePasseRequest requete, CancellationToken ct)
    {
        var utilisateur = await users.FindByIdAsync(User.UtilisateurId().ToString());
        if (utilisateur is null)
            return Echec(StatusCodes.Status401Unauthorized, "Session expirée.");

        UtilisateurService.Verifier(await users.ChangePasswordAsync(utilisateur, requete.MotDePasseActuel, requete.NouveauMotDePasse));
        utilisateur.DoitChangerMotDePasse = false;
        UtilisateurService.Verifier(await users.UpdateAsync(utilisateur));

        // Les autres sessions ouvertes sont fermées, une nouvelle est émise pour celle-ci.
        await tokens.RevoquerToutAsync(utilisateur.Id, ct);
        return await ConnecterAsync(utilisateur, ct);
    }

    private async Task<ActionResult<UtilisateurConnecteDto>> ConnecterAsync(ApplicationUser utilisateur, CancellationToken ct)
    {
        var role = (await users.GetRolesAsync(utilisateur)).FirstOrDefault() ?? string.Empty;
        cookies.Ecrire(Response, await tokens.EmettreAsync(utilisateur, role, ct));
        return VersDto(utilisateur, role);
    }

    private static UtilisateurConnecteDto VersDto(ApplicationUser u, string role) =>
        new(u.Id, u.Email ?? string.Empty, u.NomComplet, role, u.DoitChangerMotDePasse);

    private ObjectResult Echec(int statut, string message) =>
        StatusCode(statut, new ProblemDetails { Status = statut, Title = "Authentification", Detail = message });
}
