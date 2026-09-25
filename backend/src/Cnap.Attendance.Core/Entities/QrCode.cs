namespace Cnap.Attendance.Core.Entities;

public class QrCode
{
    public string Code { get; set; } = string.Empty;
    public QrCodeStatut Statut { get; set; } = QrCodeStatut.Inactif;
    public string? NomComplet { get; set; }
    public string? Email { get; set; }
    public string? ClubCode { get; set; }
    public Club? Club { get; set; }
    public Guid? SeminaireId { get; set; }
    public Seminaire? Seminaire { get; set; }
    public DateTimeOffset? DateActivation { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<Presence> Presences { get; set; } = new List<Presence>();
}

public enum QrCodeStatut
{
    Inactif,
    Actif
}
