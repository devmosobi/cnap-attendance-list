"use client";

import { useMemo, useState } from "react";
import { ImportFichier } from "@/components/import-fichier";
import { Alerte, Badge, Bouton, Carte, Cellule, Chargement, Champ, Confirmer, EnTete, Modale, Tableau } from "@/components/ui";
import { api } from "@/lib/api";
import { useDonnees } from "@/lib/hooks";
import type { Club } from "@/lib/types";

type Formulaire = { existant: boolean; code: string; nom: string; estActif: boolean };

export default function PageClubs() {
  const { donnees, erreur, recharger } = useDonnees<Club[]>("/api/admin/clubs");
  const [recherche, setRecherche] = useState("");
  const [formulaire, setFormulaire] = useState<Formulaire | null>(null);
  const [aSupprimer, setASupprimer] = useState<Club | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const filtres = useMemo(() => {
    const r = recherche.trim().toLowerCase();
    return (donnees ?? []).filter((c) => !r || c.nom.toLowerCase().includes(r) || c.code.toLowerCase().includes(r));
  }, [donnees, recherche]);

  const basculer = async (c: Club) => {
    setMessage(null);
    try {
      await api(`/api/admin/clubs/${encodeURIComponent(c.code)}/activation`, { method: "PATCH", body: { estActif: !c.estActif } });
      recharger();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erreur.");
    }
  };

  return (
    <>
      <EnTete
        titre="Clubs"
        description="Seuls les clubs actifs sont proposés aux participants."
        actions={
          <>
            <ImportFichier
              titre="Importer des clubs"
              chemin="/api/admin/clubs/import"
              consigne="Deux colonnes : « Code » et « Nom » (les variantes « Code club », « Nom du club » ou « Club » sont reconnues). Les clubs déjà présents (même code ou même nom) sont ignorés."
              modele="/api/admin/clubs/modele"
              onTermine={recharger}
            />
            <Bouton onClick={() => setFormulaire({ existant: false, code: "", nom: "", estActif: true })}>Nouveau club</Bouton>
          </>
        }
      />
      {(erreur || message) && (
        <div className="mb-4">
          <Alerte>{erreur ?? message}</Alerte>
        </div>
      )}
      <Carte>
        <input className="champ mb-4 sm:max-w-xs" placeholder="Rechercher un club…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        {!donnees ? (
          <Chargement />
        ) : (
          <Tableau entetes={["Code", "Nom", "Statut", "Inscrits", ""]} vide={filtres.length === 0}>
            {filtres.map((c) => (
              <tr key={c.code}>
                <Cellule className="font-mono text-xs">{c.code}</Cellule>
                <Cellule className="font-semibold">{c.nom}</Cellule>
                <Cellule>
                  <Badge actif={c.estActif} />
                </Cellule>
                <Cellule className="tabular-nums">{c.nombreInscrits}</Cellule>
                <Cellule className="text-right whitespace-nowrap">
                  <Bouton variante="lien" onClick={() => basculer(c)}>
                    {c.estActif ? "Désactiver" : "Activer"}
                  </Bouton>
                  <Bouton variante="lien" className="ml-3" onClick={() => setFormulaire({ existant: true, code: c.code, nom: c.nom, estActif: c.estActif })}>
                    Modifier
                  </Bouton>
                  <Bouton variante="lien" className="ml-3 !text-red-700" onClick={() => setASupprimer(c)}>
                    Supprimer
                  </Bouton>
                </Cellule>
              </tr>
            ))}
          </Tableau>
        )}
      </Carte>

      {formulaire && (
        <FormulaireClub
          valeurs={formulaire}
          onFermer={() => setFormulaire(null)}
          onEnregistre={() => {
            setFormulaire(null);
            recharger();
          }}
        />
      )}
      <Confirmer
        ouverte={!!aSupprimer}
        message={`Supprimer le club « ${aSupprimer?.nom} » ? Impossible si des participants y sont rattachés.`}
        libelle="Supprimer"
        onAnnuler={() => setASupprimer(null)}
        onConfirmer={async () => {
          try {
            await api(`/api/admin/clubs/${encodeURIComponent(aSupprimer!.code)}`, { method: "DELETE" });
            recharger();
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Suppression impossible.");
          }
          setASupprimer(null);
        }}
      />
    </>
  );
}

function FormulaireClub({ valeurs, onFermer, onEnregistre }: { valeurs: Formulaire; onFermer: () => void; onEnregistre: () => void }) {
  const [v, setV] = useState(valeurs);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      if (v.existant)
        await api(`/api/admin/clubs/${encodeURIComponent(v.code)}`, { method: "PUT", body: { nom: v.nom, estActif: v.estActif } });
      else await api("/api/admin/clubs", { method: "POST", body: { code: v.code, nom: v.nom, estActif: v.estActif } });
      onEnregistre();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Modale titre={v.existant ? "Modifier le club" : "Nouveau club"} ouverte onFermer={onFermer}>
      <form onSubmit={enregistrer} className="flex flex-col gap-4">
        <Champ libelle="Code" aide={v.existant ? "Le code ne peut pas être modifié." : "Lettres, chiffres, - ou _ (20 caractères max)."}>
          <input
            className="champ font-mono"
            value={v.code}
            onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase() })}
            disabled={v.existant}
            required
            maxLength={20}
          />
        </Champ>
        <Champ libelle="Nom">
          <input className="champ" value={v.nom} onChange={(e) => setV({ ...v, nom: e.target.value })} required maxLength={200} />
        </Champ>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-rotary" checked={v.estActif} onChange={(e) => setV({ ...v, estActif: e.target.checked })} />
          Actif
        </label>
        {erreur && <Alerte>{erreur}</Alerte>}
        <div className="flex justify-end gap-2">
          <Bouton variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton type="submit" disabled={envoi}>
            Enregistrer
          </Bouton>
        </div>
      </form>
    </Modale>
  );
}
