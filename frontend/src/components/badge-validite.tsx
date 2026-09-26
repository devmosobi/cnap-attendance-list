import { Ban } from "lucide-react";

export const libelleValidite = (estInvalidee: boolean) => (estInvalidee ? "Invalidée" : "Valide");

/** Une présence invalidée est conservée mais exclue des statistiques ; le motif s'affiche au survol. */
export function BadgeValidite({ estInvalidee, motif, detail }: { estInvalidee: boolean; motif?: string | null; detail?: string }) {
  if (!estInvalidee) return <span className="text-xs text-gris">Valide</span>;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-red-800 dark:bg-red-900/40 dark:text-red-300"
      title={[motif, detail].filter(Boolean).join(" · ") || undefined}
    >
      <Ban size={12} aria-hidden />
      Invalidée
    </span>
  );
}
