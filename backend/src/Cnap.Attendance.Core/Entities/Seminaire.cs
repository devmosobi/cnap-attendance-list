namespace Cnap.Attendance.Core.Entities;

public class Seminaire
{
    public Guid Id { get; set; }
    public string Designation { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool EstActif { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<Session> Sessions { get; set; } = new List<Session>();
}
