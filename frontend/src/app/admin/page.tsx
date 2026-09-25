"use client";

import { useState } from "react";
import { GraphiqueBarres } from "@/components/graphique-barres";
import { Alerte, Bouton, Carte, Cellule, EnTete, Tableau } from "@/components/ui";
import { construireQuery, telecharger } from "@/lib/api";
import { useDonnees } from "@/lib/hooks";
import type { RapportLigne, Seminaire } from "@/lib/types";

export default function TableauDeBord() {
  const [seminaireId, setSeminaireId] = useState("");
  const seminaires = useDonnees<Seminaire[]>("/api/admin/seminaires");
  const q = construireQuery({ seminaireId });

  return (
    <>
      <EnTete
        titre="Tableau de bord"
        description="Inscriptions et présences en temps réel."
        actions={
          <select className="champ w-auto" value={seminaireId} onChange={(e) => setSeminaireId(e.target.value)} aria-label="Filtrer par séminaire">
            <option value="">Tous les séminaires</option>
            {seminaires.donnees?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.designation}
              </option>
            ))}
          </select>
        }
      />
      <div className="grid gap-5">
        <Rapport titre="Présences par session" unite="Présences" chemin={`presences-par-session`} query={q} colonne="Session" />
        <div className="grid gap-5 lg:grid-cols-2">
          <Rapport titre="Inscrits par séminaire" unite="Inscrits" chemin="inscrits-par-seminaire" query="" colonne="Séminaire" />
          <Rapport titre="Inscrits par club" unite="Inscrits" chemin="inscrits-par-club" query={q} colonne="Club" />
        </div>
      </div>
    </>
  );
}

function Rapport({ titre, unite, chemin, query, colonne }: { titre: string; unite: string; chemin: string; query: string; colonne: string }) {
  const { donnees, erreur, recharger } = useDonnees<RapportLigne[]>(`/api/admin/rapports/${chemin}${query}`);
  const [vue, setVue] = useState<"graphique" | "tableau">("graphique");
  const total = donnees?.reduce((s, l) => s + l.valeur, 0) ?? 0;
  const separateur = query ? "&" : "?";

  return (
    <Carte
      titre={`${titre} · ${total}`}
      actions={
        <>
          <Bouton variante="secondaire" taille="petit" onClick={() => setVue(vue === "graphique" ? "tableau" : "graphique")}>
            {vue === "graphique" ? "Tableau" : "Graphique"}
          </Bouton>
          <Bouton variante="secondaire" taille="petit" onClick={recharger}>
            Actualiser
          </Bouton>
          <Bouton variante="secondaire" taille="petit" onClick={() => telecharger(`/api/admin/rapports/${chemin}/export${query}${separateur}format=Xlsx`)}>
            Excel
          </Bouton>
          <Bouton variante="secondaire" taille="petit" onClick={() => telecharger(`/api/admin/rapports/${chemin}/export${query}${separateur}format=Csv`)}>
            CSV
          </Bouton>
        </>
      }
    >
      {erreur && <Alerte>{erreur}</Alerte>}
      {donnees &&
        (vue === "graphique" ? (
          <GraphiqueBarres lignes={donnees} unite={unite} />
        ) : (
          <Tableau entetes={[colonne, unite]} vide={donnees.length === 0}>
            {donnees.map((l) => (
              <tr key={l.cle}>
                <Cellule>{l.libelle}</Cellule>
                <Cellule className="font-semibold tabular-nums">{l.valeur}</Cellule>
              </tr>
            ))}
          </Tableau>
        ))}
    </Carte>
  );
}
