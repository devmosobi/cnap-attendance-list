"use client";

import { useState } from "react";
import { KeyRound, Pencil, Plus, Trash } from "lucide-react";
import { TableDonnees } from "@/components/table-donnees";
import { ActionIcone, Alerte, Badge, Bouton, Carte, Champ, Confirmer, EnTete, Modale } from "@/components/ui";
import { api } from "@/lib/api";
import { useDonnees, useUtilisateur } from "@/lib/hooks";
import { ROLES, type Utilisateur } from "@/lib/types";

type Formulaire = { id?: string; email: string; nomComplet: string; role: string; motDePasse: string; estActif: boolean };

export default function PageUtilisateurs() {
  const moi = useUtilisateur();
  const { donnees, erreur, recharger } = useDonnees<Utilisateur[]>("/api/admin/utilisateurs");
  const [formulaire, setFormulaire] = useState<Formulaire | null>(null);
  const [reinitialisation, setReinitialisation] = useState<Utilisateur | null>(null);
  const [aSupprimer, setASupprimer] = useState<Utilisateur | null>(null);
  const [message, setMessage] = useState<{ ton: "erreur" | "succes"; texte: string } | null>(null);

  return (
    <>
      <EnTete
        titre="Utilisateurs"
        description="Comptes d'accès à la console. Les Gestionnaires n'ont pas accès aux paramètres ni aux utilisateurs."
        actions={
          <Bouton onClick={() => setFormulaire({ email: "", nomComplet: "", role: "Gestionnaire", motDePasse: "", estActif: true })}>
            <Plus size={16} aria-hidden /> Nouvel utilisateur
          </Bouton>
        }
      />
      {(erreur || message) && (
        <div className="mb-4">
          <Alerte ton={message?.ton ?? "erreur"}>{erreur ?? message?.texte}</Alerte>
        </div>
      )}
      <Carte>
        <TableDonnees
          lignes={donnees}
          chargement={!donnees && !erreur}
          cleLigne={(u) => u.id}
          titreExport="Utilisateurs"
          nomFichier="utilisateurs"
          triInitial={{ cle: "nom", sens: "asc" }}
          colonnes={[
            {
              cle: "nom",
              titre: "Nom",
              valeur: (u) => u.nomComplet,
              rendu: (u) => (
                <>
                  <span className="font-semibold">{u.nomComplet}</span>
                  {u.doitChangerMotDePasse && <span className="block text-xs text-amber-700 dark:text-amber-300">Mot de passe à changer</span>}
                </>
              ),
            },
            { cle: "email", titre: "Email", valeur: (u) => u.email },
            { cle: "role", titre: "Rôle", valeur: (u) => u.role, filtre: "liste" },
            { cle: "statut", titre: "Statut", valeur: (u) => (u.estActif ? "Actif" : "Inactif"), filtre: "liste", rendu: (u) => <Badge actif={u.estActif} /> },
          ]}
          actions={(u) => (
            <>
              <ActionIcone
                libelle="Modifier"
                icone={Pencil}
                onClick={() => setFormulaire({ id: u.id, email: u.email, nomComplet: u.nomComplet, role: u.role, motDePasse: "", estActif: u.estActif })}
              />
              <ActionIcone libelle="Réinitialiser le mot de passe" icone={KeyRound} onClick={() => setReinitialisation(u)} />
              {u.id !== moi?.id && <ActionIcone libelle="Supprimer" icone={Trash} ton="danger" onClick={() => setASupprimer(u)} />}
            </>
          )}
        />
      </Carte>

      {formulaire && (
        <FormulaireUtilisateur
          valeurs={formulaire}
          onFermer={() => setFormulaire(null)}
          onEnregistre={() => {
            setFormulaire(null);
            recharger();
          }}
        />
      )}
      {reinitialisation && (
        <Reinitialisation
          utilisateur={reinitialisation}
          onFermer={() => setReinitialisation(null)}
          onTermine={() => {
            setMessage({ ton: "succes", texte: `Mot de passe réinitialisé pour ${reinitialisation.email}. Il devra le changer à la prochaine connexion.` });
            setReinitialisation(null);
            recharger();
          }}
        />
      )}
      <Confirmer
        ouverte={!!aSupprimer}
        message={`Supprimer le compte de ${aSupprimer?.nomComplet} (${aSupprimer?.email}) ?`}
        libelle="Supprimer"
        onAnnuler={() => setASupprimer(null)}
        onConfirmer={async () => {
          try {
            await api(`/api/admin/utilisateurs/${aSupprimer!.id}`, { method: "DELETE" });
            recharger();
          } catch (e) {
            setMessage({ ton: "erreur", texte: e instanceof Error ? e.message : "Suppression impossible." });
          }
          setASupprimer(null);
        }}
      />
    </>
  );
}

function FormulaireUtilisateur({ valeurs, onFermer, onEnregistre }: { valeurs: Formulaire; onFermer: () => void; onEnregistre: () => void }) {
  const [v, setV] = useState(valeurs);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      if (v.id)
        await api(`/api/admin/utilisateurs/${v.id}`, { method: "PUT", body: { nomComplet: v.nomComplet, role: v.role, estActif: v.estActif } });
      else
        await api("/api/admin/utilisateurs", {
          method: "POST",
          body: { email: v.email, nomComplet: v.nomComplet, role: v.role, motDePasse: v.motDePasse },
        });
      onEnregistre();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Modale titre={v.id ? "Modifier l'utilisateur" : "Nouvel utilisateur"} ouverte onFermer={onFermer}>
      <form onSubmit={enregistrer} className="flex flex-col gap-4">
        <Champ libelle="Email">
          <input type="email" className="champ" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} disabled={!!v.id} required />
        </Champ>
        <Champ libelle="Nom complet">
          <input className="champ" value={v.nomComplet} onChange={(e) => setV({ ...v, nomComplet: e.target.value })} required />
        </Champ>
        <Champ libelle="Rôle">
          <select className="champ" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Champ>
        {!v.id && (
          <Champ libelle="Mot de passe provisoire" aide="8 caractères minimum, avec majuscule, minuscule et chiffre. À changer à la première connexion.">
            <input
              type="password"
              className="champ"
              autoComplete="new-password"
              value={v.motDePasse}
              onChange={(e) => setV({ ...v, motDePasse: e.target.value })}
              required
            />
          </Champ>
        )}
        {v.id && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-rotary" checked={v.estActif} onChange={(e) => setV({ ...v, estActif: e.target.checked })} />
            Compte actif
          </label>
        )}
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

function Reinitialisation({ utilisateur, onFermer, onTermine }: { utilisateur: Utilisateur; onFermer: () => void; onTermine: () => void }) {
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      await api(`/api/admin/utilisateurs/${utilisateur.id}/reinitialiser-mot-de-passe`, { method: "POST", body: { nouveauMotDePasse: motDePasse } });
      onTermine();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Réinitialisation impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Modale titre={`Réinitialiser le mot de passe – ${utilisateur.nomComplet}`} ouverte onFermer={onFermer}>
      <form onSubmit={valider} className="flex flex-col gap-4">
        <Champ libelle="Nouveau mot de passe provisoire" aide="L'utilisateur devra le changer à sa prochaine connexion.">
          <input type="password" className="champ" autoComplete="new-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} required />
        </Champ>
        {erreur && <Alerte>{erreur}</Alerte>}
        <div className="flex justify-end gap-2">
          <Bouton variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton type="submit" disabled={envoi}>
            Réinitialiser
          </Bouton>
        </div>
      </form>
    </Modale>
  );
}
