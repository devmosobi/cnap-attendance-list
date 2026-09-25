"use client";

import Link from "next/link";
import { useState } from "react";
import { Alerte, Bouton, Carte, Cellule, Chargement, Champ, EnTete, Pagination, Tableau } from "@/components/ui";
import { construireQuery, telecharger } from "@/lib/api";
import { dateHeure } from "@/lib/format";
import { useDonnees } from "@/lib/hooks";
import type { Club, PageResultat, PresenceListe, Seminaire, Session } from "@/lib/types";

export default function PagePresences() {
  const [filtres, setFiltres] = useState({ seminaireId: "", sessionId: "", clubCode: "", du: "", au: "", recherche: "" });
  const [page, setPage] = useState(1);
  const seminaires = useDonnees<Seminaire[]>("/api/admin/seminaires");
  const sessions = useDonnees<Session[]>(`/api/admin/sessions${construireQuery({ seminaireId: filtres.seminaireId })}`);
  const clubs = useDonnees<Club[]>("/api/admin/clubs");

  const parametres = {
    ...filtres,
    du: filtres.du ? `${filtres.du}T00:00:00Z` : "",
    au: filtres.au ? `${filtres.au}T23:59:59Z` : "",
  };
  const liste = useDonnees<PageResultat<PresenceListe>>(`/api/admin/presences${construireQuery({ ...parametres, page, taille: 50 })}`);

  const modifier = (cle: keyof typeof filtres, valeur: string) => {
    setPage(1);
    setFiltres((f) => ({ ...f, [cle]: valeur, ...(cle === "seminaireId" ? { sessionId: "" } : {}) }));
  };
  const exporter = (format: string) => telecharger(`/api/admin/presences/export${construireQuery({ ...parametres, format })}`);

  return (
    <>
      <EnTete
        titre="Suivi des présences"
        actions={
          <>
            <Bouton variante="secondaire" onClick={liste.recharger}>
              Actualiser
            </Bouton>
            <Bouton variante="secondaire" onClick={() => exporter("Xlsx")}>
              Export Excel
            </Bouton>
            <Bouton variante="secondaire" onClick={() => exporter("Csv")}>
              Export CSV
            </Bouton>
          </>
        }
      />
      <Carte className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Champ libelle="Séminaire">
            <select className="champ" value={filtres.seminaireId} onChange={(e) => modifier("seminaireId", e.target.value)}>
              <option value="">Tous</option>
              {seminaires.donnees?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.designation}
                </option>
              ))}
            </select>
          </Champ>
          <Champ libelle="Session">
            <select className="champ" value={filtres.sessionId} onChange={(e) => modifier("sessionId", e.target.value)}>
              <option value="">Toutes</option>
              {sessions.donnees?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.designation}
                </option>
              ))}
            </select>
          </Champ>
          <Champ libelle="Club">
            <select className="champ" value={filtres.clubCode} onChange={(e) => modifier("clubCode", e.target.value)}>
              <option value="">Tous</option>
              {clubs.donnees?.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.nom}
                </option>
              ))}
            </select>
          </Champ>
          <Champ libelle="Du">
            <input type="date" className="champ" value={filtres.du} onChange={(e) => modifier("du", e.target.value)} />
          </Champ>
          <Champ libelle="Au">
            <input type="date" className="champ" value={filtres.au} onChange={(e) => modifier("au", e.target.value)} />
          </Champ>
          <Champ libelle="Recherche">
            <input
              className="champ"
              placeholder="Nom, email ou code"
              value={filtres.recherche}
              onChange={(e) => modifier("recherche", e.target.value)}
            />
          </Champ>
        </div>
      </Carte>

      <Carte>
        {liste.erreur && <Alerte>{liste.erreur}</Alerte>}
        {!liste.donnees && liste.chargement && <Chargement />}
        {liste.donnees && (
          <>
            <Tableau entetes={["Nom complet", "Club", "Séminaire", "Session", "Heure de pointage"]} vide={liste.donnees.items.length === 0}>
              {liste.donnees.items.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <Cellule>
                    <Link href={`/admin/qrcodes/${p.qrCode}`} className="font-semibold text-rotary hover:underline">
                      {p.nomComplet}
                    </Link>
                    <span className="block text-xs text-gris">{p.email}</span>
                  </Cellule>
                  <Cellule>{p.club}</Cellule>
                  <Cellule>{p.seminaire}</Cellule>
                  <Cellule>{p.session}</Cellule>
                  <Cellule className="whitespace-nowrap tabular-nums">{dateHeure(p.heureDePointage)}</Cellule>
                </tr>
              ))}
            </Tableau>
            <Pagination page={page} taille={50} total={liste.donnees.total} onPage={setPage} />
          </>
        )}
      </Carte>
    </>
  );
}
