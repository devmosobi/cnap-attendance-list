using Cnap.Attendance.Core.Common;
using Cnap.Attendance.Core.Dtos;
using Cnap.Attendance.Core.Entities;
using Cnap.Attendance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Cnap.Attendance.Infrastructure.Services;

public class PresenceService(AppDbContext db)
{
    public Task<List<PresenceListeDto>> ListerToutAsync(PresenceFiltre filtre, CancellationToken ct) =>
        Projeter(Filtrer(filtre)).ToListAsync(ct);

    private IQueryable<Presence> Filtrer(PresenceFiltre filtre)
    {
        var requete = db.Presences.AsNoTracking();
        if (filtre.SessionId is { } sessionId)
            requete = requete.Where(p => p.SessionId == sessionId);
        if (filtre.SeminaireId is { } seminaireId)
            requete = requete.Where(p => p.Session.SeminaireId == seminaireId);
        if (!string.IsNullOrWhiteSpace(filtre.ClubCode))
            requete = requete.Where(p => p.QrCodeNavigation.ClubCode == filtre.ClubCode);
        if (filtre.Du is { } du)
            requete = requete.Where(p => p.HeureDePointage >= du.ToUniversalTime());
        if (filtre.Au is { } au)
            requete = requete.Where(p => p.HeureDePointage <= au.ToUniversalTime());
        if (!string.IsNullOrWhiteSpace(filtre.Recherche))
        {
            var motif = $"%{filtre.Recherche.Trim()}%";
            requete = requete.Where(p => EF.Functions.ILike(p.QrCode, motif)
                || (p.QrCodeNavigation.NomComplet != null && EF.Functions.ILike(p.QrCodeNavigation.NomComplet, motif))
                || (p.QrCodeNavigation.Email != null && EF.Functions.ILike(p.QrCodeNavigation.Email, motif)));
        }
        return requete;
    }

    private static IQueryable<PresenceListeDto> Projeter(IQueryable<Presence> requete) =>
        requete
            .OrderByDescending(p => p.HeureDePointage)
            .Select(p => new PresenceListeDto(
                p.Id, p.QrCode, p.QrCodeNavigation.NomComplet, p.QrCodeNavigation.Email, p.QrCodeNavigation.ClubCode,
                p.QrCodeNavigation.Club != null ? p.QrCodeNavigation.Club.Nom : null,
                p.QrCodeNavigation.Club != null ? p.QrCodeNavigation.Club.Type : null,
                p.SessionId, p.Session.Designation, p.Session.Seminaire.Designation, p.HeureDePointage,
                p.ResultatPosition, p.DistanceMetres));
}

public class RapportService(AppDbContext db)
{
    /// <summary>Nombre de QR Codes activés (participants distincts) par séminaire d'inscription.</summary>
    public async Task<List<RapportLigneDto>> InscritsParSeminaireAsync(CancellationToken ct)
    {
        var lignes = await db.Seminaires.AsNoTracking()
            .Select(s => new { s.Id, s.Designation, Nombre = db.QrCodes.Count(q => q.SeminaireId == s.Id) })
            .ToListAsync(ct);
        return Trier(lignes.Select(l => new RapportLigneDto(l.Id.ToString(), l.Designation, l.Nombre)));
    }

    /// <summary>Nombre de présences enregistrées par session.</summary>
    public Task<List<RapportLigneDto>> PresencesParSessionAsync(Guid? seminaireId, CancellationToken ct) =>
        db.Sessions.AsNoTracking()
            .Where(s => seminaireId == null || s.SeminaireId == seminaireId)
            .OrderBy(s => s.HeureDebut)
            .Select(s => new RapportLigneDto(s.Id.ToString(), s.Seminaire.Designation + " – " + s.Designation, s.Presences.Count))
            .ToListAsync(ct);

    /// <summary>
    /// Présents d'un séminaire (au moins une session pointée), triés par club puis par nom,
    /// avec les sessions suivies dans l'ordre chronologique.
    /// </summary>
    public async Task<List<PresentClubDto>> PresentsParClubAsync(Guid seminaireId, CancellationToken ct)
    {
        var pointages = await db.Presences.AsNoTracking()
            .Where(p => p.Session.SeminaireId == seminaireId)
            .Select(p => new
            {
                p.QrCode,
                p.QrCodeNavigation.NomComplet,
                p.QrCodeNavigation.Email,
                p.QrCodeNavigation.ClubCode,
                Club = p.QrCodeNavigation.Club != null ? p.QrCodeNavigation.Club.Nom : null,
                Type = p.QrCodeNavigation.Club != null ? (TypeClub?)p.QrCodeNavigation.Club.Type : null,
                Session = p.Session.Designation,
                p.Session.HeureDebut,
                p.HeureDePointage
            })
            .ToListAsync(ct);

        return pointages
            .GroupBy(p => p.QrCode)
            .Select(g =>
            {
                var p = g.First();
                return new PresentClubDto(g.Key, p.NomComplet, p.Email, p.ClubCode, p.Club, p.Type,
                    g.OrderBy(x => x.HeureDebut).Select(x => x.Session).Distinct().ToList(),
                    g.Min(x => x.HeureDePointage));
            })
            .OrderBy(p => p.Club is null) // participants sans club en dernier
            .ThenBy(p => p.Club, StringComparer.CurrentCultureIgnoreCase)
            .ThenBy(p => p.NomComplet, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
    }

    /// <summary>Présences par session et par résultat du contrôle du lieu (sessions sans présence incluses).</summary>
    public async Task<List<RapportLieuDto>> PresencesParLieuAsync(Guid? seminaireId, CancellationToken ct)
    {
        var comptes = await db.Presences.AsNoTracking()
            .Where(p => seminaireId == null || p.Session.SeminaireId == seminaireId)
            .GroupBy(p => new { p.SessionId, p.ResultatPosition })
            .Select(g => new { g.Key.SessionId, g.Key.ResultatPosition, Nombre = g.Count() })
            .ToListAsync(ct);

        var sessions = await db.Sessions.AsNoTracking()
            .Where(s => seminaireId == null || s.SeminaireId == seminaireId)
            .OrderBy(s => s.HeureDebut)
            .Select(s => new { s.Id, Libelle = s.Seminaire.Designation + " – " + s.Designation })
            .ToListAsync(ct);

        return sessions.Select(s =>
        {
            int Nombre(ResultatPosition r) => comptes.Where(c => c.SessionId == s.Id && c.ResultatPosition == r).Sum(c => c.Nombre);
            return new RapportLieuDto(s.Id.ToString(), s.Libelle,
                Nombre(ResultatPosition.SurPlace), Nombre(ResultatPosition.HorsZone),
                Nombre(ResultatPosition.NonLocalise), Nombre(ResultatPosition.NonControle));
        }).ToList();
    }

    /// <summary>Nombre de participants distincts par type de club (tous les types, même sans inscrit).</summary>
    public async Task<List<RapportLigneDto>> InscritsParTypeClubAsync(Guid? seminaireId, CancellationToken ct)
    {
        var comptes = await db.QrCodes.AsNoTracking()
            .Where(q => q.Club != null && (seminaireId == null || q.SeminaireId == seminaireId))
            .GroupBy(q => q.Club!.Type)
            .Select(g => new { Type = g.Key, Nombre = g.Count() })
            .ToListAsync(ct);
        return Enum.GetValues<TypeClub>()
            .Select(t => new RapportLigneDto(t.ToString(), TypesClub.Libelle(t), comptes.FirstOrDefault(c => c.Type == t)?.Nombre ?? 0))
            .ToList();
    }

    /// <summary>Nombre de participants distincts par club (clubs sans inscrit exclus).</summary>
    public async Task<List<RapportLigneDto>> InscritsParClubAsync(Guid? seminaireId, CancellationToken ct)
    {
        var lignes = await db.Clubs.AsNoTracking()
            .Select(c => new
            {
                c.Code,
                c.Nom,
                Nombre = db.QrCodes.Count(q => q.ClubCode == c.Code && (seminaireId == null || q.SeminaireId == seminaireId))
            })
            .Where(l => l.Nombre > 0)
            .ToListAsync(ct);
        return Trier(lignes.Select(l => new RapportLigneDto(l.Code, l.Nom, l.Nombre)));
    }

    private static List<RapportLigneDto> Trier(IEnumerable<RapportLigneDto> lignes) =>
        lignes.OrderByDescending(r => r.Valeur).ThenBy(r => r.Libelle, StringComparer.CurrentCultureIgnoreCase).ToList();
}
