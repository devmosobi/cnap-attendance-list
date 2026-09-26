using Cnap.Attendance.Core.Dtos;
using Cnap.Attendance.Core.Common;
using Cnap.Attendance.Core.Entities;
using Cnap.Attendance.Infrastructure.Data;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;

namespace Cnap.Attendance.Infrastructure.Services;

public class SeminaireService(AppDbContext db, TimeProvider horloge)
{
    public Task<List<SeminaireDto>> ListerAsync(CancellationToken ct) =>
        db.Seminaires.AsNoTracking()
            .OrderByDescending(s => s.EstActif).ThenBy(s => s.Designation)
            .Select(s => new SeminaireDto(s.Id, s.Designation, s.Description, s.EstActif,
                s.Sessions.Count, db.QrCodes.Count(q => q.Presences.Any(p => !p.EstInvalidee && p.Session.SeminaireId == s.Id)),
                s.ControlePosition, s.Latitude, s.Longitude, s.RayonMetres, s.InscritsDeclares))
            .ToListAsync(ct);

    public async Task<SeminaireDto> ObtenirAsync(Guid id, CancellationToken ct) =>
        await db.Seminaires.AsNoTracking().Where(s => s.Id == id)
            .Select(s => new SeminaireDto(s.Id, s.Designation, s.Description, s.EstActif,
                s.Sessions.Count, db.QrCodes.Count(q => q.Presences.Any(p => !p.EstInvalidee && p.Session.SeminaireId == s.Id)),
                s.ControlePosition, s.Latitude, s.Longitude, s.RayonMetres, s.InscritsDeclares))
            .FirstOrDefaultAsync(ct)
        ?? throw new IntrouvableException("Séminaire introuvable.");

    public async Task<SeminaireDto> CreerAsync(SeminaireRequest requete, CancellationToken ct)
    {
        var maintenant = horloge.GetUtcNow();
        var seminaire = new Seminaire
        {
            Id = Guid.NewGuid(),
            Designation = requete.Designation.Trim(),
            Description = Nettoyer(requete.Description),
            EstActif = requete.EstActif,
            CreatedAt = maintenant,
            UpdatedAt = maintenant
        };
        AppliquerLieu(seminaire, requete);
        db.Seminaires.Add(seminaire);
        await db.SaveChangesAsync(ct);
        return await ObtenirAsync(seminaire.Id, ct);
    }

    public async Task<SeminaireDto> ModifierAsync(Guid id, SeminaireRequest requete, CancellationToken ct)
    {
        var seminaire = await Charger(id, ct);
        seminaire.Designation = requete.Designation.Trim();
        seminaire.Description = Nettoyer(requete.Description);
        seminaire.EstActif = requete.EstActif;
        AppliquerLieu(seminaire, requete);
        seminaire.UpdatedAt = horloge.GetUtcNow();
        await db.SaveChangesAsync(ct);
        return await ObtenirAsync(id, ct);
    }

    public async Task ActiverAsync(Guid id, bool estActif, CancellationToken ct)
    {
        var seminaire = await Charger(id, ct);
        seminaire.EstActif = estActif;
        seminaire.UpdatedAt = horloge.GetUtcNow();
        await db.SaveChangesAsync(ct);
    }

    public async Task SupprimerAsync(Guid id, CancellationToken ct)
    {
        var seminaire = await Charger(id, ct);
        var lie = await db.Sessions.AnyAsync(s => s.SeminaireId == id, ct) || await db.QrCodes.AnyAsync(q => q.SeminaireId == id, ct);
        if (lie)
            throw new ConflitException("Ce séminaire a des sessions ou des inscriptions liées : désactivez-le plutôt que de le supprimer.");
        db.Seminaires.Remove(seminaire);
        await db.SaveChangesAsync(ct);
    }

    private async Task<Seminaire> Charger(Guid id, CancellationToken ct) =>
        await db.Seminaires.FirstOrDefaultAsync(s => s.Id == id, ct) ?? throw new IntrouvableException("Séminaire introuvable.");

    private static void AppliquerLieu(Seminaire seminaire, SeminaireRequest requete)
    {
        seminaire.ControlePosition = requete.ControlePosition;
        seminaire.Latitude = requete.Latitude;
        seminaire.Longitude = requete.Longitude;
        seminaire.RayonMetres = requete.RayonMetres;
        seminaire.InscritsDeclares = requete.InscritsDeclares;
    }

    internal static string? Nettoyer(string? valeur) => string.IsNullOrWhiteSpace(valeur) ? null : valeur.Trim();
}

public class SessionService(AppDbContext db, TimeProvider horloge)
{
    public Task<List<SessionDto>> ListerAsync(Guid? seminaireId, CancellationToken ct) =>
        Projeter(db.Sessions.AsNoTracking()
                .Where(s => seminaireId == null || s.SeminaireId == seminaireId)
                .OrderBy(s => s.Seminaire.Designation).ThenBy(s => s.HeureDebut))
            .ToListAsync(ct);

    public async Task<SessionDto> ObtenirAsync(Guid id, CancellationToken ct) =>
        await Projeter(db.Sessions.AsNoTracking().Where(s => s.Id == id)).FirstOrDefaultAsync(ct)
        ?? throw new IntrouvableException("Session introuvable.");

    public async Task<SessionDto> CreerAsync(SessionRequest requete, CancellationToken ct)
    {
        await VerifierSeminaireAsync(requete.SeminaireId, ct);
        var maintenant = horloge.GetUtcNow();
        var session = new Session
        {
            Id = Guid.NewGuid(),
            SeminaireId = requete.SeminaireId,
            Designation = requete.Designation.Trim(),
            HeureDebut = requete.HeureDebut.ToUniversalTime(),
            HeureFin = requete.HeureFin.ToUniversalTime(),
            Description = SeminaireService.Nettoyer(requete.Description),
            EstActif = requete.EstActif,
            CreatedAt = maintenant,
            UpdatedAt = maintenant
        };
        db.Sessions.Add(session);
        await db.SaveChangesAsync(ct);
        return await ObtenirAsync(session.Id, ct);
    }

    public async Task<SessionDto> ModifierAsync(Guid id, SessionRequest requete, CancellationToken ct)
    {
        var session = await Charger(id, ct);
        if (session.SeminaireId != requete.SeminaireId)
        {
            await VerifierSeminaireAsync(requete.SeminaireId, ct);
            if (await db.Presences.AnyAsync(p => p.SessionId == id, ct))
                throw new ConflitException("Des présences sont déjà enregistrées : impossible de rattacher cette session à un autre séminaire.");
        }
        session.SeminaireId = requete.SeminaireId;
        session.Designation = requete.Designation.Trim();
        session.HeureDebut = requete.HeureDebut.ToUniversalTime();
        session.HeureFin = requete.HeureFin.ToUniversalTime();
        session.Description = SeminaireService.Nettoyer(requete.Description);
        session.EstActif = requete.EstActif;
        session.UpdatedAt = horloge.GetUtcNow();
        await db.SaveChangesAsync(ct);
        return await ObtenirAsync(id, ct);
    }

    public async Task ActiverAsync(Guid id, bool estActif, CancellationToken ct)
    {
        var session = await Charger(id, ct);
        session.EstActif = estActif;
        session.UpdatedAt = horloge.GetUtcNow();
        await db.SaveChangesAsync(ct);
    }

    public async Task SupprimerAsync(Guid id, CancellationToken ct)
    {
        var session = await Charger(id, ct);
        if (await db.Presences.AnyAsync(p => p.SessionId == id, ct))
            throw new ConflitException("Des présences sont enregistrées pour cette session : désactivez-la plutôt que de la supprimer.");
        db.Sessions.Remove(session);
        await db.SaveChangesAsync(ct);
    }

    private static IQueryable<SessionDto> Projeter(IQueryable<Session> requete) =>
        requete.Select(s => new SessionDto(s.Id, s.SeminaireId, s.Seminaire.Designation, s.Designation,
            s.HeureDebut, s.HeureFin, s.Description, s.EstActif, s.Presences.Count(p => !p.EstInvalidee)));

    private async Task VerifierSeminaireAsync(Guid seminaireId, CancellationToken ct)
    {
        if (!await db.Seminaires.AnyAsync(s => s.Id == seminaireId, ct))
            throw new RegleMetierException("Le séminaire sélectionné n'existe pas.");
    }

    private async Task<Session> Charger(Guid id, CancellationToken ct) =>
        await db.Sessions.FirstOrDefaultAsync(s => s.Id == id, ct) ?? throw new IntrouvableException("Session introuvable.");
}

public partial class ClubService(AppDbContext db)
{
    [GeneratedRegex("^[A-Z0-9_-]+$")]
    private static partial Regex FormatCodeClub();

    public Task<List<ClubDto>> ListerAsync(CancellationToken ct) =>
        db.Clubs.AsNoTracking()
            .OrderBy(c => c.Nom)
            .Select(c => new ClubDto(c.Code, c.Nom, c.Type, c.EstActif,
                db.QrCodes.Count(q => q.ClubCode == c.Code && q.Presences.Any(p => !p.EstInvalidee))))
            .ToListAsync(ct);

    public async Task<ClubDto> CreerAsync(ClubCreationRequest requete, CancellationToken ct)
    {
        var code = requete.Code.Trim().ToUpperInvariant();
        var nom = requete.Nom.Trim();
        if (await db.Clubs.AnyAsync(c => c.Code == code, ct))
            throw new ConflitException($"Un club avec le code {code} existe déjà.");
        if (await db.Clubs.AnyAsync(c => c.Nom == nom, ct))
            throw new ConflitException($"Un club nommé « {nom} » existe déjà.");
        db.Clubs.Add(new Club { Code = code, Nom = nom, Type = requete.Type, EstActif = requete.EstActif });
        await db.SaveChangesAsync(ct);
        return new ClubDto(code, nom, requete.Type, requete.EstActif, 0);
    }

    public async Task<ClubDto> ModifierAsync(string code, ClubModificationRequest requete, CancellationToken ct)
    {
        var club = await Charger(code, ct);
        var nom = requete.Nom.Trim();
        if (await db.Clubs.AnyAsync(c => c.Nom == nom && c.Code != club.Code, ct))
            throw new ConflitException($"Un club nommé « {nom} » existe déjà.");
        club.Nom = nom;
        club.Type = requete.Type;
        club.EstActif = requete.EstActif;
        await db.SaveChangesAsync(ct);
        return new ClubDto(club.Code, club.Nom, club.Type, club.EstActif, await db.QrCodes.CountAsync(q => q.ClubCode == club.Code && q.Presences.Any(p => !p.EstInvalidee), ct));
    }

    public async Task ActiverAsync(string code, bool estActif, CancellationToken ct)
    {
        var club = await Charger(code, ct);
        club.EstActif = estActif;
        await db.SaveChangesAsync(ct);
    }

    public async Task SupprimerAsync(string code, CancellationToken ct)
    {
        var club = await Charger(code, ct);
        if (await db.QrCodes.AnyAsync(q => q.ClubCode == club.Code, ct))
            throw new ConflitException("Des participants sont rattachés à ce club : désactivez-le plutôt que de le supprimer.");
        db.Clubs.Remove(club);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Import CSV/Excel (colonnes Code, Nom et Type facultative) : crée les clubs absents ;
    /// pour un club existant (même code), seul le type est mis à jour si la colonne Type est présente.
    /// </summary>
    public async Task<ImportResultatDto> ImporterAsync(Stream fichier, string nomFichier, CancellationToken ct)
    {
        var lecture = await TableauLecteur.LireAsync(fichier, nomFichier, ct);
        var colCode = lecture.IndexColonne("Code", "Code club", "Code du club", "Numéro", "Numéro club", "ID club");
        var colNom = lecture.IndexColonne("Nom", "Nom club", "Nom du club", "Club", "Libellé", "Désignation");
        if (colCode < 0 || colNom < 0)
            throw new RegleMetierException("Colonnes « Code » et « Nom » requises dans le fichier (première ligne = en-têtes).");
        var colType = lecture.IndexColonne("Type", "Type de club", "Type club", "Catégorie");

        var existants = await db.Clubs.ToDictionaryAsync(c => c.Code, ct);
        var noms = existants.Values.Select(c => c.Nom).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var erreurs = new List<string>();
        int crees = 0, ignores = 0, misAJour = 0;

        foreach (var (numero, cellules) in lecture.Lignes)
        {
            var code = (colCode < cellules.Count ? cellules[colCode] : null)?.Trim().ToUpperInvariant() ?? string.Empty;
            var nom = (colNom < cellules.Count ? cellules[colNom] : null)?.Trim() ?? string.Empty;
            if (code.Length == 0 && nom.Length == 0) continue;
            if (code.Length is 0 or > 20 || nom.Length is 0 or > 200)
            {
                erreurs.Add($"Ligne {numero} : code ou nom manquant ou trop long.");
                continue;
            }
            if (!FormatCodeClub().IsMatch(code))
            {
                erreurs.Add($"Ligne {numero} : code « {code} » invalide (lettres, chiffres, - ou _ uniquement).");
                continue;
            }
            var brutType = colType >= 0 && colType < cellules.Count ? cellules[colType] : null;
            var type = TypesClub.Lire(brutType);
            if (type is null)
            {
                erreurs.Add($"Ligne {numero} : type « {brutType?.Trim()} » inconnu (Rotary Club, Rotaract Club, Interact Club ou Autres).");
                continue;
            }
            if (existants.TryGetValue(code, out var existant))
            {
                if (colType >= 0 && existant.Type != type)
                {
                    existant.Type = type.Value;
                    misAJour++;
                }
                else ignores++;
                continue;
            }
            if (noms.Contains(nom))
            {
                ignores++;
                continue;
            }
            var club = new Club { Code = code, Nom = nom, Type = type.Value, EstActif = true };
            db.Clubs.Add(club);
            existants[code] = club;
            noms.Add(nom);
            crees++;
        }

        await db.SaveChangesAsync(ct);
        return new ImportResultatDto(lecture.Lignes.Count, crees, ignores, erreurs, misAJour);
    }

    private async Task<Club> Charger(string code, CancellationToken ct)
    {
        var normalise = code.Trim().ToUpperInvariant();
        return await db.Clubs.FirstOrDefaultAsync(c => c.Code == normalise, ct) ?? throw new IntrouvableException("Club introuvable.");
    }
}
