// Public
export type SessionPublic = { id: string; designation: string; heureDebut: string; heureFin: string };
export type SeminairePublic = { id: string; designation: string; sessions: SessionPublic[] };
export type ClubOption = { code: string; nom: string };
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
export type Seminaire = { id: string; designation: string; description: string | null; estActif: boolean; nombreSessions: number; nombreInscrits: number };
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
export type Club = { code: string; nom: string; estActif: boolean; nombreInscrits: number };
export type QrCodeListe = {
  code: string;
  statut: string;
  nomComplet: string | null;
  email: string | null;
  clubCode: string | null;
  club: string | null;
  seminaireId: string | null;
  seminaire: string | null;
  dateActivation: string | null;
  nombrePresences: number;
};
export type PresenceHistorique = { id: string; sessionId: string; session: string; seminaire: string; heureDePointage: string };
export type QrCodeDetail = Omit<QrCodeListe, "nombrePresences"> & { presences: PresenceHistorique[] };
export type ImportResultat = { lignes: number; crees: number; existants: number; erreurs: string[] };
export type PresenceListe = {
  id: string;
  qrCode: string;
  nomComplet: string | null;
  email: string | null;
  clubCode: string | null;
  club: string | null;
  sessionId: string;
  session: string;
  seminaire: string;
  heureDePointage: string;
};
export type RapportLigne = { cle: string; libelle: string; valeur: number };
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
