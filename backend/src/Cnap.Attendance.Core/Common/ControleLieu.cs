using Cnap.Attendance.Core.Entities;

namespace Cnap.Attendance.Core.Common;

public record PositionGps(double Latitude, double Longitude, double? Precision);

public record EvaluationPosition(ResultatPosition Resultat, int? DistanceMetres, int? PrecisionMetres);

/// <summary>Vérifie qu'une position se trouve dans le rayon du lieu de la formation.</summary>
public static class ControleLieu
{
    /// <summary>
    /// Part de l'imprécision annoncée par le téléphone ajoutée au rayon (le GPS est moins précis en intérieur),
    /// plafonnée pour qu'une position très approximative ne suffise pas à être « sur place ».
    /// </summary>
    public const int ToleranceMaximaleMetres = 100;

    private const double RayonTerreMetres = 6_371_000;

    public static EvaluationPosition Evaluer(Seminaire seminaire, PositionGps? position)
    {
        if (seminaire.ControlePosition == ControlePosition.Desactive || seminaire.Latitude is null || seminaire.Longitude is null)
            return new EvaluationPosition(ResultatPosition.NonControle, null, null);

        if (position is null || !EstValide(position))
            return new EvaluationPosition(ResultatPosition.NonLocalise, null, null);

        var distance = DistanceMetres(seminaire.Latitude.Value, seminaire.Longitude.Value, position.Latitude, position.Longitude);
        var precision = position.Precision is > 0 ? position.Precision.Value : 0;
        var surPlace = distance <= seminaire.RayonMetres + Math.Min(precision, ToleranceMaximaleMetres);

        return new EvaluationPosition(
            surPlace ? ResultatPosition.SurPlace : ResultatPosition.HorsZone,
            (int)Math.Round(distance),
            position.Precision is > 0 ? (int)Math.Round(position.Precision.Value) : null);
    }

    /// <summary>Distance orthodromique (formule de haversine), en mètres.</summary>
    public static double DistanceMetres(double lat1, double lon1, double lat2, double lon2)
    {
        static double Radians(double degres) => degres * Math.PI / 180;
        var dLat = Radians(lat2 - lat1);
        var dLon = Radians(lon2 - lon1);
        var a = Math.Pow(Math.Sin(dLat / 2), 2) + Math.Cos(Radians(lat1)) * Math.Cos(Radians(lat2)) * Math.Pow(Math.Sin(dLon / 2), 2);
        return 2 * RayonTerreMetres * Math.Asin(Math.Min(1, Math.Sqrt(a)));
    }

    public static string FormaterDistance(int metres) =>
        metres < 1000 ? $"{metres} m" : $"{metres / 1000.0:0.#} km".Replace('.', ',');

    private static bool EstValide(PositionGps p) =>
        double.IsFinite(p.Latitude) && double.IsFinite(p.Longitude) && p.Latitude is >= -90 and <= 90 && p.Longitude is >= -180 and <= 180;
}
