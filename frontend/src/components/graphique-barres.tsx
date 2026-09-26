"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "@/lib/theme";
import type { RapportLigne } from "@/lib/types";

const PALETTES = {
  clair: { grille: "#e5e8ef", graduation: "#5b6475", libelle: "#17233c", axe: "#c9cfdb", survol: "#e8eef8", fond: "#ffffff", bordure: "#e3e7ef", barre: "#17458f" },
  sombre: { grille: "#283450", graduation: "#9aa6bd", libelle: "#e6ebf5", axe: "#3a4763", survol: "#1b2a4a", fond: "#1a2336", bordure: "#283450", barre: "#6b9cf0" },
};

/**
 * Barres horizontales à une seule série : une teinte, pas de légende (le titre nomme la mesure).
 * libelleAxe : texte court affiché sur l'axe ; le libellé complet reste dans l'infobulle.
 * forcerClair : palette claire quel que soit le thème (capture pour l'export PDF).
 */
export function GraphiqueBarres({
  lignes,
  unite,
  libelleAxe = (v) => v,
  forcerClair = false,
}: {
  lignes: RapportLigne[];
  unite: string;
  libelleAxe?: (libelle: string) => string;
  forcerClair?: boolean;
}) {
  const { sombre } = useTheme();
  const c = PALETTES[sombre && !forcerClair ? "sombre" : "clair"];
  if (lignes.length === 0) return <p className="py-8 text-center text-sm text-gris">Aucune donnée pour le moment.</p>;
  const hauteur = Math.max(160, lignes.length * 36 + 40);
  return (
    <div style={{ height: hauteur }} role="img" aria-label={`Graphique : ${unite}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={lignes} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke={c.grille} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: c.graduation, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="libelle"
            width={170}
            tick={{ fill: c.libelle, fontSize: 12 }}
            axisLine={{ stroke: c.axe }}
            tickLine={false}
            tickFormatter={(v: string) => {
              const court = libelleAxe(v);
              return court.length > 26 ? `${court.slice(0, 25)}…` : court;
            }}
          />
          <Tooltip
            cursor={{ fill: c.survol }}
            formatter={(v: number) => [`${v}`, unite]}
            labelStyle={{ color: c.libelle, fontWeight: 600 }}
            itemStyle={{ color: c.libelle }}
            contentStyle={{ borderRadius: 8, borderColor: c.bordure, backgroundColor: c.fond, fontSize: 13 }}
          />
          <Bar dataKey="valeur" fill={c.barre} radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
