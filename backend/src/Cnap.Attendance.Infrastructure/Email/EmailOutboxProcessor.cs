using Cnap.Attendance.Core.Entities;
using Cnap.Attendance.Infrastructure.Data;
using MailKit.Net.Smtp;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Cnap.Attendance.Infrastructure.Email;

/// <summary>
/// Envoie en tâche de fond les emails de la table email_outbox, avec nouvelles tentatives espacées.
/// </summary>
public class EmailOutboxProcessor(IServiceScopeFactory scopes, TimeProvider horloge, ILogger<EmailOutboxProcessor> logger) : BackgroundService
{
    private static readonly TimeSpan Intervalle = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan[] DelaisReprise =
    [
        TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(5), TimeSpan.FromMinutes(15),
        TimeSpan.FromHours(1), TimeSpan.FromHours(4)
    ];
    private const int TailleLot = 25;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Intervalle);
        do
        {
            try
            {
                await TraiterLotAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Erreur lors du traitement de la file d'emails.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task TraiterLotAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var sender = scope.ServiceProvider.GetRequiredService<SmtpEmailSender>();

        var parametres = await db.ParametresSmtp.AsNoTracking().FirstOrDefaultAsync(x => x.Id == ParametresSmtp.IdUnique, ct);
        if (parametres is null || !parametres.EstActif || string.IsNullOrWhiteSpace(parametres.Hote))
            return;

        var maintenant = horloge.GetUtcNow();
        var messages = await db.EmailOutbox
            .Where(m => m.Statut == EmailStatut.EnAttente && m.ProchaineTentativeAt <= maintenant)
            .OrderBy(m => m.CreatedAt)
            .Take(TailleLot)
            .ToListAsync(ct);
        if (messages.Count == 0)
            return;

        SmtpClient? client = null;
        try
        {
            client = await sender.ConnecterAsync(parametres, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Connexion SMTP impossible, {Nombre} email(s) reportés.", messages.Count);
            foreach (var message in messages)
                EnregistrerEchec(message, ex, maintenant);
            await db.SaveChangesAsync(ct);
            return;
        }

        using (client)
        {
            foreach (var message in messages)
            {
                try
                {
                    var mime = SmtpEmailSender.Construire(parametres, message.Destinataire, message.DestinataireNom, message.Sujet, message.CorpsHtml);
                    await client.SendAsync(mime, ct);
                    message.Statut = EmailStatut.Envoye;
                    message.SentAt = horloge.GetUtcNow();
                    message.DerniereErreur = null;
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogWarning(ex, "Échec d'envoi de l'email {Id} à {Destinataire}.", message.Id, message.Destinataire);
                    EnregistrerEchec(message, ex, maintenant);
                    if (!client.IsConnected) break;
                }
                await db.SaveChangesAsync(ct);
            }
            await db.SaveChangesAsync(ct);
            if (client.IsConnected)
                await client.DisconnectAsync(true, ct);
        }
    }

    private static void EnregistrerEchec(EmailOutboxMessage message, Exception ex, DateTimeOffset maintenant)
    {
        message.Tentatives++;
        message.DerniereErreur = ex.Message.Length > 1000 ? ex.Message[..1000] : ex.Message;
        if (message.Tentatives > DelaisReprise.Length)
        {
            message.Statut = EmailStatut.Echec;
            return;
        }
        message.ProchaineTentativeAt = maintenant + DelaisReprise[message.Tentatives - 1];
    }
}
