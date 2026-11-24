import { chargerLogo, horodatage } from "./export";

/** Adresse encodée dans le QR Code d'un billet : la page de scan sur le domaine de la console. */
export const urlBillet = (origine: string, code: string) => `${origine}/attendance=${code}`;

const COLONNES = 5;
const LIGNES = 5;
const MARGE = 10; // mm
const LOGO_RATIO = 338 / 1020; // hauteur / largeur de /logo-cnap.jpeg

/**
 * PDF A4 portrait de billets à imprimer puis découper : 5 billets par ligne, 25 par page,
 * séparés par des traits de coupe en pointillés. Chaque billet porte le logo, le titre du
 * séminaire, le QR Code et le code en clair (saisie manuelle si le QR Code est abîmé).
 */
export async function exporterBilletsPdf({
  codes,
  seminaire,
  origine,
  nomFichier = "qrcodes-a-imprimer",
}: {
  codes: string[];
  seminaire: string;
  origine: string;
  nomFichier?: string;
}) {
  const [{ jsPDF }, QRCode, logo] = await Promise.all([import("jspdf"), import("qrcode"), chargerLogo()]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const largeurPage = pdf.internal.pageSize.getWidth();
  const hauteurPage = pdf.internal.pageSize.getHeight();
  const l = (largeurPage - 2 * MARGE) / COLONNES; // 38 mm
  const h = (hauteurPage - 2 * MARGE) / LIGNES; // 55,4 mm
  const tailleQr = 27;
  const largeurLogo = 24;
  const hauteurLogo = largeurLogo * LOGO_RATIO;

  pdf.setProperties({ title: `QR Codes – ${seminaire}` });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6.5);
  const titre: string[] = pdf.splitTextToSize(seminaire, l - 4);
  if (titre.length > 3) {
    titre.length = 3;
    titre[2] = `${titre[2].replace(/\s*\S*$/, "")}…`;
  }

  const parPage = COLONNES * LIGNES;
  for (let debut = 0; debut < codes.length; debut += parPage) {
    if (debut > 0) pdf.addPage();
    const page = codes.slice(debut, debut + parPage);
    const images = await Promise.all(
      page.map((code) => QRCode.toDataURL(urlBillet(origine, code), { errorCorrectionLevel: "M", margin: 0, width: 320 })),
    );

    page.forEach((code, i) => {
      const x = MARGE + (i % COLONNES) * l;
      const y = MARGE + Math.floor(i / COLONNES) * h;
      const centre = x + l / 2;

      if (logo) pdf.addImage(logo, "JPEG", centre - largeurLogo / 2, y + 3, largeurLogo, hauteurLogo, "logo", "FAST");

      pdf.setTextColor(23, 69, 143);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6.5);
      pdf.text(titre, centre, y + 3 + hauteurLogo + 2.8, { align: "center", lineHeightFactor: 1.15 });

      const yQr = y + h - 3 - 3.5 - tailleQr;
      pdf.addImage(images[i], "PNG", centre - tailleQr / 2, yQr, tailleQr, tailleQr, undefined, "FAST");

      pdf.setTextColor(60, 60, 60);
      pdf.setFont("courier", "bold");
      pdf.setFontSize(6.5);
      pdf.text(code, centre, y + h - 3.5, { align: "center" });
    });

    // Traits de coupe autour des billets présents (la dernière page peut être incomplète).
    const n = page.length;
    const rangees = Math.ceil(n / COLONNES);
    const billetsRangee = (r: number) => (r < 0 || r >= rangees ? 0 : Math.min(COLONNES, n - r * COLONNES));
    const rangeesColonne = (c: number) => (c < 0 || c >= COLONNES ? 0 : Math.max(0, Math.ceil((n - c) / COLONNES)));
    pdf.setDrawColor(170, 170, 170);
    pdf.setLineWidth(0.2);
    pdf.setLineDashPattern([1.5, 1.5], 0);
    for (let r = 0; r <= rangees; r++) {
      const largeur = Math.max(billetsRangee(r - 1), billetsRangee(r)) * l;
      pdf.line(MARGE, MARGE + r * h, MARGE + largeur, MARGE + r * h);
    }
    for (let c = 0; c <= COLONNES; c++) {
      const hauteur = Math.max(rangeesColonne(c - 1), rangeesColonne(c)) * h;
      if (hauteur > 0) pdf.line(MARGE + c * l, MARGE, MARGE + c * l, MARGE + hauteur);
    }
    pdf.setLineDashPattern([], 0);
  }

  pdf.save(`${nomFichier}-${horodatage()}.pdf`);
}
