"use client";

import { useState } from "react";
import { Alerte, Badge, Bouton, Carte, Cellule, Chargement, Champ, Confirmer, EnTete, Modale, Tableau } from "@/components/ui";
import { api, construireQuery } from "@/lib/api";
import { depuisChampDateHeure, plage, versChampDateHeure } from "@/lib/format";
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
  const [seminaireId, setSeminaireId] = useState("");
  const seminaires = useDonnees<Seminaire[]>("/api/admin/seminaires");
  const { donnees, erreur, recharger } = useDonnees<Session[]>(`/api/admin/sessions${construireQuery({ seminaireId })}`);
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
      seminaireId: seminaireId || seminaires.donnees?.[0]?.id || "",
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
          <>
            <select className="champ w-auto" value={seminaireId} onChange={(e) => setSeminaireId(e.target.value)} aria-label="Filtrer par séminaire">
              <option value="">Tous les séminaires</option>
              {seminaires.donnees?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.designation}
                </option>
              ))}
            </select>
            <Bouton onClick={nouvelle} disabled={!seminaires.donnees?.length}>
              Nouvelle session
            </Bouton>
          </>
        }
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
          <Tableau entetes={["Session", "Séminaire", "Horaires", "Statut", "Présences", ""]} vide={donnees.length === 0}>
            {donnees.map((s) => (
              <tr key={s.id}>
                <Cellule>
                  <span className="font-semibold">{s.designation}</span>
                  {s.description && <span className="block text-xs text-gris">{s.description}</span>}
                </Cellule>
                <Cellule>{s.seminaire}</Cellule>
                <Cellule className="whitespace-nowrap tabular-nums">{plage(s.heureDebut, s.heureFin)}</Cellule>
                <Cellule>
                  <Badge actif={s.estActif} oui="Ouverte" non="Fermée" />
                </Cellule>
                <Cellule className="tabular-nums">{s.nombrePresences}</Cellule>
                <Cellule className="text-right whitespace-nowrap">
                  <Bouton variante="lien" onClick={() => basculer(s)}>
                    {s.estActif ? "Fermer" : "Ouvrir"}
                  </Bouton>
                  <Bouton
                    variante="lien"
                    className="ml-3"
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
