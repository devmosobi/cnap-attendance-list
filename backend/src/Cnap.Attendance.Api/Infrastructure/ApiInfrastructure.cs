using System.Security.Claims;
using Cnap.Attendance.Core.Common;
using FluentValidation;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Cnap.Attendance.Api.Infrastructure;

public static class Politiques
{
    /// <summary>Tout compte de la console (Administrateur ou Gestionnaire) ayant changé son mot de passe initial.</summary>
    public const string Console = "Console";

    /// <summary>Réservé au rôle Administrateur.</summary>
    public const string Administrateur = "Administrateur";

    public const string RateLimitPublic = "public";
    public const string RateLimitLogin = "login";
}

/// <summary>Traduit les exceptions métier en réponses ProblemDetails ; masque les détails techniques.</summary>
public class MetierExceptionHandler(ILogger<MetierExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        var (statut, titre) = exception switch
        {
            IntrouvableException => (StatusCodes.Status404NotFound, "Introuvable"),
            ConflitException => (StatusCodes.Status409Conflict, "Conflit"),
            RegleMetierException => (StatusCodes.Status400BadRequest, "Requête invalide"),
            IndisponibleException => (StatusCodes.Status503ServiceUnavailable, "Indisponible"),
            _ => (StatusCodes.Status500InternalServerError, "Erreur interne")
        };

        if (statut == StatusCodes.Status500InternalServerError)
            logger.LogError(exception, "Erreur non gérée sur {Chemin}", context.Request.Path);

        context.Response.StatusCode = statut;
        await context.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = statut,
            Title = titre,
            Detail = exception is MetierException ? exception.Message : "Une erreur inattendue est survenue. Veuillez réessayer."
        }, ct);
        return true;
    }
}

/// <summary>Valide automatiquement les arguments d'action pour lesquels un IValidator est enregistré.</summary>
public class ValidationFilter(IServiceProvider services) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        foreach (var argument in context.ActionArguments.Values)
        {
            if (argument is null) continue;
            var typeValidateur = typeof(IValidator<>).MakeGenericType(argument.GetType());
            if (services.GetService(typeValidateur) is not IValidator validateur) continue;

            var resultat = await validateur.ValidateAsync(new ValidationContext<object>(argument), context.HttpContext.RequestAborted);
            if (resultat.IsValid) continue;

            var erreurs = resultat.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());
            context.Result = new BadRequestObjectResult(new ValidationProblemDetails(erreurs)
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Requête invalide",
                Detail = resultat.Errors[0].ErrorMessage
            });
            return;
        }
        await next();
    }
}

public static class HttpContextExtensions
{
    /// <summary>
    /// IP du client pour le rate limiting. L'API n'est pas publiée directement : elle n'est joignable qu'au travers
    /// de Cloudflare puis du reverse proxy (Traefik/Dockploy) et du relais /api de Next.js, qui transmettent ces en-têtes.
    /// </summary>
    public static string IpClient(this HttpContext context)
    {
        var cloudflare = context.Request.Headers["CF-Connecting-IP"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(cloudflare))
            return cloudflare.Trim();

        var relais = context.Request.Headers["X-Forwarded-For"].FirstOrDefault()?.Split(',')[0].Trim();
        if (!string.IsNullOrWhiteSpace(relais))
            return relais;

        return context.Connection.RemoteIpAddress?.ToString() ?? "inconnue";
    }

    public static Guid UtilisateurId(this ClaimsPrincipal user) =>
        Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub"), out var id) ? id : Guid.Empty;
}
