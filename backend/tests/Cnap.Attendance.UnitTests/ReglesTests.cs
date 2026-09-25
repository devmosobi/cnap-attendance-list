using System.Text;
using Cnap.Attendance.Core.Common;
using Cnap.Attendance.Infrastructure.Services;

namespace Cnap.Attendance.UnitTests;

public class CodeQrTests
{
    [Theory]
    [InlineData("2925AK7VAGNBS34PQD87", "2925AK7VAGNBS34PQD87")]
    [InlineData("  2925ak7vagnbs34pqd87 ", "2925AK7VAGNBS34PQD87")]
    public void Normaliser_accepte_les_codes_valides(string brut, string attendu) =>
        Assert.Equal(attendu, CodeQr.Normaliser(brut));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("2925AK7VAGNBS34PQD8")]
    [InlineData("2925AK7VAGNBS34PQD877")]
    [InlineData("2925AK7VAGNBS34PQD8!")]
    [InlineData("2925AK7VAGNBS34PQ'--")]
    public void Normaliser_rejette_les_codes_invalides(string? brut) =>
        Assert.Null(CodeQr.Normaliser(brut));
}

public class MasquageEmailTests
{
    [Theory]
    [InlineData("jean.kouassi@exemple.ci", "je***@exemple.ci")]
    [InlineData("a@exemple.ci", "a***@exemple.ci")]
    [InlineData("invalide", "***")]
    public void MasquerEmail_ne_revele_que_le_debut(string email, string attendu) =>
        Assert.Equal(attendu, ScanService.MasquerEmail(email));
}

public class TableauTests
{
    [Fact]
    public async Task LireCsv_trouve_la_colonne_Code_quel_que_soit_le_separateur()
    {
        var csv = "Id;Code;URL\n1;2925AK7VAGNBS34PQD87;https://x/attendance=2925AK7VAGNBS34PQD87\n2;\"296QCTEWDFMK59PBH8UQ\";y\n";
        var lecture = await TableauLecteur.LireAsync(new MemoryStream(Encoding.UTF8.GetBytes(csv)), "codes.csv", CancellationToken.None);

        var colonne = lecture.IndexColonne("code");
        Assert.Equal(1, colonne);
        Assert.Equal(["2925AK7VAGNBS34PQD87", "296QCTEWDFMK59PBH8UQ"], lecture.Lignes.Select(l => l.Cellules[colonne]));
    }

    [Fact]
    public void ExportCsv_neutralise_les_formules_et_echappe_les_separateurs()
    {
        var lignes = new[] { new { Nom = "=HYPERLINK(\"x\")", Club = "Club; Abidjan" } };
        var fichier = TableauExport.Generer(lignes, [new("Nom", l => l.Nom), new("Club", l => l.Club)], FormatExport.Csv, "test");
        var texte = Encoding.UTF8.GetString(fichier.Contenu).TrimStart('\uFEFF');

        Assert.Contains("\"'=HYPERLINK(\"\"x\"\")\"", texte);
        Assert.Contains("\"Club; Abidjan\"", texte);
    }
}
