import type { ControlePosition, ResultatPosition } from "./types";

export const RAYON_MIN = 50;
export const RAYON_MAX = 500;

export const LIBELLES_CONTROLE: Record<ControlePosition, string> = {
  Desactive: "Désactivé",
  Signaler: "Signaler les présences hors zone",
  Bloquer: "Refuser les présences hors zone",
};

export const LIBELLES_CONTROLE_COURTS: Record<ControlePosition, string> = {
  Desactive: "Désactivé",
  Signaler: "Signalement",
  Bloquer: "Blocage",
};

export const LIBELLES_RESULTAT: Record<ResultatPosition, string> = {
  NonControle: "Non contrôlé",
  SurPlace: "Sur place",
  HorsZone: "Hors zone",
  NonLocalise: "Non localisée",
};

export function formaterDistance(metres: number | null | undefined): string {
  if (metres === null || metres === undefined) return "";
  return metres < 1000 ? `${metres} m` : `${(metres / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`;
}

export type Position = { latitude: number; longitude: number; precision: number | null };

/** Position du téléphone, ou null si refusée, indisponible ou trop longue à obtenir. */
export function obtenirPosition(delaiMs = 12_000): Promise<Position | null> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resoudre) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resoudre({ latitude: p.coords.latitude, longitude: p.coords.longitude, precision: p.coords.accuracy ?? null }),
      () => resoudre(null),
      { enableHighAccuracy: true, timeout: delaiMs, maximumAge: 60_000 },
    ),
  );
}

/**
 * Coordonnées saisies ou collées depuis une carte : « 5.3240, -4.0180 », « 5,3240; -4,0180 » ou « 5.3240 -4.0180 ».
 * Retourne null si le texte n'est pas interprétable.
 */
export function lireCoordonnees(texte: string): { latitude: number; longitude: number } | null {
  const t = texte.trim();
  if (!t) return null;
  const parties = t.includes(";") ? t.split(";") : t.includes(".") ? t.split(/[,\s]+/) : t.split(/\s+/);
  if (parties.length !== 2) return null;
  const [latitude, longitude] = parties.map((p) => Number(p.trim().replace(",", ".")));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}
