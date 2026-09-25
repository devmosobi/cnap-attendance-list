"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";
import type { UtilisateurConnecte } from "./types";

/** Charge une ressource de l'API et expose un rechargement manuel. */
export function useDonnees<T>(chemin: string | null) {
  const [donnees, setDonnees] = useState<T | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!chemin) return;
    let annule = false;
    setChargement(true);
    api<T>(chemin)
      .then((d) => {
        if (annule) return;
        setDonnees(d);
        setErreur(null);
      })
      .catch((e: Error) => !annule && setErreur(e.message))
      .finally(() => !annule && setChargement(false));
    return () => {
      annule = true;
    };
  }, [chemin, version]);

  const recharger = useCallback(() => setVersion((v) => v + 1), []);
  return { donnees, erreur, chargement, recharger };
}

export const UtilisateurContext = createContext<UtilisateurConnecte | null>(null);

export function useUtilisateur() {
  return useContext(UtilisateurContext);
}

export function useEstAdministrateur() {
  return useUtilisateur()?.role === "Administrateur";
}
