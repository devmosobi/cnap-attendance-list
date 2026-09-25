"use client";

import { useState } from "react";
import { Pencil, Plus, Power, PowerOff, Trash } from "lucide-react";
import { TableDonnees } from "@/components/table-donnees";
import { ActionIcone, Alerte, Badge, Bouton, Carte, Champ, Confirmer, EnTete, Modale } from "@/components/ui";
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
        actions={<Bouton onClick={() => setFormulaire({ designation: "", description: "", estActif: false })}>
            <Plus size={16} aria-hidden /> Nouveau séminaire
          </Bouton>}
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
          cleLigne={(s) => s.id}
          titreExport="Séminaires"
          nomFichier="seminaires"
          triInitial={{ cle: "designation", sens: "asc" }}
          colonnes={[
            {
              cle: "designation",
              titre: "Désignation",
              valeur: (s) => s.designation,
              rendu: (s) => <span className="font-semibold">{s.designation}</span>,
            },
            { cle: "description", titre: "Description", valeur: (s) => s.description ?? "", classe: "text-gris" },
            { cle: "statut", titre: "Statut", valeur: (s) => (s.estActif ? "Actif" : "Inactif"), filtre: "liste", rendu: (s) => <Badge actif={s.estActif} /> },
            { cle: "sessions", titre: "Sessions", valeur: (s) => s.nombreSessions, type: "nombre" },
            { cle: "inscrits", titre: "Inscrits", valeur: (s) => s.nombreInscrits, type: "nombre" },
          ]}
          actions={(s) => (
            <>
              <ActionIcone
                libelle="Modifier"
                icone={Pencil}
                onClick={() => setFormulaire({ id: s.id, designation: s.designation, description: s.description ?? "", estActif: s.estActif })}
              />
              <ActionIcone
                libelle={s.estActif ? "Désactiver" : "Activer"}
                icone={s.estActif ? PowerOff : Power}
                ton={s.estActif ? "normal" : "succes"}
                onClick={() => basculer(s)}
              />
              <ActionIcone libelle="Supprimer" icone={Trash} ton="danger" onClick={() => setASupprimer(s)} />
            </>
          )}
        />
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
