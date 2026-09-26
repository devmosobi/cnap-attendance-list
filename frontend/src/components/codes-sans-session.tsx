"use client";

import { Ban, QrCode, RotateCcw, Trash } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Alerte, Bouton, Modale } from "./ui";

type Compte = { total: number; desactives: number; aDesactiver: number };

/**
 * Gestion en masse des QR Codes sans aucune session associée (aucune présence, même invalidée) :
 * désactivation réversible ou suppression définitive. Le serveur n'agit jamais sur un code ayant une session.
 */
export function CodesSansSession({ onTermine }: { onTermine: () => void }) {
  const [ouverte, setOuverte] = useState(false);
  const [compte, setCompte] = useState<Compte | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState<{ ton: "succes" | "erreur"; texte: string } | null>(null);

  const charger = () =>
    api<Compte>("/api/admin/qrcodes/sans-session")
      .then(setCompte)
      .catch((e: Error) => setResultat({ ton: "erreur", texte: e.message }));

  useEffect(() => {
    if (ouverte) void charger();
  }, [ouverte]);

  const fermer = () => {
    setOuverte(false);
    setConfirmation(false);
    setResultat(null);
    setCompte(null);
  };

  const executer = async (chemin: string, message: (n: number) => string) => {
    setEnvoi(true);
    setResultat(null);
    try {
      const { nombre } = await api<{ nombre: number }>(chemin, { method: "POST" });
      setResultat({ ton: "succes", texte: message(nombre) });
      setConfirmation(false);
      onTermine();
      await charger();
    } catch (e) {
      setResultat({ ton: "erreur", texte: e instanceof Error ? e.message : "Opération impossible." });
    } finally {
      setEnvoi(false);
    }
  };

  const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

  return (
    <>
      <Bouton variante="secondaire" onClick={() => setOuverte(true)}>
        <QrCode size={16} aria-hidden /> Codes sans session
      </Bouton>
      <Modale titre="QR Codes sans session" ouverte={ouverte} onFermer={fermer}>
        {!compte && !resultat && <p className="text-sm text-gris">Chargement…</p>}
        {compte && (
          <div className="flex flex-col gap-4 text-sm">
            <p>
              <strong className="text-lg tabular-nums">{compte.total}</strong> QR Code{compte.total > 1 ? "s" : ""} n&apos;
              {compte.total > 1 ? "ont" : "a"} aucune session associée
              {compte.desactives > 0 && ` (dont ${pluriel(compte.desactives, "déjà désactivé")})`}.
            </p>
            <p className="text-gris">
              Les QR Codes utilisés dans au moins une session, même si la présence a été invalidée, ne sont jamais concernés.
            </p>

            {!confirmation ? (
              <div className="flex flex-col gap-2">
                <Bouton
                  variante="secondaire"
                  disabled={envoi || compte.aDesactiver === 0}
                  onClick={() =>
                    executer("/api/admin/qrcodes/sans-session/desactiver", (n) => `${pluriel(n, "QR Code désactivé")}. Ils sont refusés au scan.`)
                  }
                >
                  <Ban size={15} aria-hidden /> Désactiver {pluriel(compte.aDesactiver, "code")} (réversible)
                </Bouton>
                {compte.desactives > 0 && (
                  <Bouton
                    variante="secondaire"
                    disabled={envoi}
                    onClick={() => executer("/api/admin/qrcodes/desactives/reactiver", (n) => `${pluriel(n, "QR Code réactivé")}.`)}
                  >
                    <RotateCcw size={15} aria-hidden /> Réactiver {pluriel(compte.desactives, "code désactivé")}
                  </Bouton>
                )}
                <Bouton variante="danger" disabled={envoi || compte.total === 0} onClick={() => setConfirmation(true)}>
                  <Trash size={15} aria-hidden /> Supprimer {pluriel(compte.total, "code")}
                </Bouton>
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
                <p className="font-semibold text-red-800 dark:text-red-300">
                  Supprimer définitivement {pluriel(compte.total, "QR Code")} sans session ?
                </p>
                <p className="text-red-800 dark:text-red-300">
                  Ces billets afficheront « Code invalide » au scan. Pour les recréer, il faudra réimporter le fichier des codes.
                </p>
                <div className="flex justify-end gap-2">
                  <Bouton variante="secondaire" onClick={() => setConfirmation(false)} disabled={envoi}>
                    Annuler
                  </Bouton>
                  <Bouton
                    variante="danger"
                    disabled={envoi}
                    onClick={() => executer("/api/admin/qrcodes/sans-session/supprimer", (n) => `${pluriel(n, "QR Code supprimé")}.`)}
                  >
                    {envoi ? "Suppression…" : `Supprimer les ${compte.total}`}
                  </Bouton>
                </div>
              </div>
            )}
          </div>
        )}
        {resultat && (
          <div className="mt-4">
            <Alerte ton={resultat.ton}>{resultat.texte}</Alerte>
          </div>
        )}
        <div className="mt-5 flex justify-end">
          <Bouton variante="secondaire" onClick={fermer}>
            Fermer
          </Bouton>
        </div>
      </Modale>
    </>
  );
}
