"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ChoixTheme } from "@/lib/theme";

const OPTIONS: { valeur: ChoixTheme; libelle: string; Icone: typeof Sun }[] = [
  { valeur: "clair", libelle: "Mode clair", Icone: Sun },
  { valeur: "sombre", libelle: "Mode sombre", Icone: Moon },
  { valeur: "auto", libelle: "Automatique (réglage de l'appareil)", Icone: Monitor },
];

/** Sélecteur Clair / Sombre / Automatique. */
export function ChoixTheme({ className = "" }: { className?: string }) {
  const { choix, choisir } = useTheme();
  return (
    <div role="radiogroup" aria-label="Thème d'affichage" className={`inline-flex rounded-lg border border-bordure bg-surface p-0.5 ${className}`}>
      {OPTIONS.map(({ valeur, libelle, Icone }) => {
        const actif = choix === valeur;
        return (
          <button
            key={valeur}
            type="button"
            role="radio"
            aria-checked={actif}
            aria-label={libelle}
            title={libelle}
            onClick={() => choisir(valeur)}
            className={`rounded-md p-1.5 transition ${actif ? "bg-rotary text-white" : "text-gris hover:bg-surface-2 hover:text-encre"}`}
          >
            <Icone size={15} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
