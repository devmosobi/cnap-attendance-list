using Cnap.Attendance.Api.Infrastructure;
using Cnap.Attendance.Core.Dtos;
using Cnap.Attendance.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Cnap.Attendance.Api.Controllers;

[ApiController]
[Route("api/admin/parametres/email")]
[Authorize(Policy = Politiques.Administrateur)]
public class ParametresEmailController(ParametresSmtpService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ParametresSmtpDto?>> Obtenir(CancellationToken ct) => Ok(await service.ObtenirAsync(ct));

    [HttpPut]
    public Task<ParametresSmtpDto> Enregistrer(ParametresSmtpRequest requete, CancellationToken ct) => service.EnregistrerAsync(requete, ct);

    [HttpPost("test")]
    public async Task<IActionResult> Tester(EmailTestRequest requete, CancellationToken ct)
    {
        await service.EnvoyerTestAsync(requete.Destinataire.Trim(), ct);
        return NoContent();
    }

    [HttpGet("file")]
    public Task<FileEmailStatsDto> File(CancellationToken ct) => service.StatistiquesFileAsync(ct);

    [HttpPost("file/relancer")]
    public async Task<ActionResult<object>> Relancer(CancellationToken ct) => Ok(new { relances = await service.RelancerEchecsAsync(ct) });
}

[ApiController]
[Route("api/admin/utilisateurs")]
[Authorize(Policy = Politiques.Administrateur)]
public class UtilisateursController(UtilisateurService service) : ControllerBase
{
    [HttpGet]
    public Task<List<UtilisateurDto>> Lister(CancellationToken ct) => service.ListerAsync(ct);

    [HttpPost]
    public Task<UtilisateurDto> Creer(UtilisateurCreationRequest requete) => service.CreerAsync(requete);

    [HttpPut("{id:guid}")]
    public Task<UtilisateurDto> Modifier(Guid id, UtilisateurModificationRequest requete) =>
        service.ModifierAsync(id, requete, User.UtilisateurId());

    [HttpPost("{id:guid}/reinitialiser-mot-de-passe")]
    public async Task<IActionResult> Reinitialiser(Guid id, ReinitialiserMotDePasseRequest requete)
    {
        await service.ReinitialiserMotDePasseAsync(id, requete.NouveauMotDePasse);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Supprimer(Guid id)
    {
        await service.SupprimerAsync(id, User.UtilisateurId());
        return NoContent();
    }
}
