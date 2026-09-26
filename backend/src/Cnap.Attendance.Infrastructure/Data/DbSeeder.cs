using System.Security.Cryptography;
using System.Text;
using Cnap.Attendance.Core.Common;
using Cnap.Attendance.Core.Entities;
using Cnap.Attendance.Infrastructure.Email;
using Cnap.Attendance.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Cnap.Attendance.Infrastructure.Data;

public class SeedOptions
{
    public const string Section = "Seed";

    public string? AdminEmail { get; set; }
    public string? AdminMotDePasse { get; set; }
    public string AdminNom { get; set; } = "Administrateur";

    /// <summary>
    /// Force le compte AdminEmail : mot de passe AdminMotDePasse, compte réactivé et déverrouillé, rôle Administrateur.
    /// Appliqué une seule fois par couple email/mot de passe : un redémarrage avec la même valeur ne réécrase pas
    /// le mot de passe choisi ensuite par l'administrateur.
    /// </summary>
    public bool ReinitialiserAdmin { get; set; }

    /// <summary>Crée un club, un séminaire actif et une session active si les tables sont vides.</summary>
    public bool DonneesDemo { get; set; } = true;
}

/// <summary>Configuration SMTP initiale facultative, reprise en base au premier démarrage uniquement.</summary>
public class SmtpInitialOptions
{
    public const string Section = "Smtp";

    public string? Hote { get; set; }
    public int Port { get; set; } = 587;
    public string? Utilisateur { get; set; }
    public string? MotDePasse { get; set; }
    public string? ExpediteurEmail { get; set; }
    public string ExpediteurNom { get; set; } = "Commission Nationale Apprentissage";
    public bool UtiliserTls { get; set; } = true;
}

public static class DbSeeder
{
    public static async Task SeedAsync(IServiceProvider services, CancellationToken ct = default)
    {
        using var scope = services.CreateScope();
        var sp = scope.ServiceProvider;
        var db = sp.GetRequiredService<AppDbContext>();
        var logger = sp.GetRequiredService<ILoggerFactory>().CreateLogger("DbSeeder");
        var options = sp.GetRequiredService<IOptions<SeedOptions>>().Value;
        var maintenant = DateTimeOffset.UtcNow;

        var roleManager = sp.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
        foreach (var role in Roles.Tous)
            if (!await roleManager.RoleExistsAsync(role))
                await roleManager.CreateAsync(new IdentityRole<Guid>(role) { Id = Guid.NewGuid() });

        await InitialiserAdministrateurAsync(sp, db, options, logger, maintenant, ct);

        if (options.DonneesDemo)
        {
            if (!await db.Clubs.AnyAsync(ct))
                db.Clubs.Add(new Club { Code = "DEMO", Nom = "Club de démonstration", EstActif = true });

            if (!await db.Seminaires.AnyAsync(ct))
            {
                var seminaire = new Seminaire
                {
                    Id = Guid.NewGuid(),
                    Designation = "Séminaire Effectif D9101",
                    Description = "Samedi 26 septembre 2026 – Capitol Hotel",
                    EstActif = true,
                    CreatedAt = maintenant,
                    UpdatedAt = maintenant
                };
                db.Seminaires.Add(seminaire);
                db.Sessions.Add(new Session
                {
                    Id = Guid.NewGuid(),
                    SeminaireId = seminaire.Id,
                    Designation = "Session plénière",
                    HeureDebut = new DateTimeOffset(2026, 9, 26, 8, 0, 0, TimeSpan.Zero),
                    HeureFin = new DateTimeOffset(2026, 9, 26, 17, 0, 0, TimeSpan.Zero),
                    EstActif = true,
                    CreatedAt = maintenant,
                    UpdatedAt = maintenant
                });
            }
        }

        var smtp = sp.GetRequiredService<IOptions<SmtpInitialOptions>>().Value;
        if (!string.IsNullOrWhiteSpace(smtp.Hote) && !string.IsNullOrWhiteSpace(smtp.ExpediteurEmail) && !await db.ParametresSmtp.AnyAsync(ct))
        {
            var protector = sp.GetRequiredService<SmtpSecretProtector>();
            db.ParametresSmtp.Add(new ParametresSmtp
            {
                Id = ParametresSmtp.IdUnique,
                Hote = smtp.Hote,
                Port = smtp.Port,
                Utilisateur = string.IsNullOrWhiteSpace(smtp.Utilisateur) ? null : smtp.Utilisateur,
                MotDePasseChiffre = string.IsNullOrEmpty(smtp.MotDePasse) ? null : protector.Chiffrer(smtp.MotDePasse),
                ExpediteurEmail = smtp.ExpediteurEmail,
                ExpediteurNom = smtp.ExpediteurNom,
                UtiliserTls = smtp.UtiliserTls,
                EstActif = true,
                UpdatedAt = maintenant
            });
            logger.LogInformation("Configuration SMTP initiale importée depuis les variables d'environnement.");
        }

        await db.SaveChangesAsync(ct);
    }
    private const string FournisseurJeton = "Seed";
    private const string NomJetonReinitialisation = "ReinitialisationAdmin";

    private static async Task InitialiserAdministrateurAsync(
        IServiceProvider sp, AppDbContext db, SeedOptions options, ILogger logger, DateTimeOffset maintenant, CancellationToken ct)
    {
        var userManager = sp.GetRequiredService<UserManager<ApplicationUser>>();
        var email = options.AdminEmail?.Trim().ToLowerInvariant();
        var motDePasse = options.AdminMotDePasse;
        var configure = !string.IsNullOrWhiteSpace(email) && !string.IsNullOrWhiteSpace(motDePasse);

        if (options.ReinitialiserAdmin)
        {
            if (!configure)
            {
                logger.LogWarning("Réinitialisation admin demandée sans Seed__AdminEmail ni Seed__AdminMotDePasse : ignorée.");
                return;
            }
            await ReinitialiserAdministrateurAsync(userManager, db, email!, motDePasse!, options.AdminNom, logger, maintenant, ct);
            return;
        }

        if ((await userManager.GetUsersInRoleAsync(Roles.Administrateur)).Count > 0)
            return;
        if (!configure)
        {
            logger.LogWarning("Aucun administrateur : définissez Seed__AdminEmail et Seed__AdminMotDePasse pour en créer un.");
            return;
        }
        if (await CreerAdministrateurAsync(userManager, email!, motDePasse!, options.AdminNom, logger, maintenant) is not null)
            logger.LogInformation("Compte administrateur initial créé : {Email}", email);
    }

    private static async Task ReinitialiserAdministrateurAsync(
        UserManager<ApplicationUser> userManager, AppDbContext db, string email, string motDePasse, string nom,
        ILogger logger, DateTimeOffset maintenant, CancellationToken ct)
    {
        var empreinte = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{email}\n{motDePasse}")));
        var admin = await userManager.FindByEmailAsync(email);

        if (admin is not null && await userManager.GetAuthenticationTokenAsync(admin, FournisseurJeton, NomJetonReinitialisation) == empreinte)
        {
            logger.LogWarning("Réinitialisation de {Email} déjà appliquée pour ce mot de passe : rien à faire. " +
                "Repassez ADMIN_RESET à false (ou changez ADMIN_PASSWORD pour réinitialiser à nouveau).", email);
            return;
        }

        if (admin is null)
        {
            admin = await CreerAdministrateurAsync(userManager, email, motDePasse, nom, logger, maintenant);
            if (admin is null) return;
        }
        else
        {
            var jeton = await userManager.GeneratePasswordResetTokenAsync(admin);
            var resultat = await userManager.ResetPasswordAsync(admin, jeton, motDePasse);
            if (!resultat.Succeeded)
            {
                logger.LogError("Réinitialisation de {Email} impossible : {Erreurs}", email, string.Join(" ", resultat.Errors.Select(e => e.Description)));
                return;
            }
            admin.EstActif = true;
            admin.DoitChangerMotDePasse = true;
            admin.LockoutEnd = null;
            admin.AccessFailedCount = 0;
            await userManager.UpdateAsync(admin);

            var roles = await userManager.GetRolesAsync(admin);
            if (!roles.Contains(Roles.Administrateur))
            {
                await userManager.RemoveFromRolesAsync(admin, roles);
                await userManager.AddToRoleAsync(admin, Roles.Administrateur);
            }

            // Ferme toutes les sessions ouvertes avec l'ancien mot de passe.
            await db.RefreshTokens.Where(t => t.UserId == admin.Id && t.RevokedAt == null)
                .ExecuteUpdateAsync(x => x.SetProperty(t => t.RevokedAt, maintenant), ct);
        }

        await userManager.SetAuthenticationTokenAsync(admin, FournisseurJeton, NomJetonReinitialisation, empreinte);
        logger.LogWarning("Compte administrateur {Email} réinitialisé depuis les variables d'environnement " +
            "(mot de passe à changer à la prochaine connexion). Repassez ADMIN_RESET à false.", email);
    }

    private static async Task<ApplicationUser?> CreerAdministrateurAsync(
        UserManager<ApplicationUser> userManager, string email, string motDePasse, string nom, ILogger logger, DateTimeOffset maintenant)
    {
        var admin = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            NomComplet = nom,
            EstActif = true,
            DoitChangerMotDePasse = true,
            CreatedAt = maintenant
        };
        var resultat = await userManager.CreateAsync(admin, motDePasse);
        if (!resultat.Succeeded)
        {
            logger.LogError("Création de l'administrateur {Email} impossible : {Erreurs}", email, string.Join(" ", resultat.Errors.Select(e => e.Description)));
            return null;
        }
        await userManager.AddToRoleAsync(admin, Roles.Administrateur);
        return admin;
    }
}
