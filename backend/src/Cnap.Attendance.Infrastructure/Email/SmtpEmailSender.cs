using System.Reflection;
using Cnap.Attendance.Core.Entities;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.AspNetCore.DataProtection;
using MimeKit;

namespace Cnap.Attendance.Infrastructure.Email;

/// <summary>Chiffre le mot de passe SMTP stocké en base (ASP.NET Data Protection).</summary>
public class SmtpSecretProtector(IDataProtectionProvider provider)
{
    private readonly IDataProtector _protector = provider.CreateProtector("Cnap.Attendance.SmtpPassword");

    public string Chiffrer(string valeur) => _protector.Protect(valeur);

    public string Dechiffrer(string valeurChiffree) => _protector.Unprotect(valeurChiffree);
}

public class SmtpEmailSender(SmtpSecretProtector secrets)
{
    private static readonly Lazy<byte[]> Logo = new(ChargerLogo);

    public async Task<SmtpClient> ConnecterAsync(ParametresSmtp parametres, CancellationToken ct)
    {
        var client = new SmtpClient { Timeout = 30_000 };
        var securite = !parametres.UtiliserTls
            ? SecureSocketOptions.None
            : parametres.Port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls;

        try
        {
            await client.ConnectAsync(parametres.Hote, parametres.Port, securite, ct);
            if (!string.IsNullOrWhiteSpace(parametres.Utilisateur))
            {
                var motDePasse = parametres.MotDePasseChiffre is null ? string.Empty : secrets.Dechiffrer(parametres.MotDePasseChiffre);
                await client.AuthenticateAsync(parametres.Utilisateur, motDePasse, ct);
            }
            return client;
        }
        catch
        {
            client.Dispose();
            throw;
        }
    }

    public static MimeMessage Construire(ParametresSmtp parametres, string destinataire, string? destinataireNom, string sujet, string corpsHtml)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(parametres.ExpediteurNom, parametres.ExpediteurEmail));
        message.To.Add(new MailboxAddress(destinataireNom ?? destinataire, destinataire));
        message.Subject = sujet;

        var builder = new BodyBuilder { HtmlBody = corpsHtml };
        var logo = builder.LinkedResources.Add("logo-cnap.jpeg", Logo.Value, new ContentType("image", "jpeg"));
        logo.ContentId = EmailTemplates.LogoContentId;
        message.Body = builder.ToMessageBody();
        return message;
    }

    public async Task EnvoyerAsync(ParametresSmtp parametres, string destinataire, string? nom, string sujet, string corpsHtml, CancellationToken ct)
    {
        using var client = await ConnecterAsync(parametres, ct);
        await client.SendAsync(Construire(parametres, destinataire, nom, sujet, corpsHtml), ct);
        await client.DisconnectAsync(true, ct);
    }

    private static byte[] ChargerLogo()
    {
        using var flux = Assembly.GetExecutingAssembly().GetManifestResourceStream("Cnap.Attendance.Infrastructure.Email.logo-cnap.jpeg")
            ?? throw new InvalidOperationException("Logo introuvable dans les ressources.");
        using var memoire = new MemoryStream();
        flux.CopyTo(memoire);
        return memoire.ToArray();
    }
}
