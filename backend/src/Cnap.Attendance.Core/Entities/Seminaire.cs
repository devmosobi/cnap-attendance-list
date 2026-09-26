namespace Cnap.Attendance.Core.Entities;

public class Seminaire
{
    public const int RayonMinimumMetres = 50;
    public const int RayonMaximumMetres = 500;

    public Guid Id { get; set; }
    public string Designation { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool EstActif { get; set; }

    /// <summary>Nombre d'inscrits saisi par les organisateurs (distinct des billets activés au scan).</summary>
    public int? InscritsDeclares { get; set; }

    /// <summary>Vérification que le participant valide sa présence sur le lieu de la formation.</summary>
    public ControlePosition ControlePosition { get; set; } = ControlePosition.Desactive;
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public int RayonMetres { get; set; } = 200;

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<Session> Sessions { get; set; } = new List<Session>();
}

public enum ControlePosition
{
    /// <summary>Position non demandée.</summary>
    Desactive,

    /// <summary>Présence enregistrée dans tous les cas, marquée « hors zone » ou « non localisée » si besoin.</summary>
    Signaler,

    /// <summary>Présence refusée hors zone ou sans position.</summary>
    Bloquer
}
