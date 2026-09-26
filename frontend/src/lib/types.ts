// Public
export type SessionPublic = { id: string; designation: string; heureDebut: string; heureFin: string };
export type ControlePosition = "Desactive" | "Signaler" | "Bloquer";
export type ResultatPosition = "NonControle" | "SurPlace" | "HorsZone" | "NonLocalise";
export type SeminairePublic = { id: string; designation: string; controlePosition: ControlePosition; sessions: SessionPublic[] };
export type TypeClub = "Rotary" | "Rotaract" | "Interact" | "Autre";
export type ClubOption = { code: string; nom: string; type: TypeClub };
export type PresencePublic = { sessionId: string; session: string; heureDePointage: string };
export type ScanEtat = {
  code: string;
  statut: "Inactif" | "Actif";
  participant: { nomComplet: string; emailMasque: string; clubNom: string | null } | null;
  seminaires: SeminairePublic[];
  clubs: ClubOption[];
  presences: PresencePublic[];
};
export type PresenceConfirmation = {
  nomComplet: string;
  seminaire: string;
  session: string;
  heureDePointage: string;
  premierScan: boolean;
};

// Admin
export type UtilisateurConnecte = { id: string; email: string; nomComplet: string; role: string; doitChangerMotDePasse: boolean };
export type Seminaire = {
  id: string;
  designation: string;
  description: string | null;
  estActif: boolean;
  nombreSessions: number;
  nombreInscrits: number;
  controlePosition: ControlePosition;
  latitude: number | null;
  longitude: number | null;
  rayonMetres: number;
};
export type Session = {
  id: string;
  seminaireId: string;
  seminaire: string;
  designation: string;
  heureDebut: string;
  heureFin: string;
  description: string | null;
  estActif: boolean;
  nombrePresences: number;
};
export type Club = { code: string; nom: string; type: TypeClub; estActif: boolean; nombreInscrits: number };
export type QrCodeListe = {
  code: string;
  statut: string;
  nomComplet: string | null;
  email: string | null;
  clubCode: string | null;
  club: string | null;
  typeClub: TypeClub | null;
  seminaireId: string | null;
  seminaire: string | null;
  dateActivation: string | null;
  nombrePresences: number;
};
export type PresenceHistorique = {
  id: string;
  sessionId: string;
  session: string;
  seminaire: string;
  heureDePointage: string;
  resultatPosition: ResultatPosition;
  distanceMetres: number | null;
};
export type QrCodeDetail = Omit<QrCodeListe, "nombrePresences" | "typeClub"> & { presences: PresenceHistorique[] };
export type ImportResultat = { lignes: number; crees: number; existants: number; erreurs: string[]; misAJour: number };
export type PresenceListe = {
  id: string;
  qrCode: string;
  nomComplet: string | null;
  email: string | null;
  clubCode: string | null;
  club: string | null;
  typeClub: TypeClub | null;
  sessionId: string;
  session: string;
  seminaire: string;
  heureDePointage: string;
  resultatPosition: ResultatPosition;
  distanceMetres: number | null;
};
export type RapportLigne = { cle: string; libelle: string; valeur: number };
export type PresentClub = {
  qrCode: string;
  nomComplet: string | null;
  clubCode: string | null;
  club: string | null;
  typeClub: TypeClub | null;
  nombreSessions: number;
  premiereValidation: string;
  derniereValidation: string;
};
export type RapportLieu = { cle: string; session: string; surPlace: number; horsZone: number; nonLocalise: number; nonControle: number };
export type ParametresSmtp = {
  hote: string;
  port: number;
  utilisateur: string | null;
  motDePasseDefini: boolean;
  expediteurEmail: string;
  expediteurNom: string;
  utiliserTls: boolean;
  estActif: boolean;
};
export type FileEmailStats = { enAttente: number; envoyes: number; echecs: number; derniereErreur: string | null };
export type Utilisateur = { id: string; email: string; nomComplet: string; role: string; estActif: boolean; doitChangerMotDePasse: boolean };

export const ROLES = ["Administrateur", "Gestionnaire"] as const;
