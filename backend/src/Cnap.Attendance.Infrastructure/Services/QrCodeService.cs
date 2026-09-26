using Cnap.Attendance.Core.Common;
using Cnap.Attendance.Core.Dtos;
using Cnap.Attendance.Core.Entities;
using Cnap.Attendance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Cnap.Attendance.Infrastructure.Services;

public class QrCodeService(AppDbContext db, TimeProvider horloge)
{
    public Task<List<QrCodeListeDto>> ListerToutAsync(QrCodeFiltre filtre, CancellationToken ct) =>
        Projeter(Filtrer(filtre)).ToListAsync(ct);

    public async Task<QrCodeDetailDto> ObtenirAsync(string codeBrut, CancellationToken ct)
    {
        var code = CodeQr.Normaliser(codeBrut) ?? throw new IntrouvableException("QR Code introuvable.");
        var qr = await db.QrCodes.AsNoTracking()
            .Where(q => q.Code == code)
            .Select(q => new QrCodeDetailDto(
                q.Code, q.Statut.ToString(), q.NomComplet, q.Email, q.ClubCode,
                q.Club != null ? q.Club.Nom : null, q.SeminaireId,
                q.Seminaire != null ? q.Seminaire.Designation : null, q.DateActivation,
                q.Presences.OrderBy(p => p.HeureDePointage)
                    .Select(p => new PresenceHistoriqueDto(p.Id, p.SessionId, p.Session.Designation, p.Session.Seminaire.Designation, p.HeureDePointage,
                        p.ResultatPosition, p.DistanceMetres))
                    .ToList()))
            .FirstOrDefaultAsync(ct);
        return qr ?? throw new IntrouvableException("QR Code introuvable.");
    }

    /// <summary>Correction d'une erreur de saisie : l'historique des présences est conservé.</summary>
    public async Task<QrCodeDetailDto> ModifierParticipantAsync(string codeBrut, ModifierParticipantRequest requete, CancellationToken ct)
    {
        var code = CodeQr.Normaliser(codeBrut) ?? throw new IntrouvableException("QR Code introuvable.");
        var qr = await db.QrCodes.FirstOrDefaultAsync(q => q.Code == code, ct) ?? throw new IntrouvableException("QR Code introuvable.");
        if (qr.Statut != QrCodeStatut.Actif)
            throw new RegleMetierException("Ce QR Code n'a pas encore été utilisé : aucun participant à modifier.");

        var clubCode = requete.ClubCode.Trim().ToUpperInvariant();
        if (!await db.Clubs.AnyAsync(c => c.Code == clubCode, ct))
            throw new RegleMetierException("Le club sélectionné n'existe pas.");

        qr.NomComplet = requete.NomComplet.Trim();
        qr.Email = requete.Email.Trim().ToLowerInvariant();
        qr.ClubCode = clubCode;
        qr.UpdatedAt = horloge.GetUtcNow();
        await db.SaveChangesAsync(ct);
        return await ObtenirAsync(code, ct);
    }

    /// <summary>Ajoute les codes absents avec le statut Inactif ; les codes déjà présents sont ignorés.</summary>
    public async Task<ImportResultatDto> ImporterAsync(Stream fichier, string nomFichier, CancellationToken ct)
    {
        var lecture = await TableauLecteur.LireAsync(fichier, nomFichier, ct);
        var colonne = lecture.IndexColonne("Code");
        if (colonne < 0)
            throw new RegleMetierException("Colonne « Code » introuvable dans le fichier.");

        var erreurs = new List<string>();
        var codes = new HashSet<string>();
        foreach (var (numero, cellules) in lecture.Lignes)
        {
            var brut = colonne < cellules.Count ? cellules[colonne] : null;
            if (string.IsNullOrWhiteSpace(brut)) continue;
            var code = CodeQr.Normaliser(brut);
            if (code is null)
                erreurs.Add($"Ligne {numero} : code invalide « {brut.Trim()} » (20 caractères alphanumériques attendus).");
            else if (!codes.Add(code))
                erreurs.Add($"Ligne {numero} : code {code} en double dans le fichier.");
        }

        var existants = await db.QrCodes.Where(q => codes.Contains(q.Code)).Select(q => q.Code).ToListAsync(ct);
        var maintenant = horloge.GetUtcNow();
        var nouveaux = codes.Except(existants).Select(c => new QrCode
        {
            Code = c,
            Statut = QrCodeStatut.Inactif,
            CreatedAt = maintenant,
            UpdatedAt = maintenant
        }).ToList();

        db.QrCodes.AddRange(nouveaux);
        await db.SaveChangesAsync(ct);
        return new ImportResultatDto(lecture.Lignes.Count, nouveaux.Count, existants.Count, erreurs);
    }

    private IQueryable<QrCode> Filtrer(QrCodeFiltre filtre)
    {
        var requete = db.QrCodes.AsNoTracking();
        if (Enum.TryParse<QrCodeStatut>(filtre.Statut, true, out var statut))
            requete = requete.Where(q => q.Statut == statut);
        if (filtre.SeminaireId is { } seminaireId)
            requete = requete.Where(q => q.SeminaireId == seminaireId);
        if (!string.IsNullOrWhiteSpace(filtre.ClubCode))
            requete = requete.Where(q => q.ClubCode == filtre.ClubCode);
        if (!string.IsNullOrWhiteSpace(filtre.Recherche))
        {
            var motif = $"%{filtre.Recherche.Trim()}%";
            requete = requete.Where(q => EF.Functions.ILike(q.Code, motif)
                || (q.NomComplet != null && EF.Functions.ILike(q.NomComplet, motif))
                || (q.Email != null && EF.Functions.ILike(q.Email, motif)));
        }
        return requete;
    }

    private static IQueryable<QrCodeListeDto> Projeter(IQueryable<QrCode> requete) =>
        requete
            .OrderByDescending(q => q.DateActivation.HasValue).ThenByDescending(q => q.DateActivation).ThenBy(q => q.Code)
            .Select(q => new QrCodeListeDto(
                q.Code, q.Statut.ToString(), q.NomComplet, q.Email, q.ClubCode,
                q.Club != null ? q.Club.Nom : null, q.Club != null ? q.Club.Type : null, q.SeminaireId,
                q.Seminaire != null ? q.Seminaire.Designation : null, q.DateActivation, q.Presences.Count));
}
