namespace Cnap.Attendance.Core.Entities;

/// <summary>Configuration SMTP (ligne unique, Id = 1).</summary>
public class ParametresSmtp
{
    public const int IdUnique = 1;

    public int Id { get; set; } = IdUnique;
    public string Hote { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public string? Utilisateur { get; set; }
    public string? MotDePasseChiffre { get; set; }
    public string ExpediteurEmail { get; set; } = string.Empty;
    public string ExpediteurNom { get; set; } = "Commission Nationale Formation";
    public bool UtiliserTls { get; set; } = true;
    public bool EstActif { get; set; } = true;
    public DateTimeOffset UpdatedAt { get; set; }
}
