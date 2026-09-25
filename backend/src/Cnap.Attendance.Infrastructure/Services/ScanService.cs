using System.Text.RegularExpressions;
using Cnap.Attendance.Core.Common;
using Cnap.Attendance.Core.Dtos;
using Cnap.Attendance.Core.Entities;
using Cnap.Attendance.Infrastructure.Data;
using Cnap.Attendance.Infrastructure.Email;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Cnap.Attendance.Infrastructure.Services;

/// <summary>Flux public : lecture de l'état d'un billet et validation de présence.</summary>
public partial class ScanService(AppDbContext db, TimeProvider horloge, ILogger<ScanService> logger)
{
    public const string MessageCodeInvalide = "Code invalide.";

    public async Task<ScanEtatDto> ObtenirEtatAsync(string codeBrut, CancellationToken ct)
    {
        var code = CodeQr.Normaliser(codeBrut) ?? throw new IntrouvableException(MessageCodeInvalide);

        var qr = await db.QrCodes.AsNoTracking()
            .Include(q => q.Club)
            .FirstOrDefaultAsync(q => q.Code == code, ct)
            ?? throw new IntrouvableException(MessageCodeInvalide);

        var seminaires = await ChargerSeminairesOuvertsAsync(ct);

        var clubs = qr.Statut == QrCodeStatut.Inactif
            ? await db.Clubs.AsNoTracking().Where(c => c.EstActif).OrderBy(c => c.Nom)
                .Select(c => new ClubOptionDto(c.Code, c.Nom)).ToListAsync(ct)
            : [];

        var presences = await db.Presences.AsNoTracking()
            .Where(p => p.QrCode == code)
            .OrderBy(p => p.HeureDePointage)
            .Select(p => new PresencePublicDto(p.SessionId, p.Session.Designation, p.HeureDePointage))
            .ToListAsync(ct);

        var participant = qr.Statut == QrCodeStatut.Actif
            ? new ParticipantDto(qr.NomComplet!, MasquerEmail(qr.Email!), qr.Club?.Nom)
            : null;

        return new ScanEtatDto(qr.Code, qr.Statut.ToString(), participant, seminaires, clubs, presences);
    }

    public async Task<PresenceConfirmationDto> ValiderPresenceAsync(string codeBrut, ValiderPresenceRequest requete, CancellationToken ct)
    {
        var code = CodeQr.Normaliser(codeBrut) ?? throw new IntrouvableException(MessageCodeInvalide);

        var session = await db.Sessions.AsNoTracking()
            .Include(s => s.Seminaire)
            .FirstOrDefaultAsync(s => s.Id == requete.SessionId, ct);

        if (session is null || !session.EstActif || !session.Seminaire.EstActif)
            throw new RegleMetierException("Cette session n'est pas ouverte au pointage.");
        if (session.SeminaireId != requete.SeminaireId)
            throw new RegleMetierException("La session choisie n'appartient pas au séminaire sélectionné.");

        // Contrôle du lieu, avant toute écriture : en mode « Bloquer », rien n'est enregistré hors zone.
        var position = ControleLieu.Evaluer(session.Seminaire, requete.Position);
        if (session.Seminaire.ControlePosition == ControlePosition.Bloquer)
        {
            if (position.Resultat == ResultatPosition.NonLocalise)
                throw new RegleMetierException(
                    "Pour valider votre présence, autorisez la localisation de votre téléphone : elle sert uniquement à vérifier que vous êtes sur le lieu de la formation.");
            if (position.Resultat == ResultatPosition.HorsZone)
                throw new RegleMetierException(
                    $"Vous semblez être à {ControleLieu.FormaterDistance(position.DistanceMetres ?? 0)} du lieu de la formation. La présence ne peut être validée que sur place.");
        }

        var maintenant = horloge.GetUtcNow();

        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        var qr = await db.QrCodes.FirstOrDefaultAsync(q => q.Code == code, ct)
            ?? throw new IntrouvableException(MessageCodeInvalide);

        var premierScan = false;
        if (qr.Statut == QrCodeStatut.Inactif)
        {
            var (nom, email, clubCode) = await ValiderIdentiteAsync(requete, ct);

            // Mise à jour conditionnelle : si un autre scan simultané a déjà activé le billet,
            // aucune ligne n'est modifiée et on poursuit comme un scan suivant.
            var lignes = await db.QrCodes
                .Where(q => q.Code == code && q.Statut == QrCodeStatut.Inactif)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(q => q.Statut, QrCodeStatut.Actif)
                    .SetProperty(q => q.NomComplet, nom)
                    .SetProperty(q => q.Email, email)
                    .SetProperty(q => q.ClubCode, clubCode)
                    .SetProperty(q => q.SeminaireId, session.SeminaireId)
                    .SetProperty(q => q.DateActivation, maintenant)
                    .SetProperty(q => q.UpdatedAt, maintenant), ct);

            premierScan = lignes == 1;
            await db.Entry(qr).ReloadAsync(ct);
        }

        var dejaPointe = await HeureDePointageExistanteAsync(code, session.Id, ct);
        if (dejaPointe is not null)
            throw new ConflitException(MessageDejaPointe(dejaPointe.Value));

        var presence = new Presence
        {
            Id = Guid.NewGuid(),
            QrCode = code,
            SessionId = session.Id,
            HeureDePointage = maintenant,
            ResultatPosition = position.Resultat,
            DistanceMetres = position.DistanceMetres,
            PrecisionMetres = position.PrecisionMetres
        };
        db.Presences.Add(presence);

        var (sujet, corps) = EmailTemplates.ConfirmationPresence(qr.NomComplet!, session.Seminaire.Designation, session.Designation, maintenant);
        db.EmailOutbox.Add(new EmailOutboxMessage
        {
            Id = Guid.NewGuid(),
            PresenceId = presence.Id,
            Destinataire = qr.Email!,
            DestinataireNom = qr.NomComplet,
            Sujet = sujet,
            CorpsHtml = corps,
            Statut = EmailStatut.EnAttente,
            ProchaineTentativeAt = maintenant,
            CreatedAt = maintenant
        });

        try
        {
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Double validation simultanée (double tap) : la contrainte unique a tranché.
            await transaction.RollbackAsync(CancellationToken.None);
            db.ChangeTracker.Clear();
            var heure = await HeureDePointageExistanteAsync(code, session.Id, CancellationToken.None);
            throw new ConflitException(MessageDejaPointe(heure ?? maintenant));
        }

        logger.LogInformation("Présence enregistrée : {Code} session {SessionId} (premier scan : {PremierScan}, lieu : {Lieu} {Distance} m)",
            code, session.Id, premierScan, position.Resultat, position.DistanceMetres);

        return new PresenceConfirmationDto(qr.NomComplet!, session.Seminaire.Designation, session.Designation, maintenant, premierScan);
    }

    private async Task<IReadOnlyList<SeminairePublicDto>> ChargerSeminairesOuvertsAsync(CancellationToken ct)
    {
        var seminaires = await db.Seminaires.AsNoTracking()
            .Where(s => s.EstActif)
            .OrderBy(s => s.Designation)
            .Select(s => new
            {
                s.Id,
                s.Designation,
                s.ControlePosition,
                Sessions = s.Sessions.Where(x => x.EstActif).OrderBy(x => x.HeureDebut)
                    .Select(x => new SessionPublicDto(x.Id, x.Designation, x.HeureDebut, x.HeureFin)).ToList()
            })
            .ToListAsync(ct);

        // Un séminaire sans session ouverte n'offre rien à pointer : on ne le propose pas.
        return seminaires
            .Where(s => s.Sessions.Count > 0)
            .Select(s => new SeminairePublicDto(s.Id, s.Designation, s.ControlePosition, s.Sessions))
            .ToList();
    }

    private async Task<(string Nom, string Email, string ClubCode)> ValiderIdentiteAsync(ValiderPresenceRequest requete, CancellationToken ct)
    {
        var nom = EspacesMultiples().Replace(requete.NomComplet?.Trim() ?? string.Empty, " ");
        if (nom.Length < 2)
            throw new RegleMetierException("Veuillez saisir votre nom complet.");

        var email = requete.Email?.Trim().ToLowerInvariant() ?? string.Empty;
        if (email.Length == 0)
            throw new RegleMetierException("Veuillez saisir votre adresse email.");

        var clubCode = requete.ClubCode?.Trim() ?? string.Empty;
        var clubValide = clubCode.Length > 0 && await db.Clubs.AnyAsync(c => c.Code == clubCode && c.EstActif, ct);
        if (!clubValide)
            throw new RegleMetierException("Veuillez sélectionner votre club.");

        return (nom, email, clubCode);
    }

    private Task<DateTimeOffset?> HeureDePointageExistanteAsync(string code, Guid sessionId, CancellationToken ct) =>
        db.Presences.AsNoTracking()
            .Where(p => p.QrCode == code && p.SessionId == sessionId)
            .Select(p => (DateTimeOffset?)p.HeureDePointage)
            .FirstOrDefaultAsync(ct);

    private static string MessageDejaPointe(DateTimeOffset heure) =>
        $"Présence déjà enregistrée pour cette session à {Horloge.FormatHeure(heure)}.";

    internal static string MasquerEmail(string email)
    {
        var at = email.IndexOf('@');
        if (at <= 0) return "***";
        var local = email[..at];
        var visible = local.Length <= 2 ? local[..1] : local[..2];
        return $"{visible}***{email[at..]}";
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex EspacesMultiples();
}
