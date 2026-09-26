/**
 * Exports générés dans le navigateur (CSV, Excel, PDF) à partir des données affichées :
 * ils reflètent exactement les filtres et le tri appliqués à l'écran.
 * Les bibliothèques lourdes (jsPDF, write-excel-file) ne sont chargées qu'au moment de l'export.
 */

export type TypeCellule = "texte" | "nombre" | "date";
export type ValeurCellule = string | number | Date | null | undefined;
export type ColonneExport = { titre: string; type?: TypeCellule };

export type SectionPdf = {
  titre?: string;
  /** Image PNG (data URL) placée avant le tableau, par exemple un graphique ; largeur et hauteur en pixels (proportions). */
  image?: { url: string; largeur: number; hauteur: number };
  colonnes?: ColonneExport[];
  lignes?: ValeurCellule[][];
};

export type DocumentExport = {
  titre: string;
  /** Ligne d'information sous le titre (filtres appliqués…). */
  sousTitre?: string;
  nomFichier: string;
  colonnes: ColonneExport[];
  lignes: ValeurCellule[][];
};

const BLEU_ROTARY: [number, number, number] = [23, 69, 143];
const FORMAT_DATE = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Africa/Abidjan",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const texteCellule = (v: ValeurCellule) => (v === null || v === undefined ? "" : v instanceof Date ? FORMAT_DATE.format(v) : String(v));

function horodatage() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function telechargerBlob(blob: Blob, nomFichier: string) {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------- CSV

/** CSV « ; » en UTF-8 avec BOM (ouverture directe dans Excel en français), formules neutralisées. */
export function exporterCsv(doc: DocumentExport) {
  const echapper = (valeur: string) => {
    let v = valeur;
    if (v.length > 0 && "=+-@".includes(v[0])) v = `'${v}`;
    return /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const lignes = [doc.colonnes.map((c) => echapper(c.titre)), ...doc.lignes.map((l) => l.map((v) => echapper(texteCellule(v))))];
  const contenu = "﻿" + lignes.map((l) => l.join(";")).join("\r\n");
  telechargerBlob(new Blob([contenu], { type: "text/csv;charset=utf-8" }), `${doc.nomFichier}-${horodatage()}.csv`);
}

// ---------------------------------------------------------------- Excel

export async function exporterXlsx(doc: DocumentExport) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const entete = doc.colonnes.map((c) => ({ value: c.titre, fontWeight: "bold" as const }));
  const corps = doc.lignes.map((ligne) =>
    ligne.map((v, i) => {
      if (v === null || v === undefined || v === "") return null;
      const type = doc.colonnes[i]?.type;
      if (type === "nombre" && typeof v === "number") return { value: v, type: Number };
      if (type === "date" && v instanceof Date) return { value: v, type: Date, format: "dd/mm/yyyy hh:mm" };
      return { value: texteCellule(v), type: String };
    }),
  );
  const largeurs = doc.colonnes.map((c, i) =>
    Math.min(60, Math.max(c.titre.length, ...doc.lignes.slice(0, 500).map((l) => texteCellule(l[i]).length)) + 2),
  );
  const feuille = doc.titre.replace(/[\[\]:*?/\\]/g, " ").slice(0, 31);
  const blob = await writeXlsxFile([entete, ...corps], {
    sheet: feuille,
    columns: largeurs.map((width) => ({ width })),
    stickyRowsCount: 1,
  }).toBlob();
  telechargerBlob(blob, `${doc.nomFichier}-${horodatage()}.xlsx`);
}

// ---------------------------------------------------------------- PDF

let logoCache: Promise<string | null> | null = null;

function chargerLogo(): Promise<string | null> {
  logoCache ??= fetch("/logo-cnap.jpeg")
    .then((r) => (r.ok ? r.blob() : null))
    .then(
      (blob) =>
        blob &&
        new Promise<string>((ok, ko) => {
          const lecteur = new FileReader();
          lecteur.onload = () => ok(lecteur.result as string);
          lecteur.onerror = ko;
          lecteur.readAsDataURL(blob);
        }),
    )
    .catch(() => null);
  return logoCache;
}

export async function exporterPdf(doc: DocumentExport) {
  await exporterPdfSections({
    titre: doc.titre,
    sousTitre: doc.sousTitre,
    nomFichier: doc.nomFichier,
    paysage: doc.colonnes.length > 5,
    sections: [{ colonnes: doc.colonnes, lignes: doc.lignes }],
  });
}

export async function exporterPdfSections({
  titre,
  sousTitre,
  nomFichier,
  sections,
  paysage = false,
}: {
  titre: string;
  sousTitre?: string;
  nomFichier: string;
  sections: SectionPdf[];
  paysage?: boolean;
}) {
  const [{ jsPDF }, { autoTable }, logo] = await Promise.all([import("jspdf"), import("jspdf-autotable"), chargerLogo()]);
  const pdf = new jsPDF({ orientation: paysage ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const largeurPage = pdf.internal.pageSize.getWidth();
  const hauteurPage = pdf.internal.pageSize.getHeight();
  const marge = 12;
  const utile = largeurPage - 2 * marge;

  // En-tête de la première page
  let y = marge;
  if (logo) {
    pdf.addImage(logo, "JPEG", marge, y, 45, 45 * (338 / 1020));
  }
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.setTextColor(23, 35, 60);
  pdf.text(titre, largeurPage - marge, y + 6, { align: "right", maxWidth: utile - 55 });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(91, 100, 117);
  pdf.text(`Généré le ${FORMAT_DATE.format(new Date()).replace(" ", " à ")}`, largeurPage - marge, y + 12, { align: "right" });
  y += 20;
  pdf.setDrawColor(247, 168, 27);
  pdf.setLineWidth(0.8);
  pdf.line(marge, y, largeurPage - marge, y);
  y += 5;
  if (sousTitre) {
    const lignes = pdf.splitTextToSize(sousTitre, utile);
    pdf.text(lignes, marge, y + 3);
    y += lignes.length * 4 + 3;
  }

  for (const section of sections) {
    // Dimensions du graphique : pleine largeur, réduit si nécessaire pour tenir sur une page.
    let image: { largeur: number; hauteur: number } | null = null;
    if (section.image) {
      const hauteurMax = hauteurPage - 2 * marge - 25;
      let largeur = utile;
      let hauteur = (largeur * section.image.hauteur) / section.image.largeur;
      if (hauteur > hauteurMax) {
        largeur *= hauteurMax / hauteur;
        hauteur = hauteurMax;
      }
      image = { largeur, hauteur };
    }

    // Le titre ne reste jamais seul en bas de page : il suit le graphique (ou le début du tableau).
    const hauteurTitre = section.titre ? 9 : 0;
    const espaceRequis = hauteurTitre + (image ? image.hauteur + 4 : 30);
    if (y + espaceRequis > hauteurPage - 15) {
      pdf.addPage();
      y = marge;
    }

    if (section.titre) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(23, 35, 60);
      pdf.text(section.titre, marge, y + 5);
      y += hauteurTitre;
    }
    if (section.image && image) {
      pdf.addImage(section.image.url, "PNG", marge + (utile - image.largeur) / 2, y, image.largeur, image.hauteur);
      y += image.hauteur + 4;
    }
    if (section.colonnes && section.lignes) {
      const colonnes = section.colonnes;
      autoTable(pdf, {
        startY: y,
        margin: { left: marge, right: marge, top: marge, bottom: 14 },
        head: [colonnes.map((c) => c.titre)],
        body: section.lignes.map((l) => l.map(texteCellule)),
        styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.8, textColor: [23, 35, 60], lineColor: [227, 231, 239], lineWidth: 0.1 },
        headStyles: { fillColor: BLEU_ROTARY, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [244, 246, 250] },
        columnStyles: Object.fromEntries(
          colonnes.map((c, i) => [i, c.type === "nombre" ? { halign: "right" as const } : {}]),
        ),
      });
      y = ((pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;
    }
  }

  // Pied de page : pagination
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(91, 100, 117);
    pdf.text("Commission Nationale Apprentissage – District Rotary 9101", marge, hauteurPage - 7);
    pdf.text(`Page ${i} / ${total}`, largeurPage - marge, hauteurPage - 7, { align: "right" });
  }

  pdf.save(`${nomFichier}-${horodatage()}.pdf`);
}
