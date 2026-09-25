"use client";

import { useState } from "react";
import { Pencil, Plus, Power, PowerOff, Trash } from "lucide-react";
import { TableDonnees } from "@/components/table-donnees";
import { ActionIcone, Alerte, Badge, Bouton, Carte, Champ, Confirmer, EnTete, Modale } from "@/components/ui";
import { api } from "@/lib/api";
import { dateHeure, depuisChampDateHeure, versChampDateHeure } from "@/lib/format";
import { useDonnees } from "@/lib/hooks";
import type { Seminaire, Session } from "@/lib/types";

type Formulaire = {
  id?: string;
  seminaireId: string;
  designation: string;
  heureDebut: string;
  heureFin: string;
  description: string;
  estActif: boolean;
};

export default function PageSessions() {
  const seminaires = useDonnees<Seminaire[]>("/api/admin/seminaires");
  const { donnees, erreur, recharger } = useDonnees<Session[]>("/api/admin/sessions");
  const [formulaire, setFormulaire] = useState<Formulaire | null>(null);
  const [aSupprimer, setASupprimer] = useState<Session | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const basculer = async (s: Session) => {
    setMessage(null);
    try {
      await api(`/api/admin/sessions/${s.id}/activation`, { method: "PATCH", body: { estActif: !s.estActif } });
      recharger();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erreur.");
    }
  };

  const nouvelle = () =>
    setFormulaire({
      // Séminaire actif proposé par défaut.
      seminaireId: (seminaires.donnees?.find((s) => s.estActif) ?? seminaires.donnees?.[0])?.id ?? "",
      designation: "",
      heureDebut: "",
      heureFin: "",
      description: "",
      estActif: false,
    });

  return (
    <>
      <EnTete
        titre="Sessions de formation"
        description="Activez une session pour ouvrir le pointage, désactivez-la pour le fermer. Heures en heure de Côte d'Ivoire."
        actions={
          <Bouton onClick={nouvelle} disabled={!seminaires.donnees?.length}>
            <Plus size={16} aria-hidden /> Nouvelle session
          </Bouton>
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
          cleLigne={(s) => s.id}
          titreExport="Sessions de formation"
          nomFichier="sessions"
          triInitial={{ cle: "debut", sens: "asc" }}
          colonnes={[
            { cle: "designation", titre: "Session", valeur: (s) => s.designation, rendu: (s) => <span className="font-semibold">{s.designation}</span> },
            { cle: "seminaire", titre: "Séminaire", valeur: (s) => s.seminaire, filtre: "liste" },
            { cle: "debut", titre: "Début", valeur: (s) => s.heureDebut, texte: (s) => dateHeure(s.heureDebut), type: "date", classe: "whitespace-nowrap tabular-nums" },
            { cle: "fin", titre: "Fin", valeur: (s) => s.heureFin, texte: (s) => dateHeure(s.heureFin), type: "date", classe: "whitespace-nowrap tabular-nums" },
            {
              cle: "statut",
              titre: "Statut",
              valeur: (s) => (s.estActif ? "Ouverte" : "Fermée"),
              filtre: "liste",
              rendu: (s) => <Badge actif={s.estActif} oui="Ouverte" non="Fermée" />,
            },
            { cle: "presences", titre: "Présences", valeur: (s) => s.nombrePresences, type: "nombre" },
            { cle: "description", titre: "Description", valeur: (s) => s.description ?? "", classe: "text-gris" },
          ]}
          actions={(s) => (
            <>
              <ActionIcone
                libelle="Modifier"
                icone={Pencil}
                onClick={() =>
                  setFormulaire({
                    id: s.id,
                    seminaireId: s.seminaireId,
                    designation: s.designation,
                    heureDebut: versChampDateHeure(s.heureDebut),
                    heureFin: versChampDateHeure(s.heureFin),
                    description: s.description ?? "",
                    estActif: s.estActif,
                  })
                }
              />
              <ActionIcone
                libelle={s.estActif ? "Fermer le pointage" : "Ouvrir le pointage"}
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
        <FormulaireSession
          valeurs={formulaire}
          seminaires={seminaires.donnees ?? []}
          onFermer={() => setFormulaire(null)}
          onEnregistre={() => {
            setFormulaire(null);
            recharger();
          }}
        />
      )}
      <Confirmer
        ouverte={!!aSupprimer}
        message={`Supprimer la session « ${aSupprimer?.designation} » ? Impossible si des présences sont enregistrées.`}
        libelle="Supprimer"
        onAnnuler={() => setASupprimer(null)}
        onConfirmer={async () => {
          try {
            await api(`/api/admin/sessions/${aSupprimer!.id}`, { method: "DELETE" });
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

function FormulaireSession({
  valeurs,
  seminaires,
  onFermer,
  onEnregistre,
}: {
  valeurs: Formulaire;
  seminaires: Seminaire[];
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const [v, setV] = useState(valeurs);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    if (!v.heureDebut || !v.heureFin) return setErreur("Renseignez l'heure de début et l'heure de fin.");
    setEnvoi(true);
    try {
      const corps = {
        seminaireId: v.seminaireId,
        designation: v.designation,
        heureDebut: depuisChampDateHeure(v.heureDebut),
        heureFin: depuisChampDateHeure(v.heureFin),
        description: v.description || null,
        estActif: v.estActif,
      };
      if (v.id) await api(`/api/admin/sessions/${v.id}`, { method: "PUT", body: corps });
      else await api("/api/admin/sessions", { method: "POST", body: corps });
      onEnregistre();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Modale titre={v.id ? "Modifier la session" : "Nouvelle session"} ouverte onFermer={onFermer}>
      <form onSubmit={enregistrer} className="flex flex-col gap-4">
        <Champ libelle="Séminaire">
          <select className="champ" value={v.seminaireId} onChange={(e) => setV({ ...v, seminaireId: e.target.value })} required>
            {seminaires.map((s) => (
              <option key={s.id} value={s.id}>
                {s.designation}
              </option>
            ))}
          </select>
        </Champ>
        <Champ libelle="Désignation">
          <input className="champ" value={v.designation} onChange={(e) => setV({ ...v, designation: e.target.value })} required maxLength={200} />
        </Champ>
        <div className="grid gap-4 sm:grid-cols-2">
          <Champ libelle="Début">
            <input type="datetime-local" className="champ" value={v.heureDebut} onChange={(e) => setV({ ...v, heureDebut: e.target.value })} required />
          </Champ>
          <Champ libelle="Fin">
            <input type="datetime-local" className="champ" value={v.heureFin} onChange={(e) => setV({ ...v, heureFin: e.target.value })} required />
          </Champ>
        </div>
        <Champ libelle="Description">
          <textarea className="champ" rows={2} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
        </Champ>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-rotary" checked={v.estActif} onChange={(e) => setV({ ...v, estActif: e.target.checked })} />
          Ouverte au pointage
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
