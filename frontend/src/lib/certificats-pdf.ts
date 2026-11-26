import { horodatage } from "./export";

export type TypeCertificat = "participant" | "club";

/**
 * Emplacement du nom sur un certificat préimprimé, mesuré sur le scan du modèle (docs/certificat_*.pdf).
 * La feuille est un A4 portrait sur lequel le certificat est imprimé à l'horizontale, tourné de 90° :
 * le haut du certificat est sur le bord gauche de la feuille et le texte se lit de bas en haut.
 * Coordonnées en mm sur la feuille portrait, depuis le coin supérieur gauche.
 */
export type ModeleCertificat = {
  libelle: string;
  /** Scan du modèle, utilisé uniquement pour l'aperçu (jamais imprimé sur le papier préimprimé). */
  fond: string;
  /** Ligne de base du nom : juste au-dessus du trait « à : ____ » du modèle. */
  ligneDeBase: number;
  /** Milieu du trait, le long de la feuille : le nom y est centré. */
  centre: number;
  /** Longueur disponible : la police est réduite jusqu'à `tailleMin` pour les noms longs. */
  largeurMax: number;
  taillePolice: number;
  tailleMin: number;
  couleur: [number, number, number];
  /**
   * Ligne sous le nom (le club du participant), juste au-dessus du trait (ligne de base `ligneDeBase`) ;
   * le nom est alors `ecart` mm plus haut, en `tailleNomMax` pt au plus pour tenir sous « attribué à : ».
   */
  sousTitre?: { ligneDeBase: number; taille: number; tailleMin: number; ecart: number; tailleNomMax: number };
};

/** Un certificat : le nom en gras et, si le modèle le prévoit, une ligne en dessous (le club). */
export type Certificat = { nom: string; sousTitre?: string | null };

export const MODELES_CERTIFICAT: Record<TypeCertificat, ModeleCertificat> = {
  // Trait du nom à x ≈ 129,9 mm, de y ≈ 73 à 222 mm ; « Ce Certificat est attribué à : » se termine à x ≈ 114,3 mm.
  participant: {
    libelle: "Certificat de participation",
    fond: "/certificats/participation.jpg",
    ligneDeBase: 127,
    centre: 147.5,
    largeurMax: 145,
    taillePolice: 30,
    tailleMin: 16,
    couleur: [0, 0, 0],
    // Club en 12 pt juste au-dessus du trait (x ≈ 129,9) ; nom en 22 pt au plus, 5,8 mm plus haut (environ 15 mm disponibles).
    sousTitre: { ligneDeBase: 128.2, taille: 12, tailleMin: 8, ecart: 5.8, tailleNomMax: 22 },
  },
  // Trait du nom à x ≈ 131,2 mm, de y ≈ 72 à 221 mm ; « Ce Certificat est attribué à : » se termine à x ≈ 115,8 mm.
  club: {
    libelle: "Certificat de remerciements",
    fond: "/certificats/remerciement.jpg",
    ligneDeBase: 128.3,
    centre: 146.5,
    largeurMax: 145,
    taillePolice: 30,
    tailleMin: 16,
    couleur: [0, 0, 0],
  },
};

/**
 * Réglage fin propre à l'imprimante, dans le sens de lecture du certificat (mm).
 * `graisse` : renfort du tracé, de 0 (Helvetica Bold seule) à 4 (très fort).
 */
export type Reglage = { haut: number; droite: number; taillePolice: number; graisse: number };

export const GRAISSES = ["Aucun", "Léger", "Moyen", "Fort", "Très fort"] as const;
export const GRAISSE_PAR_DEFAUT = 2;

export const reglageParDefaut = (modele: ModeleCertificat): Reglage => ({
  haut: 0,
  droite: 0,
  taillePolice: modele.taillePolice,
  graisse: GRAISSE_PAR_DEFAUT,
});

/**
 * Épaisseur du contour ajouté autour des lettres (mm), proportionnelle à la taille de la police :
 * au niveau « Moyen », environ 0,2 mm pour un nom en 30 pt. Rend le texte plus noir sur une imprimante
 * à jet d'encre, sans boucher les lettres des petites tailles.
 */
const epaisseurContour = (graisse: number, taillePt: number) => Math.max(0, Math.min(graisse, GRAISSES.length - 1)) * taillePt * 0.0035;

async function chargerImage(chemin: string): Promise<string> {
  const blob = await (await fetch(chemin)).blob();
  return new Promise((ok, ko) => {
    const lecteur = new FileReader();
    lecteur.onload = () => ok(lecteur.result as string);
    lecteur.onerror = ko;
    lecteur.readAsDataURL(blob);
  });
}

/**
 * Un certificat par page : seul le nom est imprimé, en gras renforcé, à l'emplacement prévu sur le papier préimprimé.
 * `apercu` ajoute le scan du modèle en fond pour vérifier le placement à l'écran.
 */
export async function exporterCertificatsPdf({
  certificats,
  modele,
  reglage,
  apercu = false,
  nomFichier,
}: {
  certificats: Certificat[];
  modele: ModeleCertificat;
  reglage: Reglage;
  apercu?: boolean;
  nomFichier: string;
}) {
  const [{ jsPDF }, fond] = await Promise.all([import("jspdf"), apercu ? chargerImage(modele.fond) : Promise.resolve(null)]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const largeurPage = pdf.internal.pageSize.getWidth();
  const hauteurPage = pdf.internal.pageSize.getHeight();
  pdf.setProperties({ title: modele.libelle });

  // Sens de lecture du certificat → feuille portrait : « haut » vers la gauche (−x), « droite » vers le haut (−y).
  const x = modele.ligneDeBase - reglage.haut;
  const centre = modele.centre - reglage.droite;
  const tailleMax = Math.max(reglage.taillePolice, modele.tailleMin);

  /** Texte tourné de 90° (lecture de bas en haut), centré sur le trait, réduit s'il dépasse la largeur disponible. */
  const ecrire = (texte: string, ligneDeBase: number, tailleDepart: number, tailleMin: number, style: "bold" | "normal") => {
    pdf.setFont("helvetica", style);
    let taille = tailleDepart;
    pdf.setFontSize(taille);
    while (taille > tailleMin && pdf.getTextWidth(texte) > modele.largeurMax) {
      taille -= 0.5;
      pdf.setFontSize(taille);
    }
    const contour = epaisseurContour(reglage.graisse, taille);
    pdf.setLineWidth(contour);
    pdf.text(texte, ligneDeBase, centre + pdf.getTextWidth(texte) / 2, { angle: 90, renderingMode: contour > 0 ? "fillThenStroke" : "fill" });
  };

  certificats.forEach(({ nom, sousTitre }, i) => {
    if (i > 0) pdf.addPage();
    if (fond) pdf.addImage(fond, "JPEG", 0, 0, largeurPage, hauteurPage, "fond", "FAST");
    pdf.setTextColor(...modele.couleur);
    // Contour de la même couleur que le texte, à angles arrondis : les lettres s'épaississent sans pointes.
    pdf.setDrawColor(...modele.couleur);
    pdf.setLineJoin("round");

    const ligne = modele.sousTitre && sousTitre?.trim() ? modele.sousTitre : null;
    if (ligne) {
      const xSousTitre = ligne.ligneDeBase - reglage.haut;
      ecrire(sousTitre!.trim(), xSousTitre, ligne.taille, ligne.tailleMin, "bold");
      ecrire(nom, xSousTitre - ligne.ecart, Math.min(tailleMax, ligne.tailleNomMax), modele.tailleMin, "bold");
    } else {
      ecrire(nom, x, tailleMax, modele.tailleMin, "bold");
    }
  });

  pdf.save(`${nomFichier}${apercu ? "-apercu" : ""}-${horodatage()}.pdf`);
}
