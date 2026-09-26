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

    [HttpGet("inscrits-par-club")]
    public Task<List<RapportLigneDto>> InscritsParClub([FromQuery] Guid? seminaireId, CancellationToken ct) =>
        service.InscritsParClubAsync(seminaireId, ct);
}
