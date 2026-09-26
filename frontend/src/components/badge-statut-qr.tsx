export const LIBELLES_STATUT_QR: Record<string, string> = {
  Actif: "Actif",
  Inactif: "Inactif",
  Desactive: "Désactivé",
};

export const libelleStatutQr = (statut: string) => LIBELLES_STATUT_QR[statut] ?? statut;

/** Actif : billet utilisé ; Inactif : jamais utilisé ; Désactivé : refusé au scan. */
export function BadgeStatutQr({ statut }: { statut: string }) {
  const classe =
    statut === "Actif"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
      : statut === "Desactive"
        ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
        : "bg-neutre text-encre";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${classe}`}>{libelleStatutQr(statut)}</span>;
}
