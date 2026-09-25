using System.Globalization;
using System.Text;
using ClosedXML.Excel;
using ExcelDataReader;
using ExcelDataReader.Exceptions;
using Cnap.Attendance.Core.Common;

namespace Cnap.Attendance.Infrastructure.Services;

public enum FormatExport
{
    Csv,
    Xlsx
}

public record ColonneExport<T>(string Entete, Func<T, object?> Valeur);

public record FichierExport(byte[] Contenu, string ContentType, string NomFichier);

/// <summary>Génère des exports CSV (séparateur « ; », UTF-8 avec BOM, lisible par Excel FR) ou XLSX.</summary>
public static class TableauExport
{
    public static FichierExport Generer<T>(IEnumerable<T> lignes, IReadOnlyList<ColonneExport<T>> colonnes, FormatExport format, string nomBase)
    {
        var horodatage = Horloge.EnHeureLocale(DateTimeOffset.UtcNow).ToString("yyyyMMdd-HHmm");
        return format == FormatExport.Xlsx
            ? new FichierExport(Xlsx(lignes, colonnes, nomBase), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"{nomBase}-{horodatage}.xlsx")
            : new FichierExport(Csv(lignes, colonnes), "text/csv; charset=utf-8", $"{nomBase}-{horodatage}.csv");
    }

    private static byte[] Csv<T>(IEnumerable<T> lignes, IReadOnlyList<ColonneExport<T>> colonnes)
    {
        var sb = new StringBuilder();
        sb.AppendLine(string.Join(';', colonnes.Select(c => Echapper(c.Entete))));
        foreach (var ligne in lignes)
            sb.AppendLine(string.Join(';', colonnes.Select(c => Echapper(Formater(c.Valeur(ligne))))));
        return new UTF8Encoding(encoderShouldEmitUTF8Identifier: true).GetPreamble()
            .Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
    }

    private static byte[] Xlsx<T>(IEnumerable<T> lignes, IReadOnlyList<ColonneExport<T>> colonnes, string nomFeuille)
    {
        using var classeur = new XLWorkbook();
        var feuille = classeur.Worksheets.Add(nomFeuille.Length > 31 ? nomFeuille[..31] : nomFeuille);
        for (var i = 0; i < colonnes.Count; i++)
            feuille.Cell(1, i + 1).Value = colonnes[i].Entete;
        feuille.Row(1).Style.Font.Bold = true;

        var r = 2;
        foreach (var ligne in lignes)
        {
            for (var i = 0; i < colonnes.Count; i++)
            {
                var cellule = feuille.Cell(r, i + 1);
                switch (colonnes[i].Valeur(ligne))
                {
                    case null: break;
                    case int n: cellule.Value = n; break;
                    case DateTimeOffset d:
                        cellule.Value = Horloge.EnHeureLocale(d).DateTime;
                        cellule.Style.DateFormat.Format = "dd/mm/yyyy hh:mm";
                        break;
                    case var v: cellule.Value = v.ToString(); break;
                }
            }
            r++;
        }
        feuille.Range(1, 1, Math.Max(r - 1, 1), colonnes.Count).SetAutoFilter();
        feuille.Columns().AdjustToContents(1, Math.Min(r, 500));
        feuille.SheetView.FreezeRows(1);

        using var flux = new MemoryStream();
        classeur.SaveAs(flux);
        return flux.ToArray();
    }

    private static string Formater(object? valeur) => valeur switch
    {
        null => string.Empty,
        DateTimeOffset d => Horloge.EnHeureLocale(d).ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
        _ => Convert.ToString(valeur, CultureInfo.InvariantCulture) ?? string.Empty
    };

    private static string Echapper(string valeur)
    {
        // Neutralise l'injection de formules à l'ouverture dans un tableur.
        if (valeur.Length > 0 && "=+-@".Contains(valeur[0]))
            valeur = "'" + valeur;
        return valeur.IndexOfAny([';', '"', '\n', '\r']) >= 0 ? $"\"{valeur.Replace("\"", "\"\"")}\"" : valeur;
    }
}

/// <summary>Lecture d'un fichier CSV ou Excel dont la première ligne contient les en-têtes.</summary>
public class TableauLecteur
{
    public IReadOnlyList<string> Entetes { get; private init; } = [];
    public IReadOnlyList<(int Numero, IReadOnlyList<string?> Cellules)> Lignes { get; private init; } = [];

    static TableauLecteur()
    {
        // Encodages Windows (cp1252) : CSV enregistrés par Excel et fichiers .xls.
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
    }

    /// <summary>Index de la première colonne dont l'en-tête correspond à l'un des noms (casse et accents ignorés).</summary>
    public int IndexColonne(params string[] noms)
    {
        var recherches = noms.Select(Normaliser).ToList();
        for (var i = 0; i < Entetes.Count; i++)
            if (recherches.Contains(Normaliser(Entetes[i])))
                return i;
        return -1;
    }

    private static string Normaliser(string valeur)
    {
        var decompose = valeur.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(decompose.Length);
        foreach (var c in decompose)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark) continue;
            sb.Append(char.IsLetterOrDigit(c) ? c : ' ');
        }
        return string.Join(' ', sb.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    public static async Task<TableauLecteur> LireAsync(Stream flux, string nomFichier, CancellationToken ct)
    {
        var extension = Path.GetExtension(nomFichier).ToLowerInvariant();
        using var memoire = new MemoryStream();
        await flux.CopyToAsync(memoire, ct);
        memoire.Position = 0;

        return extension switch
        {
            ".xlsx" => LireXlsx(memoire),
            ".xls" => LireXls(memoire),
            ".csv" or ".txt" => LireCsv(memoire),
            _ => throw new RegleMetierException("Format non pris en charge : utilisez un fichier .csv, .xlsx ou .xls.")
        };
    }

    private static TableauLecteur LireXlsx(Stream flux)
    {
        using var classeur = new XLWorkbook(flux);
        var feuille = classeur.Worksheets.First();
        var plage = feuille.RangeUsed();
        if (plage is null) return new TableauLecteur();

        var nbColonnes = plage.ColumnCount();
        var lignes = plage.Rows().ToList();
        var entetes = lignes[0].Cells(1, nbColonnes).Select(c => c.GetString()).ToList();
        var donnees = lignes.Skip(1)
            .Select(l => (l.RowNumber(), (IReadOnlyList<string?>)l.Cells(1, nbColonnes).Select(c => (string?)c.GetString()).ToList()))
            .ToList();
        return new TableauLecteur { Entetes = entetes, Lignes = donnees };
    }

    /// <summary>Ancien format Excel 97-2003 (BIFF), lu avec ExcelDataReader.</summary>
    private static TableauLecteur LireXls(Stream flux)
    {
        IExcelDataReader lecteur;
        try
        {
            lecteur = ExcelReaderFactory.CreateBinaryReader(flux);
        }
        catch (Exception ex) when (ex is HeaderException or InvalidOperationException or NotSupportedException)
        {
            throw new RegleMetierException("Fichier .xls illisible : vérifiez qu'il s'agit bien d'un classeur Excel 97-2003.");
        }

        using (lecteur)
        {
            List<string>? entetes = null;
            var donnees = new List<(int, IReadOnlyList<string?>)>();
            var numero = 0;
            while (lecteur.Read())
            {
                numero++;
                var cellules = Enumerable.Range(0, lecteur.FieldCount)
                    .Select(i => lecteur.GetValue(i) switch
                    {
                        null => null,
                        double d => d.ToString(CultureInfo.InvariantCulture),
                        DateTime dt => dt.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture),
                        var v => Convert.ToString(v, CultureInfo.InvariantCulture)?.Trim()
                    })
                    .ToList();
                if (entetes is null)
                {
                    if (cellules.All(string.IsNullOrWhiteSpace)) continue;
                    entetes = cellules.Select(c => c ?? string.Empty).ToList();
                }
                else
                {
                    donnees.Add((numero, cellules));
                }
            }
            return new TableauLecteur { Entetes = entetes ?? [], Lignes = donnees };
        }
    }

    private static TableauLecteur LireCsv(Stream flux)
    {
        var contenu = DecoderTexte(((MemoryStream)flux).ToArray());
        var lignesBrutes = contenu.Split('\n').Select(l => l.TrimEnd('\r')).ToList();
        if (lignesBrutes.Count == 0) return new TableauLecteur();

        var entete = lignesBrutes[0];
        var separateur = entete.Contains(';') ? ';' : entete.Contains('\t') ? '\t' : ',';
        var donnees = new List<(int, IReadOnlyList<string?>)>();
        for (var i = 1; i < lignesBrutes.Count; i++)
        {
            if (string.IsNullOrWhiteSpace(lignesBrutes[i])) continue;
            donnees.Add((i + 1, Decouper(lignesBrutes[i], separateur)));
        }
        return new TableauLecteur { Entetes = Decouper(entete, separateur).Select(e => e ?? string.Empty).ToList(), Lignes = donnees };
    }

    /// <summary>UTF-8 (avec ou sans BOM), sinon Windows-1252 : encodage des CSV enregistrés par Excel en français.</summary>
    private static string DecoderTexte(byte[] octets)
    {
        try
        {
            var texte = new UTF8Encoding(false, throwOnInvalidBytes: true).GetString(octets);
            return texte.TrimStart('﻿');
        }
        catch (DecoderFallbackException)
        {
            return Encoding.GetEncoding(1252).GetString(octets);
        }
    }

    private static List<string?> Decouper(string ligne, char separateur)
    {
        var cellules = new List<string?>();
        var courant = new StringBuilder();
        var entreGuillemets = false;
        for (var i = 0; i < ligne.Length; i++)
        {
            var c = ligne[i];
            if (c == '"')
            {
                if (entreGuillemets && i + 1 < ligne.Length && ligne[i + 1] == '"') { courant.Append('"'); i++; }
                else entreGuillemets = !entreGuillemets;
            }
            else if (c == separateur && !entreGuillemets)
            {
                cellules.Add(courant.ToString().Trim());
                courant.Clear();
            }
            else courant.Append(c);
        }
        cellules.Add(courant.ToString().Trim());
        return cellules;
    }
}
