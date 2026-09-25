using Cnap.Attendance.Infrastructure.Data;
using Cnap.Attendance.Infrastructure.Email;
using Cnap.Attendance.Infrastructure.Identity;
using Cnap.Attendance.Infrastructure.Services;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Cnap.Attendance.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connexion = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Chaîne de connexion « ConnectionStrings__Default » manquante.");

        services.AddDbContext<AppDbContext>(options => options
            .UseNpgsql(connexion)
            .UseSnakeCaseNamingConvention());

        services
            .AddIdentityCore<ApplicationUser>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.Password.RequiredLength = 8;
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireNonAlphanumeric = false;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            })
            .AddRoles<IdentityRole<Guid>>()
            .AddEntityFrameworkStores<AppDbContext>()
            .AddDefaultTokenProviders();

        services.AddDataProtection()
            .SetApplicationName("cnap-attendance")
            .PersistKeysToDbContext<AppDbContext>();

        services.Configure<SeedOptions>(configuration.GetSection(SeedOptions.Section));
        services.Configure<SmtpInitialOptions>(configuration.GetSection(SmtpInitialOptions.Section));

        services.AddSingleton(TimeProvider.System);
        services.AddScoped<SmtpSecretProtector>();
        services.AddScoped<SmtpEmailSender>();
        services.AddHostedService<EmailOutboxProcessor>();

        services.AddScoped<ScanService>();
        services.AddScoped<SeminaireService>();
        services.AddScoped<SessionService>();
        services.AddScoped<ClubService>();
        services.AddScoped<QrCodeService>();
        services.AddScoped<PresenceService>();
        services.AddScoped<RapportService>();
        services.AddScoped<ParametresSmtpService>();
        services.AddScoped<UtilisateurService>();

        return services;
    }
}
