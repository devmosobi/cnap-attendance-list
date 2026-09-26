"use client";

import { Pencil, Plus, Power, PowerOff, Trash } from "lucide-react";
import { useState } from "react";
import { TableDonnees } from "@/components/table-donnees";
import { ImportFichier } from "@/components/import-fichier";
import { ActionIcone, Alerte, Badge, Bouton, Carte, Champ, Confirmer, EnTete, Modale } from "@/components/ui";
import { api } from "@/lib/api";
import { useDonnees } from "@/lib/hooks";
import { LIBELLES_TYPE_CLUB, TYPES_CLUB } from "@/lib/clubs";
import type { Club, TypeClub } from "@/lib/types";

type Formulaire = { existant: boolean; code: string; nom: string; type: TypeClub; estActif: boolean };

export default function PageClubs() {
  const { donnees, erreur, recharger } = useDonnees<Club[]>("/api/admin/clubs");
  const [formulaire, setFormulaire] = useState<Formulaire | null>(null);
  const [aSupprimer, setASupprimer] = useState<Club | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
              consigne="Colonnes « Code », « Nom » et « Type » (Rotary Club, Rotaract Club, Interact Club ou Autres ; vide = Autres). Un club déjà présent (même code) voit seulement son type mis à jour."
              modele="/api/admin/clubs/modele"
              onTermine={recharger}
            />
            <Bouton onClick={() => setFormulaire({ existant: false, code: "", nom: "", type: "Rotary", estActif: true })}>
              <Plus size={16} aria-hidden /> Nouveau club
            </Bouton>
          </>
        }
      />
      {(erreur || message) && (
        <div className="mb-4">
          <Alerte>{message ?? erreur}</Alerte>
        </div>
      )}
      <Carte>
        <TableDonnees
          lignes={donnees}
          chargement={!donnees && !erreur}
          cleLigne={(c) => c.code}
          titreExport="Clubs"
          nomFichier="clubs"
          triInitial={{ cle: "nom", sens: "asc" }}
          colonnes={[
            { cle: "code", titre: "Code", valeur: (c) => c.code, classe: "font-mono text-xs" },
            { cle: "nom", titre: "Nom", valeur: (c) => c.nom, rendu: (c) => <span className="font-semibold">{c.nom}</span> },
            { cle: "type", titre: "Type", valeur: (c) => LIBELLES_TYPE_CLUB[c.type], filtre: "liste" },
            { cle: "statut", titre: "Statut", valeur: (c) => (c.estActif ? "Actif" : "Inactif"), filtre: "liste", rendu: (c) => <Badge actif={c.estActif} /> },
            { cle: "inscrits", titre: "Participants", valeur: (c) => c.nombreInscrits, type: "nombre" },
          ]}
          actions={(c) => (
            <>
              <ActionIcone libelle="Modifier" icone={Pencil} onClick={() => setFormulaire({ existant: true, code: c.code, nom: c.nom, type: c.type, estActif: c.estActif })} />
              <ActionIcone
                libelle={c.estActif ? "Désactiver" : "Activer"}
                icone={c.estActif ? PowerOff : Power}
                ton={c.estActif ? "normal" : "succes"}
                onClick={() => basculer(c)}
              />
              <ActionIcone libelle="Supprimer" icone={Trash} ton="danger" onClick={() => setASupprimer(c)} />
            </>
          )}
        />
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
        await api(`/api/admin/clubs/${encodeURIComponent(v.code)}`, { method: "PUT", body: { nom: v.nom, type: v.type, estActif: v.estActif } });
      else await api("/api/admin/clubs", { method: "POST", body: { code: v.code, nom: v.nom, type: v.type, estActif: v.estActif } });
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
        <Champ libelle="Type">
          <select className="champ" value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as TypeClub })}>
            {TYPES_CLUB.map((t) => (
              <option key={t} value={t}>
                {LIBELLES_TYPE_CLUB[t]}
              </option>
            ))}
          </select>
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
