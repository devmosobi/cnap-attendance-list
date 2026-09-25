"use client";

import Link from "next/link";
import { useState } from "react";
import { ImportFichier } from "@/components/import-fichier";
import { Alerte, Badge, Bouton, Carte, Cellule, Chargement, Champ, EnTete, Pagination, Tableau } from "@/components/ui";
import { construireQuery, telecharger } from "@/lib/api";
import { dateHeure } from "@/lib/format";
import { useDonnees, useEstAdministrateur } from "@/lib/hooks";
import type { Club, PageResultat, QrCodeListe, Seminaire } from "@/lib/types";

export default function PageQrCodes() {
  const estAdmin = useEstAdministrateur();
  const [filtres, setFiltres] = useState({ statut: "", seminaireId: "", clubCode: "", recherche: "" });
  const [page, setPage] = useState(1);
  const seminaires = useDonnees<Seminaire[]>("/api/admin/seminaires");
  const clubs = useDonnees<Club[]>("/api/admin/clubs");
  const liste = useDonnees<PageResultat<QrCodeListe>>(`/api/admin/qrcodes${construireQuery({ ...filtres, page, taille: 50 })}`);

  const modifier = (cle: keyof typeof filtres, valeur: string) => {
    setPage(1);
    setFiltres((f) => ({ ...f, [cle]: valeur }));
  };
  const exporter = (format: string) => telecharger(`/api/admin/qrcodes/export${construireQuery({ ...filtres, format })}`);

  return (
    <>
      <EnTete
        titre="QR Codes"
        description="Billets et participants inscrits."
        actions={
          <>
            {estAdmin && (
              <ImportFichier
                titre="Importer des QR Codes"
                chemin="/api/admin/qrcodes/import"
                consigne="Une colonne « Code » (20 caractères) ; les autres colonnes sont ignorées. Les codes déjà présents sont ignorés."
                onTermine={liste.recharger}
              />
            )}
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Champ libelle="Statut">
            <select className="champ" value={filtres.statut} onChange={(e) => modifier("statut", e.target.value)}>
              <option value="">Tous</option>
              <option value="Actif">Actif</option>
              <option value="Inactif">Inactif</option>
            </select>
          </Champ>
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
          <Champ libelle="Recherche">
            <input className="champ" placeholder="Nom, email ou code" value={filtres.recherche} onChange={(e) => modifier("recherche", e.target.value)} />
          </Champ>
        </div>
      </Carte>

      <Carte>
        {liste.erreur && <Alerte>{liste.erreur}</Alerte>}
        {!liste.donnees && liste.chargement && <Chargement />}
        {liste.donnees && (
          <>
            <Tableau entetes={["Code", "Statut", "Participant", "Club", "Séminaire", "Activation", "Présences"]} vide={liste.donnees.items.length === 0}>
              {liste.donnees.items.map((q) => (
                <tr key={q.code} className="hover:bg-slate-50">
                  <Cellule>
                    <Link href={`/admin/qrcodes/${q.code}`} className="font-mono text-xs font-semibold text-rotary hover:underline">
                      {q.code}
                    </Link>
                  </Cellule>
                  <Cellule>
                    <Badge actif={q.statut === "Actif"} />
                  </Cellule>
                  <Cellule>
                    {q.nomComplet ?? <span className="text-gris">—</span>}
                    {q.email && <span className="block text-xs text-gris">{q.email}</span>}
                  </Cellule>
                  <Cellule>{q.club ?? "—"}</Cellule>
                  <Cellule>{q.seminaire ?? "—"}</Cellule>
                  <Cellule className="whitespace-nowrap tabular-nums">{dateHeure(q.dateActivation)}</Cellule>
                  <Cellule className="tabular-nums">{q.nombrePresences}</Cellule>
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
