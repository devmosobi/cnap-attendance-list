import type { TypeClub } from "./types";

/** Ordre d'affichage des types de club. */
export const TYPES_CLUB: TypeClub[] = ["Rotary", "Rotaract", "Interact", "Autre"];

export const LIBELLES_TYPE_CLUB: Record<TypeClub, string> = {
  Rotary: "Rotary Club",
  Rotaract: "Rotaract Club",
  Interact: "Interact Club",
  Autre: "Autres",
};

export const libelleTypeClub = (type: TypeClub | null | undefined) => (type ? LIBELLES_TYPE_CLUB[type] : "");
