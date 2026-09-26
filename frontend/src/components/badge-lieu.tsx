import { MapPinCheck, MapPinOff, MapPinX } from "lucide-react";
import { LIBELLES_RESULTAT, formaterDistance } from "@/lib/lieu";
import type { ResultatPosition } from "@/lib/types";

/** Résultat du contrôle de position d'une présence ; « Non contrôlé » reste discret. */
export function BadgeLieu({ resultat, distance }: { resultat: ResultatPosition; distance: number | null }) {
  if (resultat === "NonControle") return <span className="text-xs text-gris">—</span>;

  const style = {
    SurPlace: { classe: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300", Icone: MapPinCheck },
    HorsZone: { classe: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300", Icone: MapPinX },
    NonLocalise: { classe: "bg-neutre text-encre", Icone: MapPinOff },
  }[resultat];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${style.classe}`}
      title={distance !== null ? `À ${formaterDistance(distance)} du lieu de la formation` : undefined}
    >
      <style.Icone size={13} aria-hidden />
      {LIBELLES_RESULTAT[resultat]}
      {resultat === "HorsZone" && distance !== null && ` · ${formaterDistance(distance)}`}
    </span>
  );
}
