using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Cnap.Attendance.Api.Auth;
using Cnap.Attendance.Api.Infrastructure;
using Cnap.Attendance.Core.Common;
using Cnap.Attendance.Core.Validators;
using Cnap.Attendance.Infrastructure;
using Cnap.Attendance.Infrastructure.Data;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var configuration = builder.Configuration;

builder.Services.AddInfrastructure(configuration);
builder.Services.AddValidatorsFromAssemblyContaining<ValiderPresenceRequestValidator>();

builder.Services
    .AddControllers(options => options.Filters.Add<ValidationFilter>())
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()))
    .ConfigureApiBehaviorOptions(o => o.InvalidModelStateResponseFactory = context =>
        new BadRequestObjectResult(new ValidationProblemDetails(context.ModelState)
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "Requête invalide",
            Detail = "Données manquantes ou mal formées."
        }));
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<MetierExceptionHandler>();

// --- Authentification JWT (jeton lu dans le cookie httpOnly) ---
var jwt = configuration.GetSection(JwtOptions.Section).Get<JwtOptions>() ?? new JwtOptions();
if (Encoding.UTF8.GetByteCount(jwt.Secret) < 32)
    throw new InvalidOperationException("Jwt__Secret doit être défini et contenir au moins 32 caractères.");

builder.Services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.Section));
builder.Services.AddScoped<TokenService>();
builder.Services.AddSingleton<AuthCookies>();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Secret)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                context.Token ??= context.Request.Cookies[AuthCookies.AccessCookie];
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorizationBuilder()
    .AddPolicy(Politiques.Console, p => p
        .RequireAuthenticatedUser()
        .RequireRole(Roles.Tous)
        .RequireAssertion(c => !c.User.HasClaim(Claims.DoitChangerMotDePasse, "true")))
    .AddPolicy(Politiques.Administrateur, p => p
        .RequireAuthenticatedUser()
        .RequireRole(Roles.Administrateur)
        .RequireAssertion(c => !c.User.HasClaim(Claims.DoitChangerMotDePasse, "true")));

// --- Rate limiting ---
// Les participants partagent souvent la même IP publique (Wi-Fi de l'hôtel, NAT des opérateurs mobiles) :
// la limite publique reste large. Les codes (31^20 combinaisons) rendent de toute façon l'énumération irréaliste.
var limitePublique = configuration.GetValue("RateLimiting:PublicParMinute", 300);
var limiteLogin = configuration.GetValue("RateLimiting:LoginParMinute", 10);
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, ct) =>
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            status = 429,
            title = "Trop de requêtes",
            detail = "Trop de tentatives. Patientez quelques instants puis réessayez."
        }, ct);

    options.AddPolicy(Politiques.RateLimitPublic, context => RateLimitPartition.GetSlidingWindowLimiter(
        context.IpClient(),
        _ => new SlidingWindowRateLimiterOptions { PermitLimit = limitePublique, Window = TimeSpan.FromMinutes(1), SegmentsPerWindow = 6 }));

    options.AddPolicy(Politiques.RateLimitLogin, context => RateLimitPartition.GetFixedWindowLimiter(
        context.IpClient(),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = limiteLogin, Window = TimeSpan.FromMinutes(1) }));
});

// --- CORS : uniquement le domaine du frontend ---
var origines = (configuration["Cors:Origines"] ?? string.Empty)
    .Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
builder.Services.AddCors(options => options.AddDefaultPolicy(p =>
{
    if (origines.Length > 0)
        p.WithOrigins(origines).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
}));

var app = builder.Build();

app.UseExceptionHandler();
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapGet("/api/health", async (AppDbContext db, CancellationToken ct) =>
    await db.Database.CanConnectAsync(ct) ? Results.Ok(new { statut = "ok" }) : Results.StatusCode(503));

await InitialiserBaseAsync(app);
app.Run();

static async Task InitialiserBaseAsync(WebApplication app)
{
    var logger = app.Logger;
    if (app.Configuration.GetValue("Database:MigrateOnStartup", true))
    {
        // La base peut démarrer après l'API : quelques tentatives avant d'abandonner.
        for (var tentative = 1; ; tentative++)
        {
            try
            {
                using var scope = app.Services.CreateScope();
                await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();
                logger.LogInformation("Migrations appliquées.");
                break;
            }
            catch (Exception ex) when (tentative < 10)
            {
                logger.LogWarning("Base indisponible ({Message}), nouvelle tentative dans 3 s ({Tentative}/10).", ex.Message, tentative);
                await Task.Delay(TimeSpan.FromSeconds(3));
            }
        }
    }
    await DbSeeder.SeedAsync(app.Services);
}

public partial class Program;
