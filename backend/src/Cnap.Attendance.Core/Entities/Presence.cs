namespace Cnap.Attendance.Core.Entities;

public class Presence
{
    public Guid Id { get; set; }
    public string QrCode { get; set; } = string.Empty;
    public QrCode QrCodeNavigation { get; set; } = null!;
    public Guid SessionId { get; set; }
    public Session Session { get; set; } = null!;
    public DateTimeOffset HeureDePointage { get; set; }

    /// <summary>Résultat du contrôle de position. Seules la distance au lieu et la précision sont conservées, pas les coordonnées.</summary>
    public ResultatPosition ResultatPosition { get; set; } = ResultatPosition.NonControle;
    public int? DistanceMetres { get; set; }
    public int? PrecisionMetres { get; set; }

    /// <summary>
    /// Présence invalidée par la console (ex. : pointage hors du site) : conservée pour l'historique,
    /// exclue des statistiques, et bloquant toujours un nouveau pointage de la même session.
    /// </summary>
    public bool EstInvalidee { get; set; }
    public string? MotifInvalidation { get; set; }
    public string? InvalideePar { get; set; }
    public DateTimeOffset? InvalideeLe { get; set; }
}

public enum ResultatPosition
{
    NonControle,
    SurPlace,
    HorsZone,
    NonLocalise
}
