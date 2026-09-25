namespace Cnap.Attendance.Core.Entities;

public class Session
{
    public Guid Id { get; set; }
    public Guid SeminaireId { get; set; }
    public Seminaire Seminaire { get; set; } = null!;
    public string Designation { get; set; } = string.Empty;
    public DateTimeOffset HeureDebut { get; set; }
    public DateTimeOffset HeureFin { get; set; }
    public string? Description { get; set; }
    public bool EstActif { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<Presence> Presences { get; set; } = new List<Presence>();
}
