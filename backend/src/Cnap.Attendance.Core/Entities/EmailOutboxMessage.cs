namespace Cnap.Attendance.Core.Entities;

/// <summary>
/// Email en attente d'envoi. Écrit dans la même transaction que la présence,
/// puis envoyé en tâche de fond : un échec SMTP ne bloque jamais le pointage.
/// </summary>
public class EmailOutboxMessage
{
    public Guid Id { get; set; }
    public Guid? PresenceId { get; set; }
    public string Destinataire { get; set; } = string.Empty;
    public string? DestinataireNom { get; set; }
    public string Sujet { get; set; } = string.Empty;
    public string CorpsHtml { get; set; } = string.Empty;
    public EmailStatut Statut { get; set; } = EmailStatut.EnAttente;
    public int Tentatives { get; set; }
    public DateTimeOffset ProchaineTentativeAt { get; set; }
    public string? DerniereErreur { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? SentAt { get; set; }
}

public enum EmailStatut
{
    EnAttente,
    Envoye,
    Echec
}
