import { MapPinCheck, MapPinOff, MapPinX } from "lucide-react";
import { LIBELLES_RESULTAT, formaterDistance } from "@/lib/lieu";
import type { ResultatPosition } from "@/lib/types";

/** Résultat du contrôle de position d'une présence ; « Non contrôlé » reste discret. */
export function BadgeLieu({ resultat, distance }: { resultat: ResultatPosition; distance: number | null }) {
  if (resultat === "NonControle") return <span className="text-xs text-gris">—</span>;

  const style = {
    SurPlace: { classe: "bg-emerald-100 text-emerald-800", Icone: MapPinCheck },
    HorsZone: { classe: "bg-amber-100 text-amber-800", Icone: MapPinX },
    NonLocalise: { classe: "bg-slate-200 text-slate-700", Icone: MapPinOff },
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
