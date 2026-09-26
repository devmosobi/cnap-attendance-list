"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CLE_THEME as CLE } from "./theme-script";

export type ChoixTheme = "clair" | "sombre" | "auto";

type ContexteTheme = { choix: ChoixTheme; sombre: boolean; choisir: (c: ChoixTheme) => void };

const Contexte = createContext<ContexteTheme>({ choix: "auto", sombre: false, choisir: () => {} });

function lireChoix(): ChoixTheme {
  try {
    const c = localStorage.getItem(CLE);
    return c === "clair" || c === "sombre" ? c : "auto";
  } catch {
    return "auto";
  }
}

export function FournisseurTheme({ children }: { children: React.ReactNode }) {
  const [choix, setChoix] = useState<ChoixTheme>("auto");
  const [systemeSombre, setSystemeSombre] = useState(false);

  useEffect(() => {
    setChoix(lireChoix());
    const requete = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemeSombre(requete.matches);
    const suivre = (e: MediaQueryListEvent) => setSystemeSombre(e.matches);
    requete.addEventListener("change", suivre);
    return () => requete.removeEventListener("change", suivre);
  }, []);

  const sombre = choix === "sombre" || (choix === "auto" && systemeSombre);

  useEffect(() => {
    const h = document.documentElement;
    h.classList.toggle("dark", sombre);
    h.style.colorScheme = sombre ? "dark" : "light";
  }, [sombre]);

  const choisir = useCallback((c: ChoixTheme) => {
    setChoix(c);
    try {
      if (c === "auto") localStorage.removeItem(CLE);
      else localStorage.setItem(CLE, c);
    } catch {
      // Stockage indisponible (navigation privée) : le choix vaut pour la page en cours.
    }
  }, []);

  return <Contexte.Provider value={{ choix, sombre, choisir }}>{children}</Contexte.Provider>;
}

export const useTheme = () => useContext(Contexte);
