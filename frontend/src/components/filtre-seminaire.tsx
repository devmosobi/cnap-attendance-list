"use client";

import { useCallback, useEffect, useState } from "react";
import { useDonnees } from "@/lib/hooks";
import type { Seminaire } from "@/lib/types";

/** Choix mémorisé pour l'onglet du navigateur : il suit l'utilisateur d'une page à l'autre de la console. */
const CLE_STOCKAGE = "cnap.filtre-seminaire";

function lireChoix(): string | null {
  try {
    return sessionStorage.getItem(CLE_STOCKAGE);
  } catch {
    return null;
  }
}

function memoriserChoix(id: string) {
  try {
    sessionStorage.setItem(CLE_STOCKAGE, id);
  } catch {
    // Stockage indisponible (navigation privée…) : le choix vaut pour la page seulement.
  }
}

/**
 * Filtre séminaire commun aux pages de la console. Par défaut, le premier séminaire actif
 * (l'API renvoie les séminaires actifs en premier, puis par désignation) ; sinon « Tous les séminaires ».
 * `obligatoire` : la page a besoin d'un séminaire précis (« Tous » est alors remplacé par le séminaire par défaut).
 */
export function useFiltreSeminaire({ obligatoire = false }: { obligatoire?: boolean } = {}) {
  const { donnees, erreur, recharger } = useDonnees<Seminaire[]>("/api/admin/seminaires");
  const [choix, setChoix] = useState<string | null>(null);

  useEffect(() => {
    if (choix !== null) return;
    if (erreur) return setChoix("");
    if (!donnees) return;
    const parDefaut = donnees.find((s) => s.estActif)?.id ?? (obligatoire ? (donnees[0]?.id ?? "") : "");
    const memorise = lireChoix();
    const valide = memorise !== null && (memorise === "" ? !obligatoire : donnees.some((s) => s.id === memorise));
    setChoix(valide ? memorise : parDefaut);
  }, [donnees, erreur, choix, obligatoire]);

  const choisir = useCallback((id: string) => {
    setChoix(id);
    memoriserChoix(id);
  }, []);

  const seminaireId = choix ?? "";
  return {
    seminaires: donnees ?? [],
    seminaireId,
    seminaire: donnees?.find((s) => s.id === seminaireId) ?? null,
    /** Faux tant que le séminaire par défaut n'est pas déterminé : évite un premier chargement « tous séminaires » inutile. */
    pret: choix !== null,
    choisir,
    rechargerSeminaires: recharger,
  };
}

export function SelecteurSeminaire({
  filtre,
  tous = true,
  className = "",
}: {
  filtre: ReturnType<typeof useFiltreSeminaire>;
  /** Propose l'option « Tous les séminaires ». */
  tous?: boolean;
  className?: string;
}) {
  return (
    <select
      className={`champ w-auto max-w-full ${className}`}
      value={filtre.seminaireId}
      onChange={(e) => filtre.choisir(e.target.value)}
      disabled={!filtre.pret}
      aria-label="Filtrer par séminaire"
    >
      {tous && <option value="">Tous les séminaires</option>}
      {filtre.seminaires.map((s) => (
        <option key={s.id} value={s.id}>
          {s.designation}
          {s.estActif ? "" : " (inactif)"}
        </option>
      ))}
    </select>
  );
}
