using Microsoft.Extensions.Options;

namespace Cnap.Attendance.Api.Auth;

/// <summary>
/// Jetons transmis en cookies httpOnly : inaccessibles au JavaScript de la page.
/// SameSite=Lax bloque les requêtes POST/PUT/DELETE intersites (protection CSRF).
/// </summary>
public class AuthCookies(IOptions<JwtOptions> options)
{
    public const string AccessCookie = "cnap_at";
    public const string RefreshCookie = "cnap_rt";

    public void Ecrire(HttpResponse response, JetonsEmis jetons)
    {
        response.Cookies.Append(AccessCookie, jetons.AccessToken, Options(jetons.AccessExpire));
        response.Cookies.Append(RefreshCookie, jetons.RefreshToken, Options(jetons.RefreshExpire));
    }

    public void Supprimer(HttpResponse response)
    {
        response.Cookies.Delete(AccessCookie, Options(null));
        response.Cookies.Delete(RefreshCookie, Options(null));
    }

    private CookieOptions Options(DateTimeOffset? expire) => new()
    {
        HttpOnly = true,
        Secure = options.Value.CookieSecure,
        SameSite = SameSiteMode.Lax,
        Path = "/",
        Expires = expire,
        IsEssential = true
    };
}
