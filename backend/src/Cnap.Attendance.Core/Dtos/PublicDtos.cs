using Cnap.Attendance.Core.Common;
using Cnap.Attendance.Core.Entities;

namespace Cnap.Attendance.Core.Dtos;

public record ScanEtatDto(
    string Code,
    string Statut,
    ParticipantDto? Participant,
    IReadOnlyList<SeminairePublicDto> Seminaires,
    IReadOnlyList<ClubOptionDto> Clubs,
    IReadOnlyList<PresencePublicDto> Presences);

public record ParticipantDto(string NomComplet, string EmailMasque, string? ClubNom);

/// <summary>ControlePosition indique à la page s'il faut demander la position du téléphone.</summary>
public record SeminairePublicDto(Guid Id, string Designation, ControlePosition ControlePosition, IReadOnlyList<SessionPublicDto> Sessions);

public record SessionPublicDto(Guid Id, string Designation, DateTimeOffset HeureDebut, DateTimeOffset HeureFin);

public record ClubOptionDto(string Code, string Nom);

public record PresencePublicDto(Guid SessionId, string Session, DateTimeOffset HeureDePointage);

public record ValiderPresenceRequest(
    Guid SeminaireId,
    Guid SessionId,
    string? ClubCode,
    string? NomComplet,
    string? Email,
    PositionGps? Position = null);

public record PresenceConfirmationDto(
    string NomComplet,
    string Seminaire,
    string Session,
    DateTimeOffset HeureDePointage,
    bool PremierScan);
