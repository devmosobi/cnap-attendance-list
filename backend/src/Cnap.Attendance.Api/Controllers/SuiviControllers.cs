using System.Security.Claims;
using Cnap.Attendance.Api.Infrastructure;
using Cnap.Attendance.Core.Dtos;
using Cnap.Attendance.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Cnap.Attendance.Api.Controllers;

[ApiController]
[Route("api/admin/qrcodes")]
[Authorize(Policy = Politiques.Console)]
public class QrCodesController(QrCodeService service) : ControllerBase
{
    /// <summary>Liste complète : tri, filtres de colonnes, pagination et exports sont faits dans la console.</summary>
    [HttpGet]
    public Task<List<QrCodeListeDto>> Lister([FromQuery] QrCodeFiltre filtre, CancellationToken ct) => service.ListerToutAsync(filtre, ct);

    [HttpGet("sans-session")]
    [Authorize(Policy = Politiques.Administrateur)]
    public Task<CodesSansSessionDto> CompterSansSession(CancellationToken ct) => service.CompterSansSessionAsync(ct);

    [HttpPost("sans-session/desactiver")]
    [Authorize(Policy = Politiques.Administrateur)]
    public async Task<OperationMasseDto> DesactiverSansSession(CancellationToken ct) => new(await service.DesactiverSansSessionAsync(ct));

    [HttpPost("sans-session/supprimer")]
    [Authorize(Policy = Politiques.Administrateur)]
    public async Task<OperationMasseDto> SupprimerSansSession(CancellationToken ct) => new(await service.SupprimerSansSessionAsync(ct));

    [HttpPost("desactives/reactiver")]
    [Authorize(Policy = Politiques.Administrateur)]
    public async Task<OperationMasseDto> ReactiverTous(CancellationToken ct) => new(await service.ReactiverTousAsync(ct));

    [HttpPost("{code}/desactiver")]
    [Authorize(Policy = Politiques.Administrateur)]
    public async Task<IActionResult> Desactiver(string code, CancellationToken ct)
    {
        await service.ChangerActivationAsync(code, desactiver: true, ct);
        return NoContent();
    }

    [HttpPost("{code}/reactiver")]
    [Authorize(Policy = Politiques.Administrateur)]
    public async Task<IActionResult> Reactiver(string code, CancellationToken ct)
    {
        await service.ChangerActivationAsync(code, desactiver: false, ct);
        return NoContent();
    }

    [HttpGet("{code}")]
    public Task<QrCodeDetailDto> Obtenir(string code, CancellationToken ct) => service.ObtenirAsync(code, ct);

    [HttpPut("{code}/participant")]
    [Authorize(Policy = Politiques.Administrateur)]
    public Task<QrCodeDetailDto> ModifierParticipant(string code, ModifierParticipantRequest requete, CancellationToken ct) =>
        service.ModifierParticipantAsync(code, requete, ct);

    [HttpPost("import")]
    [Authorize(Policy = Politiques.Administrateur)]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<ActionResult<ImportResultatDto>> Importer(IFormFile fichier, CancellationToken ct)
    {
        await using var flux = fichier.OpenReadStream();
        return await service.ImporterAsync(flux, fichier.FileName, ct);
    }
}

[ApiController]
[Route("api/admin/presences")]
[Authorize(Policy = Politiques.Console)]
public class PresencesController(PresenceService service) : ControllerBase
{
    /// <summary>Liste complète : tri, filtres de colonnes, pagination et exports sont faits dans la console.</summary>
    [HttpGet]
    public Task<List<PresenceListeDto>> Lister([FromQuery] PresenceFiltre filtre, CancellationToken ct) => service.ListerToutAsync(filtre, ct);

    /// <summary>Exclut la présence des statistiques (ex. : pointage hors du site de la formation).</summary>
    [HttpPost("{id:guid}/invalider")]
    public async Task<IActionResult> Invalider(Guid id, InvaliderPresenceRequest requete, CancellationToken ct)
    {
        var auteur = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(ClaimTypes.Name) ?? "inconnu";
        await service.InvaliderAsync(id, requete.Motif, auteur, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/retablir")]
    public async Task<IActionResult> Retablir(Guid id, CancellationToken ct)
    {
        await service.RetablirAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/admin/rapports")]
[Authorize(Policy = Politiques.Console)]
public class RapportsController(RapportService service) : ControllerBase
{
    [HttpGet("inscrits-par-seminaire")]
    public Task<List<RapportLigneDto>> InscritsParSeminaire(CancellationToken ct) => service.InscritsParSeminaireAsync(ct);

    [HttpGet("presences-par-session")]
    public Task<List<RapportLigneDto>> PresencesParSession([FromQuery] Guid? seminaireId, CancellationToken ct) =>
        service.PresencesParSessionAsync(seminaireId, ct);

    [HttpGet("presences-par-lieu")]
    public Task<List<RapportLieuDto>> PresencesParLieu([FromQuery] Guid? seminaireId, CancellationToken ct) =>
        service.PresencesParLieuAsync(seminaireId, ct);

    [HttpGet("inscrits-par-type-club")]
    public Task<List<RapportLigneDto>> InscritsParTypeClub([FromQuery] Guid? seminaireId, CancellationToken ct) =>
        service.InscritsParTypeClubAsync(seminaireId, ct);

    [HttpGet("presents-par-club")]
    public Task<List<PresentClubDto>> PresentsParClub([FromQuery] Guid seminaireId, CancellationToken ct) =>
        service.PresentsParClubAsync(seminaireId, ct);

    [HttpGet("inscrits-par-club")]
    public Task<List<RapportLigneDto>> InscritsParClub([FromQuery] Guid? seminaireId, CancellationToken ct) =>
        service.InscritsParClubAsync(seminaireId, ct);
}
