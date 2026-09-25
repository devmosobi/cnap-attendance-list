namespace Cnap.Attendance.Core.Entities;

public class Presence
{
    public Guid Id { get; set; }
    public string QrCode { get; set; } = string.Empty;
    public QrCode QrCodeNavigation { get; set; } = null!;
    public Guid SessionId { get; set; }
    public Session Session { get; set; } = null!;
    public DateTimeOffset HeureDePointage { get; set; }
}
