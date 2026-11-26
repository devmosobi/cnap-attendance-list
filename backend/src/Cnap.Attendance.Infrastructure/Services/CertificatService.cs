using Cnap.Attendance.Core.Common;
using Cnap.Attendance.Core.Dtos;
using Cnap.Attendance.Core.Entities;
using Cnap.Attendance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Cnap.Attendance.Infrastructure.Services;

/// <summary>Suivi des certificats imprimés, pour traiter l'impression par lots.</summary>
public class CertificatService(AppDbContext db, TimeProvider horloge)
{
    public Task<List<CertificatImprimeDto>> ListerImprimesAsync(Guid seminaireId, CancellationToken ct) =>
        db.CertificatsImprimes.AsNoTracking()
            .Where(c => c.SeminaireId == seminaireId)
            .Select(c => new CertificatImprimeDto(c.Type, c.Cle, c.ImprimeLe, c.ImprimePar))
            .ToListAsync(ct);

    /// <summary>Marque les certificats comme imprimés ; un certificat déjà marqué (réimpression) prend la nouvelle date.</summary>
    public async Task<int> MarquerAsync(MarquageCertificatsRequest requete, string auteur, CancellationToken ct)
    {
        if (!await db.Seminaires.AnyAsync(s => s.Id == requete.SeminaireId, ct))
            throw new IntrouvableException("Séminaire introuvable.");

        var cles = Normaliser(requete.Cles);
        var maintenant = horloge.GetUtcNow();
        var existants = await db.CertificatsImprimes
            .Where(c => c.SeminaireId == requete.SeminaireId && c.Type == requete.Type && cles.Contains(c.Cle))
            .ToDictionaryAsync(c => c.Cle, ct);

        foreach (var cle in cles)
        {
            if (existants.TryGetValue(cle, out var certificat))
            {
                certificat.ImprimeLe = maintenant;
                certificat.ImprimePar = auteur;
            }
            else
            {
                db.CertificatsImprimes.Add(new CertificatImprime
                {
                    Id = Guid.NewGuid(),
                    SeminaireId = requete.SeminaireId,
                    Type = requete.Type,
                    Cle = cle,
                    ImprimeLe = maintenant,
                    ImprimePar = auteur
                });
            }
        }
        await db.SaveChangesAsync(ct);
        return cles.Count;
    }

    /// <summary>Retire la marque « imprimé » (certificat abîmé, à réimprimer).</summary>
    public Task<int> RetirerMarqueAsync(MarquageCertificatsRequest requete, CancellationToken ct)
    {
        var cles = Normaliser(requete.Cles);
        return db.CertificatsImprimes
            .Where(c => c.SeminaireId == requete.SeminaireId && c.Type == requete.Type && cles.Contains(c.Cle))
            .ExecuteDeleteAsync(ct);
    }

    private static List<string> Normaliser(IEnumerable<string> cles) =>
        cles.Select(c => c.Trim()).Where(c => c.Length > 0).Distinct(StringComparer.Ordinal).ToList();
}
