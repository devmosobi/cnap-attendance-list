// Module ordinaire (sans « use client ») : importable par le layout serveur.

export const CLE_THEME = "cnap-theme";

/**
 * Script exécuté avant l'affichage (dans <head>) : applique le thème mémorisé
 * pour éviter un flash de la page claire en mode sombre.
 */
export const SCRIPT_THEME = `(function(){try{var c=localStorage.getItem("${CLE_THEME}");var s=c==="sombre"||(c!=="clair"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var h=document.documentElement;h.classList.toggle("dark",s);h.style.colorScheme=s?"dark":"light";}catch(e){}})();`;
