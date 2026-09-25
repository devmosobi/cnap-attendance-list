"use client";

import { useState } from "react";
import { Alerte, Badge, Bouton, Carte, Cellule, Chargement, Champ, Confirmer, EnTete, Modale, Tableau } from "@/components/ui";
import { api } from "@/lib/api";
import { useDonnees } from "@/lib/hooks";
import type { Seminaire } from "@/lib/types";

type Formulaire = { id?: string; designation: string; description: string; estActif: boolean };

export default function PageSeminaires() {
  const { donnees, erreur, recharger } = useDonnees<Seminaire[]>("/api/admin/seminaires");
  const [formulaire, setFormulaire] = useState<Formulaire | null>(null);
  const [aSupprimer, setASupprimer] = useState<Seminaire | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const basculer = async (s: Seminaire) => {
    setMessage(null);
    try {
      await api(`/api/admin/seminaires/${s.id}/activation`, { method: "PATCH", body: { estActif: !s.estActif } });
      recharger();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erreur.");
    }
  };

  return (
    <>
      <EnTete
        titre="Séminaires"
        description="Seuls les séminaires actifs sont proposés aux participants."
        actions={<Bouton onClick={() => setFormulaire({ designation: "", description: "", estActif: false })}>Nouveau séminaire</Bouton>}
      />
      {(erreur || message) && (
        <div className="mb-4">
          <Alerte>{erreur ?? message}</Alerte>
        </div>
      )}
      <Carte>
        {!donnees ? (
          <Chargement />
        ) : (
          <Tableau entetes={["Désignation", "Statut", "Sessions", "Inscrits", ""]} vide={donnees.length === 0}>
            {donnees.map((s) => (
              <tr key={s.id}>
                <Cellule>
                  <span className="font-semibold">{s.designation}</span>
                  {s.description && <span className="block text-xs text-gris">{s.description}</span>}
                </Cellule>
                <Cellule>
                  <Badge actif={s.estActif} />
                </Cellule>
                <Cellule className="tabular-nums">{s.nombreSessions}</Cellule>
                <Cellule className="tabular-nums">{s.nombreInscrits}</Cellule>
                <Cellule className="text-right whitespace-nowrap">
                  <Bouton variante="lien" onClick={() => basculer(s)}>
                    {s.estActif ? "Désactiver" : "Activer"}
                  </Bouton>
                  <Bouton
                    variante="lien"
                    className="ml-3"
                    onClick={() => setFormulaire({ id: s.id, designation: s.designation, description: s.description ?? "", estActif: s.estActif })}
                  >
                    Modifier
                  </Bouton>
                  <Bouton variante="lien" className="ml-3 !text-red-700" onClick={() => setASupprimer(s)}>
                    Supprimer
                  </Bouton>
                </Cellule>
              </tr>
            ))}
          </Tableau>
        )}
      </Carte>

      {formulaire && (
        <FormulaireSeminaire
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
        message={`Supprimer le séminaire « ${aSupprimer?.designation} » ? Cette action est impossible s'il a des sessions ou des inscriptions.`}
        libelle="Supprimer"
        onAnnuler={() => setASupprimer(null)}
        onConfirmer={async () => {
          try {
            await api(`/api/admin/seminaires/${aSupprimer!.id}`, { method: "DELETE" });
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

function FormulaireSeminaire({ valeurs, onFermer, onEnregistre }: { valeurs: Formulaire; onFermer: () => void; onEnregistre: () => void }) {
  const [v, setV] = useState(valeurs);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      const corps = { designation: v.designation, description: v.description || null, estActif: v.estActif };
      if (v.id) await api(`/api/admin/seminaires/${v.id}`, { method: "PUT", body: corps });
      else await api("/api/admin/seminaires", { method: "POST", body: corps });
      onEnregistre();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Modale titre={v.id ? "Modifier le séminaire" : "Nouveau séminaire"} ouverte onFermer={onFermer}>
      <form onSubmit={enregistrer} className="flex flex-col gap-4">
        <Champ libelle="Désignation">
          <input className="champ" value={v.designation} onChange={(e) => setV({ ...v, designation: e.target.value })} required maxLength={200} />
        </Champ>
        <Champ libelle="Description">
          <textarea className="champ" rows={3} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
        </Champ>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-rotary" checked={v.estActif} onChange={(e) => setV({ ...v, estActif: e.target.checked })} />
          Actif (proposé aux participants)
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
