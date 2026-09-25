namespace Cnap.Attendance.Core.Common;

/// <summary>Conversion vers l'heure locale de Côte d'Ivoire (Africa/Abidjan, UTC+0).</summary>
public static class Horloge
{
    private static readonly TimeZoneInfo Fuseau = TrouverFuseau();

    public static DateTimeOffset EnHeureLocale(DateTimeOffset date) => TimeZoneInfo.ConvertTime(date, Fuseau);

    public static string FormatHeure(DateTimeOffset date) => EnHeureLocale(date).ToString("HH:mm");

    public static string FormatDateHeure(DateTimeOffset date) =>
        EnHeureLocale(date).ToString("dd/MM/yyyy 'à' HH:mm", System.Globalization.CultureInfo.GetCultureInfo("fr-FR"));

    private static TimeZoneInfo TrouverFuseau()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("Africa/Abidjan"); }
        catch (TimeZoneNotFoundException) { return TimeZoneInfo.Utc; }
        catch (InvalidTimeZoneException) { return TimeZoneInfo.Utc; }
    }
}
