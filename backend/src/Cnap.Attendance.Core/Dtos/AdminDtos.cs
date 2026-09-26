using Cnap.Attendance.Core.Entities;

namespace Cnap.Attendance.Core.Dtos;

// Séminaires
public record SeminaireDto(
    Guid Id,
    string Designation,
    string? Description,
    bool EstActif,
    int NombreSessions,
    int NombreInscrits,
    ControlePosition ControlePosition,
    double? Latitude,
    double? Longitude,
    int RayonMetres);

public record SeminaireRequest(
    string Designation,
    string? Description,
    bool EstActif,
    ControlePosition ControlePosition = ControlePosition.Desactive,
    double? Latitude = null,
    double? Longitude = null,
    int RayonMetres = 200);

public record ActivationRequest(bool EstActif);

// Sessions
public record SessionDto(
    Guid Id,
    Guid SeminaireId,
    string Seminaire,
    string Designation,
    DateTimeOffset HeureDebut,
    DateTimeOffset HeureFin,
    string? Description,
    bool EstActif,
    int NombrePresences);

public record SessionRequest(Guid SeminaireId, string Designation, DateTimeOffset HeureDebut, DateTimeOffset HeureFin, string? Description, bool EstActif);

// Clubs
public record ClubDto(string Code, string Nom, TypeClub Type, bool EstActif, int NombreInscrits);

public record ClubCreationRequest(string Code, string Nom, bool EstActif, TypeClub Type = TypeClub.Autre);

public record ClubModificationRequest(string Nom, bool EstActif, TypeClub Type = TypeClub.Autre);

// QR Codes
public record QrCodeFiltre(string? Statut, Guid? SeminaireId, string? ClubCode, string? Recherche);

public record QrCodeListeDto(
    string Code,
    string Statut,
    string? NomComplet,
    string? Email,
    string? ClubCode,
    string? Club,
    TypeClub? TypeClub,
    Guid? SeminaireId,
    string? Seminaire,
    DateTimeOffset? DateActivation,
    int NombrePresences);

public record QrCodeDetailDto(
    string Code,
    string Statut,
    string? NomComplet,
    string? Email,
    string? ClubCode,
    string? Club,
    Guid? SeminaireId,
    string? Seminaire,
    DateTimeOffset? DateActivation,
    IReadOnlyList<PresenceHistoriqueDto> Presences);

public record PresenceHistoriqueDto(
    Guid Id,
    Guid SessionId,
    string Session,
    string Seminaire,
    DateTimeOffset HeureDePointage,
    ResultatPosition ResultatPosition,
    int? DistanceMetres);

public record ModifierParticipantRequest(string NomComplet, string Email, string ClubCode);

/// <summary>MisAJour : éléments existants modifiés par l'import (type d'un club, par exemple).</summary>
public record ImportResultatDto(int Lignes, int Crees, int Existants, IReadOnlyList<string> Erreurs, int MisAJour = 0);

// Présences
public record PresenceFiltre(Guid? SessionId, Guid? SeminaireId, string? ClubCode, DateTimeOffset? Du, DateTimeOffset? Au, string? Recherche);

public record PresenceListeDto(
    Guid Id,
    string QrCode,
    string? NomComplet,
    string? Email,
    string? ClubCode,
    string? Club,
    TypeClub? TypeClub,
    Guid SessionId,
    string Session,
    string Seminaire,
    DateTimeOffset HeureDePointage,
    ResultatPosition ResultatPosition,
    int? DistanceMetres);

// Rapports
public record RapportLigneDto(string Cle, string Libelle, int Valeur);

/// <summary>Participant ayant pointé au moins une session du séminaire (rapport « Présents par club »).</summary>
public record PresentClubDto(
    string QrCode,
    string? NomComplet,
    string? Email,
    string? ClubCode,
    string? Club,
    TypeClub? TypeClub,
    IReadOnlyList<string> Sessions,
    DateTimeOffset PremierePresence);

/// <summary>Répartition des présences d'une session selon le contrôle du lieu.</summary>
public record RapportLieuDto(string Cle, string Session, int SurPlace, int HorsZone, int NonLocalise, int NonControle);

// Paramètres SMTP
public record ParametresSmtpDto(
    string Hote,
    int Port,
    string? Utilisateur,
    bool MotDePasseDefini,
    string ExpediteurEmail,
    string ExpediteurNom,
    bool UtiliserTls,
    bool EstActif);

/// <summary>MotDePasse null ou vide = conserver le mot de passe existant.</summary>
public record ParametresSmtpRequest(
    string Hote,
    int Port,
    string? Utilisateur,
    string? MotDePasse,
    string ExpediteurEmail,
    string ExpediteurNom,
    bool UtiliserTls,
    bool EstActif);

public record EmailTestRequest(string Destinataire);

public record FileEmailStatsDto(int EnAttente, int Envoyes, int Echecs, string? DerniereErreur);

// Utilisateurs
public record UtilisateurDto(Guid Id, string Email, string NomComplet, string Role, bool EstActif, bool DoitChangerMotDePasse);

public record UtilisateurCreationRequest(string Email, string NomComplet, string Role, string MotDePasse);

public record UtilisateurModificationRequest(string NomComplet, string Role, bool EstActif);

public record ReinitialiserMotDePasseRequest(string NouveauMotDePasse);

// Authentification
public record LoginRequest(string Email, string MotDePasse);

public record ChangerMotDePasseRequest(string MotDePasseActuel, string NouveauMotDePasse);

public record UtilisateurConnecteDto(Guid Id, string Email, string NomComplet, string Role, bool DoitChangerMotDePasse);
