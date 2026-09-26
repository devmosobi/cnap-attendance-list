"use client";

import { MapPinCheck, MapPinOff, MapPinX, MapPin } from "lucide-react";
import { TableDonnees } from "./table-donnees";
import { Alerte, Carte } from "./ui";
import { LIBELLES_RESULTAT } from "@/lib/lieu";
import type { RapportLieu, ResultatPosition } from "@/lib/types";

export type TotauxLieu = Record<ResultatPosition, number> & { total: number };

export function totauxLieu(lignes: RapportLieu[] | null): TotauxLieu {
  const t = { SurPlace: 0, HorsZone: 0, NonLocalise: 0, NonControle: 0, total: 0 };
  for (const l of lignes ?? []) {
    t.SurPlace += l.surPlace;
    t.HorsZone += l.horsZone;
    t.NonLocalise += l.nonLocalise;
    t.NonControle += l.nonControle;
  }
  t.total = t.SurPlace + t.HorsZone + t.NonLocalise + t.NonControle;
  return t;
}

export function totalInvalidees(lignes: RapportLieu[] | null) {
  return (lignes ?? []).reduce((s, l) => s + l.invalidees, 0);
}

export const pourcentage = (n: number, total: number) =>
  total === 0 ? "—" : `${((n / total) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;

// Couleurs d'état réservées (vert = conforme, ambre = à vérifier), toujours accompagnées d'une icône et d'un libellé.
const INDICATEURS: { cle: ResultatPosition; Icone: typeof MapPin; classe: string; aide: string }[] = [
  { cle: "SurPlace", Icone: MapPinCheck, classe: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800", aide: "Position dans le rayon du lieu" },
  { cle: "HorsZone", Icone: MapPinX, classe: "text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800", aide: "À vérifier : position hors du rayon" },
  { cle: "NonLocalise", Icone: MapPinOff, classe: "text-encre bg-surface-2 border-bordure", aide: "Position refusée ou indisponible" },
  { cle: "NonControle", Icone: MapPin, classe: "text-gris bg-surface border-bordure", aide: "Séminaire sans contrôle du lieu" },
];

export function RapportLieuCarte({ lignes, erreur, filtre }: { lignes: RapportLieu[] | null; erreur: string | null; filtre?: string }) {
  const t = totauxLieu(lignes);
  const aucunControle = lignes !== null && t.total > 0 && t.NonControle === t.total;
  const invalidees = totalInvalidees(lignes);

  return (
    <Carte titre={`Contrôle du lieu · ${t.total} présence${t.total > 1 ? "s" : ""}`}>
      {erreur && <Alerte>{erreur}</Alerte>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {INDICATEURS.map(({ cle, Icone, classe, aide }) => (
          <div key={cle} className={`rounded-xl border p-4 ${classe}`}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Icone size={16} aria-hidden />
              {LIBELLES_RESULTAT[cle]}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-encre tabular-nums">{t[cle]}</span>
              <span className="text-sm text-gris tabular-nums">{pourcentage(t[cle], t.total)}</span>
            </div>
            <p className="mt-1 text-xs text-gris">{aide}</p>
          </div>
        ))}
      </div>
      {invalidees > 0 && (
        <p className="mt-3 text-sm text-gris">
          {invalidees} présence{invalidees > 1 ? "s" : ""} invalidée{invalidees > 1 ? "s" : ""} (Suivi des présences), exclue
          {invalidees > 1 ? "s" : ""} de ces chiffres.
        </p>
      )}
      {aucunControle && (
        <p className="mt-3 text-sm text-gris">
          Le contrôle du lieu n&apos;est activé sur aucun séminaire concerné : activez-le dans Séminaires &gt; Modifier &gt; « Lieu de la formation ».
        </p>
      )}
      {lignes && (
        <details className="group mt-4 border-t border-bordure-douce pt-3" open={t.HorsZone > 0 || undefined}>
          <summary className="cursor-pointer text-sm font-semibold text-lien select-none">
            <span className="group-open:hidden">Afficher le détail par session</span>
            <span className="hidden group-open:inline">Masquer le détail par session</span>
          </summary>
          <div className="mt-3">
            <TableDonnees
              lignes={lignes}
              cleLigne={(l) => l.cle}
              titreExport={filtre ? `Contrôle du lieu par session – ${filtre}` : "Contrôle du lieu par session"}
              nomFichier="controle-lieu-par-session"
              triInitial={{ cle: "horsZone", sens: "desc" }}
              colonnes={[
                { cle: "session", titre: "Session", valeur: (l) => l.session },
                { cle: "surPlace", titre: "Sur place", valeur: (l) => l.surPlace, type: "nombre", filtre: false },
                {
                  cle: "horsZone",
                  titre: "Hors zone",
                  valeur: (l) => l.horsZone,
                  type: "nombre",
                  filtre: false,
                  rendu: (l) => <span className={l.horsZone > 0 ? "font-bold text-amber-800 dark:text-amber-300" : ""}>{l.horsZone}</span>,
                },
                { cle: "nonLocalise", titre: "Non localisée", valeur: (l) => l.nonLocalise, type: "nombre", filtre: false },
                { cle: "nonControle", titre: "Non contrôlé", valeur: (l) => l.nonControle, type: "nombre", filtre: false },
                {
                  cle: "total",
                  titre: "Total",
                  valeur: (l) => l.surPlace + l.horsZone + l.nonLocalise + l.nonControle,
                  type: "nombre",
                  filtre: false,
                  classe: "font-semibold",
                },
                { cle: "invalidees", titre: "Invalidées", valeur: (l) => l.invalidees, type: "nombre", filtre: false, classe: "text-gris" },
              ]}
            />
          </div>
        </details>
      )}
    </Carte>
  );
}
