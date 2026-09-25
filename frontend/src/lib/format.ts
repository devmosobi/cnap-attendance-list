/** Côte d'Ivoire : Africa/Abidjan (UTC+0, sans heure d'été). */
export const FUSEAU = "Africa/Abidjan";

const formatHeure = new Intl.DateTimeFormat("fr-FR", { timeZone: FUSEAU, hour: "2-digit", minute: "2-digit" });
const formatDate = new Intl.DateTimeFormat("fr-FR", { timeZone: FUSEAU, day: "2-digit", month: "2-digit", year: "numeric" });
const formatDateLongue = new Intl.DateTimeFormat("fr-FR", { timeZone: FUSEAU, weekday: "long", day: "numeric", month: "long", year: "numeric" });

export const heure = (iso: string) => formatHeure.format(new Date(iso));
export const date = (iso: string) => formatDate.format(new Date(iso));
export const dateLongue = (iso: string) => formatDateLongue.format(new Date(iso));
export const dateHeure = (iso: string | null | undefined) => (iso ? `${date(iso)} ${heure(iso)}` : "—");
export const plage = (debut: string, fin: string) =>
  date(debut) === date(fin) ? `${date(debut)} · ${heure(debut)} – ${heure(fin)}` : `${dateHeure(debut)} – ${dateHeure(fin)}`;

/** Valeur ISO → champ <input type="datetime-local"> en heure d'Abidjan (UTC). */
export function versChampDateHeure(iso: string | null | undefined): string {
  return iso ? new Date(iso).toISOString().slice(0, 16) : "";
}

/** Champ <input type="datetime-local"> (heure d'Abidjan = UTC) → ISO. */
export function depuisChampDateHeure(valeur: string): string {
  return `${valeur}:00Z`;
}
