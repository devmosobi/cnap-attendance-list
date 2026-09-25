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
}

public enum ResultatPosition
{
    NonControle,
    SurPlace,
    HorsZone,
    NonLocalise
}
