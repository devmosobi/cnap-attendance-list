"use client";

import { useRef, useState } from "react";
import { api, telecharger } from "@/lib/api";
import type { ImportResultat } from "@/lib/types";
import { Alerte, Bouton, Modale } from "./ui";

export function ImportFichier({
  titre,
  chemin,
  consigne,
  modele,
  onTermine,
}: {
  titre: string;
  chemin: string;
  consigne: string;
  /** Chemin de l'API fournissant un modèle vide (le format est ajouté en paramètre). */
  modele?: string;
  onTermine: () => void;
}) {
  const [ouverte, setOuverte] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState<ImportResultat | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);

  const importer = async () => {
    const fichier = champ.current?.files?.[0];
    if (!fichier) return setErreur("Sélectionnez un fichier.");
    setErreur(null);
    setEnvoi(true);
    try {
      const donnees = new FormData();
      donnees.append("fichier", fichier);
      setResultat(await api<ImportResultat>(chemin, { method: "POST", body: donnees }));
      onTermine();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Import impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  const fermer = () => {
    setOuverte(false);
    setResultat(null);
    setErreur(null);
  };

  return (
    <>
      <Bouton variante="secondaire" onClick={() => setOuverte(true)}>
        Importer
      </Bouton>
      <Modale titre={titre} ouverte={ouverte} onFermer={fermer}>
        <p className="mb-2 text-sm text-gris">{consigne}</p>
        <p className="mb-4 text-xs text-gris">Formats acceptés : CSV, Excel (.xlsx) et Excel 97-2003 (.xls). La première ligne doit contenir les en-têtes.</p>
        {modele && (
          <p className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-gris">Modèle :</span>
            <Bouton variante="lien" onClick={() => telecharger(`${modele}?format=Xlsx`)}>
              Excel
            </Bouton>
            <Bouton variante="lien" onClick={() => telecharger(`${modele}?format=Csv`)}>
              CSV
            </Bouton>
          </p>
        )}
        <input
          ref={champ}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="block w-full text-sm"
        />
        {erreur && (
          <div className="mt-3">
            <Alerte>{erreur}</Alerte>
          </div>
        )}
        {resultat && (
          <div className="mt-3 flex flex-col gap-2">
            <Alerte ton="succes">
              {resultat.lignes} ligne(s) lue(s) : {resultat.crees} créée(s)
              {resultat.misAJour > 0 && `, ${resultat.misAJour} mise(s) à jour`}, {resultat.existants} déjà existante(s).
            </Alerte>
            {resultat.erreurs.length > 0 && (
              <Alerte>
                <ul className="list-disc pl-4">
                  {resultat.erreurs.slice(0, 20).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
                {resultat.erreurs.length > 20 && <p>… et {resultat.erreurs.length - 20} autre(s).</p>}
              </Alerte>
            )}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Bouton variante="secondaire" onClick={fermer}>
            Fermer
          </Bouton>
          <Bouton onClick={importer} disabled={envoi}>
            {envoi ? "Import…" : "Importer"}
          </Bouton>
        </div>
      </Modale>
    </>
  );
}
