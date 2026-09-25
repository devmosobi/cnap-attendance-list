using Cnap.Attendance.Core.Common;
using Cnap.Attendance.Core.Entities;

namespace Cnap.Attendance.UnitTests;

public class ControleLieuTests
{
    // Point de référence : Plateau, Abidjan.
    private const double Lat = 5.3240;
    private const double Lon = -4.0180;

    private static Seminaire Seminaire(ControlePosition mode = ControlePosition.Signaler, int rayon = 200) =>
        new() { ControlePosition = mode, Latitude = Lat, Longitude = Lon, RayonMetres = rayon };

    /// <summary>Position décalée vers le nord d'environ <paramref name="metres"/> mètres.</summary>
    private static PositionGps AuNord(double metres, double? precision = 10) => new(Lat + metres / 111_195.0, Lon, precision);

    [Fact]
    public void DistanceMetres_calcule_une_distance_connue()
    {
        // Abidjan Plateau → Yamoussoukro : environ 230 km à vol d'oiseau.
        var distance = ControleLieu.DistanceMetres(Lat, Lon, 6.8276, -5.2893);
        Assert.InRange(distance, 215_000, 235_000);
    }

    [Fact]
    public void Evaluer_retourne_SurPlace_dans_le_rayon()
    {
        var r = ControleLieu.Evaluer(Seminaire(), AuNord(150));
        Assert.Equal(ResultatPosition.SurPlace, r.Resultat);
        Assert.InRange(r.DistanceMetres!.Value, 145, 155);
    }

    [Fact]
    public void Evaluer_retourne_HorsZone_au_dela_du_rayon()
    {
        var r = ControleLieu.Evaluer(Seminaire(), AuNord(2_000));
        Assert.Equal(ResultatPosition.HorsZone, r.Resultat);
    }

    [Fact]
    public void Evaluer_tolere_l_imprecision_du_gps_dans_la_limite_du_plafond()
    {
        // 260 m avec une précision annoncée de 80 m : 260 <= 200 + 80 → sur place.
        Assert.Equal(ResultatPosition.SurPlace, ControleLieu.Evaluer(Seminaire(), AuNord(260, precision: 80)).Resultat);
        // Une précision de 5 km ne compte que pour 100 m : 400 > 200 + 100 → hors zone.
        Assert.Equal(ResultatPosition.HorsZone, ControleLieu.Evaluer(Seminaire(), AuNord(400, precision: 5_000)).Resultat);
    }

    [Fact]
    public void Evaluer_sans_position_retourne_NonLocalise()
    {
        Assert.Equal(ResultatPosition.NonLocalise, ControleLieu.Evaluer(Seminaire(), null).Resultat);
        Assert.Equal(ResultatPosition.NonLocalise, ControleLieu.Evaluer(Seminaire(), new PositionGps(double.NaN, 0, null)).Resultat);
    }

    [Fact]
    public void Evaluer_ne_controle_rien_si_desactive_ou_sans_coordonnees()
    {
        Assert.Equal(ResultatPosition.NonControle, ControleLieu.Evaluer(Seminaire(ControlePosition.Desactive), AuNord(50_000)).Resultat);
        var sansLieu = new Seminaire { ControlePosition = ControlePosition.Bloquer };
        Assert.Equal(ResultatPosition.NonControle, ControleLieu.Evaluer(sansLieu, null).Resultat);
    }

    [Theory]
    [InlineData(350, "350 m")]
    [InlineData(1_250, "1,3 km")]
    [InlineData(230_000, "230 km")]
    public void FormaterDistance_affiche_en_metres_ou_kilometres(int metres, string attendu) =>
        Assert.Equal(attendu, ControleLieu.FormaterDistance(metres));
}
