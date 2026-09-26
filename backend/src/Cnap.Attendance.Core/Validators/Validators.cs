using Cnap.Attendance.Core.Common;
using Cnap.Attendance.Core.Dtos;
using Cnap.Attendance.Core.Entities;
using FluentValidation;

namespace Cnap.Attendance.Core.Validators;

public class ValiderPresenceRequestValidator : AbstractValidator<ValiderPresenceRequest>
{
    public ValiderPresenceRequestValidator()
    {
        RuleFor(x => x.SeminaireId).NotEmpty().WithMessage("Veuillez sélectionner un séminaire.");
        RuleFor(x => x.SessionId).NotEmpty().WithMessage("Veuillez sélectionner une session.");
        RuleFor(x => x.NomComplet).MaximumLength(200);
        RuleFor(x => x.Email).MaximumLength(254).EmailAddress().WithMessage("Adresse email invalide.")
            .When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.ClubCode).MaximumLength(20);
        When(x => x.Position is not null, () =>
        {
            RuleFor(x => x.Position!.Latitude).InclusiveBetween(-90, 90);
            RuleFor(x => x.Position!.Longitude).InclusiveBetween(-180, 180);
        });
    }
}

public class SeminaireRequestValidator : AbstractValidator<SeminaireRequest>
{
    public SeminaireRequestValidator()
    {
        RuleFor(x => x.Designation).NotEmpty().WithMessage("La désignation est requise.").MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(4000);
        RuleFor(x => x.ControlePosition).IsInEnum();
        RuleFor(x => x.RayonMetres).InclusiveBetween(Seminaire.RayonMinimumMetres, Seminaire.RayonMaximumMetres)
            .WithMessage($"Le rayon doit être compris entre {Seminaire.RayonMinimumMetres} et {Seminaire.RayonMaximumMetres} mètres.");
        RuleFor(x => x.Latitude).InclusiveBetween(-90, 90).WithMessage("Latitude invalide.");
        RuleFor(x => x.Longitude).InclusiveBetween(-180, 180).WithMessage("Longitude invalide.");
        When(x => x.ControlePosition != ControlePosition.Desactive, () =>
        {
            RuleFor(x => x.Latitude).NotNull().WithMessage("Renseignez les coordonnées GPS du lieu pour activer le contrôle.");
            RuleFor(x => x.Longitude).NotNull().WithMessage("Renseignez les coordonnées GPS du lieu pour activer le contrôle.");
        });
    }
}

public class SessionRequestValidator : AbstractValidator<SessionRequest>
{
    public SessionRequestValidator()
    {
        RuleFor(x => x.SeminaireId).NotEmpty().WithMessage("Le séminaire est requis.");
        RuleFor(x => x.Designation).NotEmpty().WithMessage("La désignation est requise.").MaximumLength(200);
        RuleFor(x => x.HeureFin).GreaterThan(x => x.HeureDebut)
            .WithMessage("L'heure de fin doit être postérieure à l'heure de début.");
        RuleFor(x => x.Description).MaximumLength(4000);
    }
}

public class ClubCreationRequestValidator : AbstractValidator<ClubCreationRequest>
{
    public ClubCreationRequestValidator()
    {
        RuleFor(x => x.Code).NotEmpty().WithMessage("Le code est requis.").MaximumLength(20)
            .Matches("^[A-Za-z0-9_-]+$").WithMessage("Le code ne doit contenir que des lettres, chiffres, - ou _.");
        RuleFor(x => x.Nom).NotEmpty().WithMessage("Le nom est requis.").MaximumLength(200);
        RuleFor(x => x.Type).IsInEnum().WithMessage("Type de club invalide.");
    }
}

public class ClubModificationRequestValidator : AbstractValidator<ClubModificationRequest>
{
    public ClubModificationRequestValidator()
    {
        RuleFor(x => x.Nom).NotEmpty().WithMessage("Le nom est requis.").MaximumLength(200);
        RuleFor(x => x.Type).IsInEnum().WithMessage("Type de club invalide.");
    }
}

public class ModifierParticipantRequestValidator : AbstractValidator<ModifierParticipantRequest>
{
    public ModifierParticipantRequestValidator()
    {
        RuleFor(x => x.NomComplet).NotEmpty().WithMessage("Le nom complet est requis.").MaximumLength(200);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().WithMessage("Adresse email invalide.").MaximumLength(254);
        RuleFor(x => x.ClubCode).NotEmpty().WithMessage("Le club est requis.");
    }
}

public class ParametresSmtpRequestValidator : AbstractValidator<ParametresSmtpRequest>
{
    public ParametresSmtpRequestValidator()
    {
        RuleFor(x => x.Hote).NotEmpty().WithMessage("L'hôte SMTP est requis.").MaximumLength(255);
        RuleFor(x => x.Port).InclusiveBetween(1, 65535);
        RuleFor(x => x.ExpediteurEmail).NotEmpty().EmailAddress().WithMessage("Adresse expéditeur invalide.");
        RuleFor(x => x.ExpediteurNom).NotEmpty().MaximumLength(200);
    }
}

public class EmailTestRequestValidator : AbstractValidator<EmailTestRequest>
{
    public EmailTestRequestValidator()
    {
        RuleFor(x => x.Destinataire).NotEmpty().EmailAddress().WithMessage("Adresse email invalide.");
    }
}

public class UtilisateurCreationRequestValidator : AbstractValidator<UtilisateurCreationRequest>
{
    public UtilisateurCreationRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().WithMessage("Adresse email invalide.");
        RuleFor(x => x.NomComplet).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Role).Must(r => Roles.Tous.Contains(r)).WithMessage("Rôle invalide.");
        RuleFor(x => x.MotDePasse).NotEmpty().MinimumLength(8);
    }
}

public class UtilisateurModificationRequestValidator : AbstractValidator<UtilisateurModificationRequest>
{
    public UtilisateurModificationRequestValidator()
    {
        RuleFor(x => x.NomComplet).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Role).Must(r => Roles.Tous.Contains(r)).WithMessage("Rôle invalide.");
    }
}

public class ReinitialiserMotDePasseRequestValidator : AbstractValidator<ReinitialiserMotDePasseRequest>
{
    public ReinitialiserMotDePasseRequestValidator()
    {
        RuleFor(x => x.NouveauMotDePasse).NotEmpty().MinimumLength(8);
    }
}

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty();
        RuleFor(x => x.MotDePasse).NotEmpty();
    }
}

public class ChangerMotDePasseRequestValidator : AbstractValidator<ChangerMotDePasseRequest>
{
    public ChangerMotDePasseRequestValidator()
    {
        RuleFor(x => x.MotDePasseActuel).NotEmpty();
        RuleFor(x => x.NouveauMotDePasse).NotEmpty().MinimumLength(8)
            .NotEqual(x => x.MotDePasseActuel).WithMessage("Le nouveau mot de passe doit être différent de l'actuel.");
    }
}
