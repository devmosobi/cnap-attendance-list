using Cnap.Attendance.Api.Infrastructure;
using Cnap.Attendance.Core.Dtos;
using Cnap.Attendance.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Cnap.Attendance.Api.Controllers;

[ApiController]
[Route("api/admin/seminaires")]
[Authorize(Policy = Politiques.Console)]
public class SeminairesController(SeminaireService service) : ControllerBase
{
    [HttpGet]
    public Task<List<SeminaireDto>> Lister(CancellationToken ct) => service.ListerAsync(ct);

    [HttpGet("{id:guid}")]
    public Task<SeminaireDto> Obtenir(Guid id, CancellationToken ct) => service.ObtenirAsync(id, ct);

    [HttpPost]
    public async Task<ActionResult<SeminaireDto>> Creer(SeminaireRequest requete, CancellationToken ct)
    {
        var cree = await service.CreerAsync(requete, ct);
        return CreatedAtAction(nameof(Obtenir), new { id = cree.Id }, cree);
    }

    [HttpPut("{id:guid}")]
    public Task<SeminaireDto> Modifier(Guid id, SeminaireRequest requete, CancellationToken ct) => service.ModifierAsync(id, requete, ct);

    [HttpPatch("{id:guid}/activation")]
    public async Task<IActionResult> Activer(Guid id, ActivationRequest requete, CancellationToken ct)
    {
        await service.ActiverAsync(id, requete.EstActif, ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Supprimer(Guid id, CancellationToken ct)
    {
        await service.SupprimerAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/admin/sessions")]
[Authorize(Policy = Politiques.Console)]
public class SessionsController(SessionService service) : ControllerBase
{
    [HttpGet]
    public Task<List<SessionDto>> Lister([FromQuery] Guid? seminaireId, CancellationToken ct) => service.ListerAsync(seminaireId, ct);

    [HttpGet("{id:guid}")]
    public Task<SessionDto> Obtenir(Guid id, CancellationToken ct) => service.ObtenirAsync(id, ct);

    [HttpPost]
    public async Task<ActionResult<SessionDto>> Creer(SessionRequest requete, CancellationToken ct)
    {
        var cree = await service.CreerAsync(requete, ct);
        return CreatedAtAction(nameof(Obtenir), new { id = cree.Id }, cree);
    }

    [HttpPut("{id:guid}")]
    public Task<SessionDto> Modifier(Guid id, SessionRequest requete, CancellationToken ct) => service.ModifierAsync(id, requete, ct);

    [HttpPatch("{id:guid}/activation")]
    public async Task<IActionResult> Activer(Guid id, ActivationRequest requete, CancellationToken ct)
    {
        await service.ActiverAsync(id, requete.EstActif, ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Supprimer(Guid id, CancellationToken ct)
    {
        await service.SupprimerAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/admin/clubs")]
[Authorize(Policy = Politiques.Console)]
public class ClubsController(ClubService service) : ControllerBase
{
    [HttpGet]
    public Task<List<ClubDto>> Lister(CancellationToken ct) => service.ListerAsync(ct);

    [HttpPost]
    public Task<ClubDto> Creer(ClubCreationRequest requete, CancellationToken ct) => service.CreerAsync(requete, ct);

    [HttpPut("{code}")]
    public Task<ClubDto> Modifier(string code, ClubModificationRequest requete, CancellationToken ct) => service.ModifierAsync(code, requete, ct);

    [HttpPatch("{code}/activation")]
    public async Task<IActionResult> Activer(string code, ActivationRequest requete, CancellationToken ct)
    {
        await service.ActiverAsync(code, requete.EstActif, ct);
        return NoContent();
    }

    [HttpDelete("{code}")]
    public async Task<IActionResult> Supprimer(string code, CancellationToken ct)
    {
        await service.SupprimerAsync(code, ct);
        return NoContent();
    }

    [HttpPost("import")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<ActionResult<ImportResultatDto>> Importer(IFormFile fichier, CancellationToken ct)
    {
        await using var flux = fichier.OpenReadStream();
        return await service.ImporterAsync(flux, fichier.FileName, ct);
    }

    /// <summary>Modèle vide (en-têtes Code, Nom et Type) à compléter puis importer.</summary>
    [HttpGet("modele")]
    public IActionResult Modele([FromQuery] FormatExport format = FormatExport.Xlsx)
    {
        var fichier = TableauExport.Generer(Array.Empty<ClubDto>(), [new("Code", c => c.Code), new("Nom", c => c.Nom), new("Type", c => c.Type)], format, "modele-clubs");
        return File(fichier.Contenu, fichier.ContentType, fichier.NomFichier);
    }
}
