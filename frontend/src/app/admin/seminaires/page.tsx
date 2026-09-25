"use client";

import { Crosshair, MapPin, Pencil, Plus, Power, PowerOff, Trash } from "lucide-react";
import { useState } from "react";
import { TableDonnees } from "@/components/table-donnees";
import { ActionIcone, Alerte, Badge, Bouton, Carte, Champ, Confirmer, EnTete, Modale } from "@/components/ui";
import { api } from "@/lib/api";
import { useDonnees } from "@/lib/hooks";
import { LIBELLES_CONTROLE, LIBELLES_CONTROLE_COURTS, RAYON_MAX, RAYON_MIN, lireCoordonnees, obtenirPosition } from "@/lib/lieu";
import type { ControlePosition, Seminaire } from "@/lib/types";

type Formulaire = {
  id?: string;
  designation: string;
  description: string;
  estActif: boolean;
  controlePosition: ControlePosition;
  coordonnees: string;
  rayonMetres: number;
};

const NOUVEAU: Formulaire = { designation: "", description: "", estActif: false, controlePosition: "Desactive", coordonnees: "", rayonMetres: 200 };

const versFormulaire = (s: Seminaire): Formulaire => ({
  id: s.id,
  designation: s.designation,
  description: s.description ?? "",
  estActif: s.estActif,
  controlePosition: s.controlePosition,
  coordonnees: s.latitude !== null && s.longitude !== null ? `${s.latitude}, ${s.longitude}` : "",
  rayonMetres: s.rayonMetres,
});

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
        actions={
          <Bouton onClick={() => setFormulaire(NOUVEAU)}>
            <Plus size={16} aria-hidden /> Nouveau séminaire
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
          titreExport="Séminaires"
          nomFichier="seminaires"
          triInitial={{ cle: "designation", sens: "asc" }}
          colonnes={[
            { cle: "designation", titre: "Désignation", valeur: (s) => s.designation, rendu: (s) => <span className="font-semibold">{s.designation}</span> },
            { cle: "description", titre: "Description", valeur: (s) => s.description ?? "", classe: "text-gris" },
            { cle: "statut", titre: "Statut", valeur: (s) => (s.estActif ? "Actif" : "Inactif"), filtre: "liste", rendu: (s) => <Badge actif={s.estActif} /> },
            {
              cle: "lieu",
              titre: "Contrôle du lieu",
              valeur: (s) => LIBELLES_CONTROLE_COURTS[s.controlePosition],
              texte: (s) =>
                s.controlePosition === "Desactive" ? LIBELLES_CONTROLE_COURTS.Desactive : `${LIBELLES_CONTROLE_COURTS[s.controlePosition]} (${s.rayonMetres} m)`,
              filtre: "liste",
              rendu: (s) =>
                s.controlePosition === "Desactive" ? (
                  <span className="text-gris">Désactivé</span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={14} aria-hidden className="text-rotary" />
                    {LIBELLES_CONTROLE_COURTS[s.controlePosition]} · {s.rayonMetres} m
                  </span>
                ),
            },
            { cle: "sessions", titre: "Sessions", valeur: (s) => s.nombreSessions, type: "nombre" },
            { cle: "inscrits", titre: "Inscrits", valeur: (s) => s.nombreInscrits, type: "nombre" },
          ]}
          actions={(s) => (
            <>
              <ActionIcone libelle="Modifier" icone={Pencil} onClick={() => setFormulaire(versFormulaire(s))} />
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
  const [localisation, setLocalisation] = useState(false);
  const coordonnees = lireCoordonnees(v.coordonnees);

  const utiliserMaPosition = async () => {
    setLocalisation(true);
    setErreur(null);
    const position = await obtenirPosition();
    setLocalisation(false);
    if (!position) return setErreur("Position indisponible : autorisez la localisation dans le navigateur, ou saisissez les coordonnées.");
    setV((x) => ({ ...x, coordonnees: `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}` }));
  };

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    if (v.coordonnees.trim() && !coordonnees) return setErreur("Coordonnées GPS illisibles. Format attendu : 5.324012, -4.018034");
    if (v.controlePosition !== "Desactive" && !coordonnees) return setErreur("Renseignez les coordonnées GPS du lieu pour activer le contrôle.");
    setEnvoi(true);
    try {
      const corps = {
        designation: v.designation,
        description: v.description || null,
        estActif: v.estActif,
        controlePosition: v.controlePosition,
        latitude: coordonnees?.latitude ?? null,
        longitude: coordonnees?.longitude ?? null,
        rayonMetres: v.rayonMetres,
      };
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
          <textarea className="champ" rows={2} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
        </Champ>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-rotary" checked={v.estActif} onChange={(e) => setV({ ...v, estActif: e.target.checked })} />
          Actif (proposé aux participants)
        </label>

        <fieldset className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-sm font-bold">Lieu de la formation</legend>
          <Champ
            libelle="Contrôle de la position"
            aide="Au moment de valider, le téléphone du participant indique sa position, comparée au lieu ci-dessous. Seule la distance est enregistrée."
          >
            <select className="champ" value={v.controlePosition} onChange={(e) => setV({ ...v, controlePosition: e.target.value as ControlePosition })}>
              {(Object.keys(LIBELLES_CONTROLE) as ControlePosition[]).map((c) => (
                <option key={c} value={c}>
                  {LIBELLES_CONTROLE[c]}
                </option>
              ))}
            </select>
          </Champ>
          <Champ
            libelle="Coordonnées GPS (latitude, longitude)"
            aide="Dans Google Maps, un clic droit (ou un appui long) sur le lieu affiche ses coordonnées : cliquez dessus pour les copier, puis collez-les ici."
          >
            <input
              className="champ font-mono"
              placeholder="5.324012, -4.018034"
              value={v.coordonnees}
              onChange={(e) => setV({ ...v, coordonnees: e.target.value })}
            />
          </Champ>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Bouton variante="secondaire" taille="petit" onClick={utiliserMaPosition} disabled={localisation}>
              <Crosshair size={14} aria-hidden /> {localisation ? "Localisation…" : "Utiliser ma position actuelle"}
            </Bouton>
            {coordonnees && (
              <a
                className="inline-flex items-center gap-1 font-semibold text-rotary hover:underline"
                href={`https://www.google.com/maps?q=${coordonnees.latitude},${coordonnees.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin size={14} aria-hidden /> Vérifier sur la carte
              </a>
            )}
          </div>
          <Champ libelle={`Rayon autorisé : ${v.rayonMetres} m`} aide={`Entre ${RAYON_MIN} et ${RAYON_MAX} m. Une marge de 100 m au plus s'ajoute selon la précision du GPS.`}>
            <input
              type="range"
              min={RAYON_MIN}
              max={RAYON_MAX}
              step={10}
              value={v.rayonMetres}
              onChange={(e) => setV({ ...v, rayonMetres: Number(e.target.value) })}
              className="accent-rotary"
            />
          </Champ>
        </fieldset>

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
