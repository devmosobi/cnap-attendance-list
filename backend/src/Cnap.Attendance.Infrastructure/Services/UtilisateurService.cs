using Cnap.Attendance.Core.Common;
using Cnap.Attendance.Core.Dtos;
using Cnap.Attendance.Infrastructure.Data;
using Cnap.Attendance.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Cnap.Attendance.Infrastructure.Services;

public class UtilisateurService(UserManager<ApplicationUser> users, AppDbContext db, TimeProvider horloge)
{
    public async Task<List<UtilisateurDto>> ListerAsync(CancellationToken ct)
    {
        var roles = await (from ur in db.UserRoles
                           join r in db.Roles on ur.RoleId equals r.Id
                           select new { ur.UserId, r.Name }).ToListAsync(ct);
        var liste = await users.Users.AsNoTracking().OrderBy(u => u.NomComplet).ToListAsync(ct);
        return liste.Select(u => VersDto(u, roles.FirstOrDefault(r => r.UserId == u.Id)?.Name ?? string.Empty)).ToList();
    }

    public async Task<UtilisateurDto> CreerAsync(UtilisateurCreationRequest requete)
    {
        var email = requete.Email.Trim().ToLowerInvariant();
        if (await users.FindByEmailAsync(email) is not null)
            throw new ConflitException("Un compte existe déjà avec cette adresse email.");

        var utilisateur = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            NomComplet = requete.NomComplet.Trim(),
            EstActif = true,
            DoitChangerMotDePasse = true,
            CreatedAt = horloge.GetUtcNow()
        };
        Verifier(await users.CreateAsync(utilisateur, requete.MotDePasse));
        Verifier(await users.AddToRoleAsync(utilisateur, requete.Role));
        return VersDto(utilisateur, requete.Role);
    }

    public async Task<UtilisateurDto> ModifierAsync(Guid id, UtilisateurModificationRequest requete, Guid utilisateurCourant)
    {
        var utilisateur = await Charger(id);
        var roleActuel = (await users.GetRolesAsync(utilisateur)).FirstOrDefault();

        if (id == utilisateurCourant && (!requete.EstActif || requete.Role != Roles.Administrateur))
            throw new RegleMetierException("Vous ne pouvez pas désactiver votre propre compte ni retirer votre rôle Administrateur.");

        utilisateur.NomComplet = requete.NomComplet.Trim();
        utilisateur.EstActif = requete.EstActif;
        Verifier(await users.UpdateAsync(utilisateur));

        if (roleActuel != requete.Role)
        {
            if (roleActuel is not null)
                Verifier(await users.RemoveFromRoleAsync(utilisateur, roleActuel));
            Verifier(await users.AddToRoleAsync(utilisateur, requete.Role));
        }
        if (!requete.EstActif)
            await RevoquerSessionsAsync(id);
        return VersDto(utilisateur, requete.Role);
    }

    public async Task ReinitialiserMotDePasseAsync(Guid id, string nouveauMotDePasse)
    {
        var utilisateur = await Charger(id);
        var jeton = await users.GeneratePasswordResetTokenAsync(utilisateur);
        Verifier(await users.ResetPasswordAsync(utilisateur, jeton, nouveauMotDePasse));
        utilisateur.DoitChangerMotDePasse = true;
        Verifier(await users.UpdateAsync(utilisateur));
        await RevoquerSessionsAsync(id);
    }

    public async Task SupprimerAsync(Guid id, Guid utilisateurCourant)
    {
        if (id == utilisateurCourant)
            throw new RegleMetierException("Vous ne pouvez pas supprimer votre propre compte.");
        var utilisateur = await Charger(id);
        Verifier(await users.DeleteAsync(utilisateur));
    }

    private Task RevoquerSessionsAsync(Guid userId)
    {
        var maintenant = horloge.GetUtcNow();
        return db.RefreshTokens.Where(t => t.UserId == userId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, maintenant));
    }

    private async Task<ApplicationUser> Charger(Guid id) =>
        await users.FindByIdAsync(id.ToString()) ?? throw new IntrouvableException("Utilisateur introuvable.");

    public static void Verifier(IdentityResult resultat)
    {
        if (!resultat.Succeeded)
            throw new RegleMetierException(string.Join(" ", resultat.Errors.Select(e => TraduireErreur(e))));
    }

    private static string TraduireErreur(IdentityError e) => e.Code switch
    {
        nameof(IdentityErrorDescriber.PasswordTooShort) => "Le mot de passe est trop court (8 caractères minimum).",
        nameof(IdentityErrorDescriber.PasswordRequiresDigit) => "Le mot de passe doit contenir au moins un chiffre.",
        nameof(IdentityErrorDescriber.PasswordRequiresLower) => "Le mot de passe doit contenir au moins une minuscule.",
        nameof(IdentityErrorDescriber.PasswordRequiresUpper) => "Le mot de passe doit contenir au moins une majuscule.",
        nameof(IdentityErrorDescriber.PasswordRequiresNonAlphanumeric) => "Le mot de passe doit contenir au moins un caractère spécial.",
        nameof(IdentityErrorDescriber.PasswordMismatch) => "Mot de passe actuel incorrect.",
        nameof(IdentityErrorDescriber.DuplicateUserName) or nameof(IdentityErrorDescriber.DuplicateEmail) => "Un compte existe déjà avec cette adresse email.",
        _ => e.Description
    };

    private static UtilisateurDto VersDto(ApplicationUser u, string role) =>
        new(u.Id, u.Email ?? string.Empty, u.NomComplet, role, u.EstActif, u.DoitChangerMotDePasse);
}
