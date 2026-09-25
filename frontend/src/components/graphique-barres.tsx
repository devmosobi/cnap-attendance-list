"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RapportLigne } from "@/lib/types";

/** Barres horizontales à une seule série : une teinte, pas de légende (le titre nomme la mesure). */
export function GraphiqueBarres({ lignes, unite }: { lignes: RapportLigne[]; unite: string }) {
  if (lignes.length === 0) return <p className="py-8 text-center text-sm text-gris">Aucune donnée pour le moment.</p>;
  const hauteur = Math.max(160, lignes.length * 36 + 40);
  return (
    <div style={{ height: hauteur }} role="img" aria-label={`Graphique : ${unite}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={lignes} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke="#e5e8ef" />
          <XAxis type="number" allowDecimals={false} tick={{ fill: "#5b6475", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="libelle"
            width={170}
            tick={{ fill: "#17233c", fontSize: 12 }}
            axisLine={{ stroke: "#c9cfdb" }}
            tickLine={false}
            tickFormatter={(v: string) => (v.length > 26 ? `${v.slice(0, 25)}…` : v)}
          />
          <Tooltip
            cursor={{ fill: "#e8eef8" }}
            formatter={(v: number) => [`${v}`, unite]}
            labelStyle={{ color: "#17233c", fontWeight: 600 }}
            contentStyle={{ borderRadius: 8, borderColor: "#e3e7ef", fontSize: 13 }}
          />
          <Bar dataKey="valeur" fill="#17458f" radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
