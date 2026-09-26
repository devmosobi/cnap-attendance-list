using System.Net;
using Cnap.Attendance.Core.Common;

namespace Cnap.Attendance.Infrastructure.Email;

public static class EmailTemplates
{
    public const string LogoContentId = "logo-cnap";
    public const string SiteCommission = "https://cnap-ci.rotary-district9101.org/";

    public static (string Sujet, string Html) ConfirmationPresence(string nom, string seminaire, string session, DateTimeOffset heure)
    {
        var sujet = $"Confirmation de présence – {session}";
        var contenu = $"""
            <p style="margin:0 0 16px">Bonjour <strong>{Encoder(nom)}</strong>,</p>
            <p style="margin:0 0 20px">Votre présence a bien été enregistrée.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f4f6fb;border-radius:8px">
              {Ligne("Séminaire", seminaire)}
              {Ligne("Session", session)}
              {Ligne("Pointage", Horloge.FormatDateHeure(heure))}
            </table>
            <p style="margin:20px 0 0">Merci de votre participation.</p>
            """;
        return (sujet, Gabarit(sujet, contenu));
    }

    public static (string Sujet, string Html) Test()
    {
        const string sujet = "Email de test – Gestion Liste de Présence";
        return (sujet, Gabarit(sujet, "<p style=\"margin:0\">La configuration SMTP fonctionne correctement.</p>"));
    }

    private static string Ligne(string libelle, string valeur) => $"""
        <tr>
          <td style="padding:10px 14px;color:#5b6475;font-size:13px;width:110px;vertical-align:top">{libelle}</td>
          <td style="padding:10px 14px;color:#17233c;font-size:15px;font-weight:600">{Encoder(valeur)}</td>
        </tr>
        """;

    private static string Gabarit(string titre, string contenu) => $"""
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>{Encoder(titre)}</title>
        </head>
        <body style="margin:0;padding:0;background:#eef1f6;font-family:Arial,Helvetica,sans-serif">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:24px 12px">
            <tr><td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
                <tr><td style="padding:24px 24px 8px;text-align:center">
                  <img src="cid:{LogoContentId}" alt="Commission Nationale Apprentissage" width="240" style="max-width:100%;height:auto;border:0">
                </td></tr>
                <tr><td style="padding:0 24px;border-bottom:4px solid #f7a81b"></td></tr>
                <tr><td style="padding:24px;color:#17233c;font-size:15px;line-height:1.5">
                  {contenu}
                </td></tr>
                <tr><td style="padding:16px 24px 24px;color:#5b6475;font-size:12px;text-align:center;border-top:1px solid #e3e7ef">
                  Commission Nationale Apprentissage – District Rotary 9101 (Côte d'Ivoire)<br>
                  <a href="{SiteCommission}" style="color:#17458f">{SiteCommission}</a>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
        """;

    private static string Encoder(string valeur) => WebUtility.HtmlEncode(valeur);
}
