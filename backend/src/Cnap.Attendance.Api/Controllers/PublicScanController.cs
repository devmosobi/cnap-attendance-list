using Cnap.Attendance.Api.Infrastructure;
using Cnap.Attendance.Core.Dtos;
using Cnap.Attendance.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Cnap.Attendance.Api.Controllers;

/// <summary>Endpoints publics appelés depuis la page ouverte par le QR Code du billet.</summary>
[ApiController]
[Route("api/public/scan")]
[EnableRateLimiting(Politiques.RateLimitPublic)]
public class PublicScanController(ScanService scan) : ControllerBase
{
    [HttpGet("{code}")]
    public Task<ScanEtatDto> Obtenir(string code, CancellationToken ct) => scan.ObtenirEtatAsync(code, ct);

    [HttpPost("{code}/presences")]
    public Task<PresenceConfirmationDto> Valider(string code, ValiderPresenceRequest requete, CancellationToken ct) =>
        scan.ValiderPresenceAsync(code, requete, ct);
}
