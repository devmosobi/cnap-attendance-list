using Cnap.Attendance.Core.Common;
using Cnap.Attendance.Core.Dtos;
using Cnap.Attendance.Core.Entities;
using Cnap.Attendance.Infrastructure.Data;
using Cnap.Attendance.Infrastructure.Email;
using Microsoft.EntityFrameworkCore;

namespace Cnap.Attendance.Infrastructure.Services;

public class ParametresSmtpService(AppDbContext db, SmtpSecretProtector secrets, SmtpEmailSender sender, TimeProvider horloge)
{
    public async Task<ParametresSmtpDto?> ObtenirAsync(CancellationToken ct)
    {
        var p = await db.ParametresSmtp.AsNoTracking().FirstOrDefaultAsync(x => x.Id == ParametresSmtp.IdUnique, ct);
        return p is null ? null : VersDto(p);
    }

    public async Task<ParametresSmtpDto> EnregistrerAsync(ParametresSmtpRequest requete, CancellationToken ct)
    {
        var p = await db.ParametresSmtp.FirstOrDefaultAsync(x => x.Id == ParametresSmtp.IdUnique, ct);
        if (p is null)
        {
            p = new ParametresSmtp { Id = ParametresSmtp.IdUnique };
            db.ParametresSmtp.Add(p);
        }

        p.Hote = requete.Hote.Trim();
        p.Port = requete.Port;
        p.Utilisateur = string.IsNullOrWhiteSpace(requete.Utilisateur) ? null : requete.Utilisateur.Trim();
        if (!string.IsNullOrEmpty(requete.MotDePasse))
            p.MotDePasseChiffre = secrets.Chiffrer(requete.MotDePasse);
        if (p.Utilisateur is null)
            p.MotDePasseChiffre = null;
        p.ExpediteurEmail = requete.ExpediteurEmail.Trim();
        p.ExpediteurNom = requete.ExpediteurNom.Trim();
        p.UtiliserTls = requete.UtiliserTls;
        p.EstActif = requete.EstActif;
        p.UpdatedAt = horloge.GetUtcNow();

        await db.SaveChangesAsync(ct);
        return VersDto(p);
    }

    /// <summary>Envoi direct (hors file d'attente) pour valider la configuration ; renvoie l'erreur SMTP le cas échéant.</summary>
    public async Task EnvoyerTestAsync(string destinataire, CancellationToken ct)
    {
        var p = await db.ParametresSmtp.AsNoTracking().FirstOrDefaultAsync(x => x.Id == ParametresSmtp.IdUnique, ct)
            ?? throw new RegleMetierException("Enregistrez d'abord la configuration SMTP.");
        var (sujet, corps) = EmailTemplates.Test();
        try
        {
            await sender.EnvoyerAsync(p, destinataire, null, sujet, corps, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            throw new RegleMetierException($"Échec de l'envoi : {ex.Message}");
        }
    }

    public async Task<FileEmailStatsDto> StatistiquesFileAsync(CancellationToken ct)
    {
        var compte = await db.EmailOutbox.AsNoTracking()
            .GroupBy(m => m.Statut)
            .Select(g => new { g.Key, Nombre = g.Count() })
            .ToListAsync(ct);
        var derniereErreur = await db.EmailOutbox.AsNoTracking()
            .Where(m => m.DerniereErreur != null && m.Statut != EmailStatut.Envoye)
            .OrderByDescending(m => m.ProchaineTentativeAt)
            .Select(m => m.DerniereErreur)
            .FirstOrDefaultAsync(ct);
        int Nb(EmailStatut s) => compte.FirstOrDefault(c => c.Key == s)?.Nombre ?? 0;
        return new FileEmailStatsDto(Nb(EmailStatut.EnAttente), Nb(EmailStatut.Envoye), Nb(EmailStatut.Echec), derniereErreur);
    }

    /// <summary>Remet en file les emails définitivement en échec.</summary>
    public Task<int> RelancerEchecsAsync(CancellationToken ct)
    {
        var maintenant = horloge.GetUtcNow();
        return db.EmailOutbox
            .Where(m => m.Statut == EmailStatut.Echec)
            .ExecuteUpdateAsync(s => s
                .SetProperty(m => m.Statut, EmailStatut.EnAttente)
                .SetProperty(m => m.Tentatives, 0)
                .SetProperty(m => m.ProchaineTentativeAt, maintenant), ct);
    }

    private static ParametresSmtpDto VersDto(ParametresSmtp p) =>
        new(p.Hote, p.Port, p.Utilisateur, p.MotDePasseChiffre is not null, p.ExpediteurEmail, p.ExpediteurNom, p.UtiliserTls, p.EstActif);
}
