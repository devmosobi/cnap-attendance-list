namespace Cnap.Attendance.Core.Entities;

/// <summary>
/// Certificat marqué comme imprimé depuis la console, pour suivre l'impression par lots.
/// Cle : QR Code du participant (certificat de participation) ou code du club (certificat de remerciements).
/// </summary>
public class CertificatImprime
{
    public Guid Id { get; set; }
    public Guid SeminaireId { get; set; }
    public Seminaire Seminaire { get; set; } = null!;
    public TypeCertificat Type { get; set; }
    public string Cle { get; set; } = string.Empty;
    public DateTimeOffset ImprimeLe { get; set; }
    public string ImprimePar { get; set; } = string.Empty;
}

public enum TypeCertificat
{
    /// <summary>Certificat de participation, imprimé au nom d'un participant.</summary>
    Participant,

    /// <summary>Certificat de remerciements, imprimé au nom d'un club.</summary>
    Club
}
