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
    [HttpGet]
    public Task<PageResultat<QrCodeListeDto>> Lister([FromQuery] QrCodeFiltre filtre, [FromQuery] int page = 1, [FromQuery] int taille = 50, CancellationToken ct = default) =>
        service.ListerAsync(filtre, Math.Max(page, 1), Math.Clamp(taille, 1, 200), ct);

    [HttpGet("export")]
    public async Task<IActionResult> Exporter([FromQuery] QrCodeFiltre filtre, [FromQuery] FormatExport format = FormatExport.Xlsx, CancellationToken ct = default)
    {
        var lignes = await service.ListerToutAsync(filtre, ct);
        var fichier = TableauExport.Generer(lignes,
        [
            new("Code", l => l.Code),
            new("Statut", l => l.Statut),
            new("Nom complet", l => l.NomComplet),
            new("Email", l => l.Email),
            new("Code club", l => l.ClubCode),
            new("Club", l => l.Club),
            new("Séminaire", l => l.Seminaire),
            new("Date d'activation", l => l.DateActivation),
            new("Nombre de présences", l => l.NombrePresences)
        ], format, "qrcodes");
        return File(fichier.Contenu, fichier.ContentType, fichier.NomFichier);
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
    [HttpGet]
    public Task<PageResultat<PresenceListeDto>> Lister([FromQuery] PresenceFiltre filtre, [FromQuery] int page = 1, [FromQuery] int taille = 50, CancellationToken ct = default) =>
        service.ListerAsync(filtre, Math.Max(page, 1), Math.Clamp(taille, 1, 200), ct);

    [HttpGet("export")]
    public async Task<IActionResult> Exporter([FromQuery] PresenceFiltre filtre, [FromQuery] FormatExport format = FormatExport.Xlsx, CancellationToken ct = default)
    {
        var lignes = await service.ListerToutAsync(filtre, ct);
        var fichier = TableauExport.Generer(lignes,
        [
            new("Nom complet", l => l.NomComplet),
            new("Email", l => l.Email),
            new("Code club", l => l.ClubCode),
            new("Club", l => l.Club),
            new("Séminaire", l => l.Seminaire),
            new("Session", l => l.Session),
            new("Heure de pointage", l => l.HeureDePointage),
            new("QR Code", l => l.QrCode)
        ], format, "presences");
        return File(fichier.Contenu, fichier.ContentType, fichier.NomFichier);
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

    [HttpGet("inscrits-par-club")]
    public Task<List<RapportLigneDto>> InscritsParClub([FromQuery] Guid? seminaireId, CancellationToken ct) =>
        service.InscritsParClubAsync(seminaireId, ct);

    [HttpGet("{rapport}/export")]
    public async Task<IActionResult> Exporter(string rapport, [FromQuery] Guid? seminaireId, [FromQuery] FormatExport format = FormatExport.Xlsx, CancellationToken ct = default)
    {
        var (lignes, libelle, valeur) = rapport switch
        {
            "inscrits-par-seminaire" => (await service.InscritsParSeminaireAsync(ct), "Séminaire", "Inscrits"),
            "presences-par-session" => (await service.PresencesParSessionAsync(seminaireId, ct), "Session", "Présences"),
            "inscrits-par-club" => (await service.InscritsParClubAsync(seminaireId, ct), "Club", "Inscrits"),
            _ => (null, string.Empty, string.Empty)
        };
        if (lignes is null) return NotFound();

        var fichier = TableauExport.Generer(lignes, [new(libelle, l => l.Libelle), new(valeur, l => l.Valeur)], format, rapport);
        return File(fichier.Contenu, fichier.ContentType, fichier.NomFichier);
    }
}
