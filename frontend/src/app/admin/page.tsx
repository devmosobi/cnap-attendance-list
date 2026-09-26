"use client";

import { RefreshCw, Sheet } from "lucide-react";
import { useRef, useState } from "react";
import { GraphiqueBarres } from "@/components/graphique-barres";
import { RapportLieuCarte, pourcentage, totalInvalidees, totauxLieu } from "@/components/rapport-lieu";
import { TableDonnees } from "@/components/table-donnees";
import { Alerte, Bouton, Carte, EnTete } from "@/components/ui";
import { construireQuery } from "@/lib/api";
import { exporterPdfSections, type SectionPdf } from "@/lib/export";
import { useDonnees } from "@/lib/hooks";
import { LIBELLES_RESULTAT } from "@/lib/lieu";
import type { RapportLieu, RapportLigne, ResultatPosition, Seminaire } from "@/lib/types";

type DefinitionRapport = { titre: string; unite: string; colonne: string; nomFichier: string; libelleAxe?: (libelle: string) => string };

/** « Séminaire – Session » → « Session » sur l'axe du graphique. */
const nomSession = (libelle: string) => libelle.split(" – ").slice(1).join(" – ") || libelle;

const RAPPORTS = {
  sessions: { titre: "Présences par session", unite: "Présences", colonne: "Session", nomFichier: "presences-par-session", libelleAxe: nomSession },
  seminaires: { titre: "Participants par séminaire", unite: "Participants", colonne: "Séminaire", nomFichier: "participants-par-seminaire" },
  types: { titre: "Participants par type de club", unite: "Participants", colonne: "Type de club", nomFichier: "participants-par-type-club" },
  clubs: { titre: "Participants par club", unite: "Participants", colonne: "Club", nomFichier: "participants-par-club" },
} satisfies Record<string, DefinitionRapport>;

export default function TableauDeBord() {
  const [seminaireId, setSeminaireId] = useState("");
  const seminaires = useDonnees<Seminaire[]>("/api/admin/seminaires");
  const q = construireQuery({ seminaireId });
  const sessions = useDonnees<RapportLigne[]>(`/api/admin/rapports/presences-par-session${q}`);
  const parSeminaire = useDonnees<RapportLigne[]>("/api/admin/rapports/inscrits-par-seminaire");
  const types = useDonnees<RapportLigne[]>(`/api/admin/rapports/inscrits-par-type-club${q}`);
  const clubs = useDonnees<RapportLigne[]>(`/api/admin/rapports/inscrits-par-club${q}`);
  const lieu = useDonnees<RapportLieu[]>(`/api/admin/rapports/presences-par-lieu${q}`);

  const graphiqueSessions = useRef<HTMLDivElement>(null);
  const graphiqueSeminaires = useRef<HTMLDivElement>(null);
  const graphiqueTypes = useRef<HTMLDivElement>(null);
  const graphiqueClubs = useRef<HTMLDivElement>(null);
  const [exportEnCours, setExportEnCours] = useState(false);
  // Pendant l'export PDF, les graphiques passent en palette claire (document imprimable).
  const [captureClaire, setCaptureClaire] = useState(false);
  const [erreurExport, setErreurExport] = useState<string | null>(null);

  const nomSeminaire = seminaires.donnees?.find((s) => s.id === seminaireId)?.designation;

  const recharger = () => {
    sessions.recharger();
    parSeminaire.recharger();
    types.recharger();
    clubs.recharger();
    lieu.recharger();
  };

  const exporterPdf = async () => {
    setExportEnCours(true);
    setErreurExport(null);
    try {
      const { toPng } = await import("html-to-image");
      setCaptureClaire(true);
      await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(ok, 50))));
      const section = async (def: DefinitionRapport, lignes: RapportLigne[] | null, noeud: HTMLDivElement | null): Promise<SectionPdf> => {
        const donnees = lignes ?? [];
        const total = donnees.reduce((s, l) => s + l.valeur, 0);
        let image: SectionPdf["image"];
        if (noeud && donnees.length > 0) {
          const url = await toPng(noeud, { backgroundColor: "#ffffff", pixelRatio: 2 });
          image = { url, largeur: noeud.offsetWidth, hauteur: noeud.offsetHeight };
        }
        return {
          titre: `${def.titre} · ${total}`,
          image,
          colonnes: [{ titre: def.colonne }, { titre: def.unite, type: "nombre" }],
          lignes: donnees.map((l) => [l.libelle, l.valeur]),
        };
      };
      const t = totauxLieu(lieu.donnees);
      const resultats: ResultatPosition[] = ["SurPlace", "HorsZone", "NonLocalise", "NonControle"];
      const sectionsLieu: SectionPdf[] = [
        {
          titre: `Contrôle du lieu · ${t.total} présences`,
          colonnes: [{ titre: "Résultat" }, { titre: "Présences", type: "nombre" }, { titre: "Part" }],
          lignes: [
            ...resultats.map((r) => [LIBELLES_RESULTAT[r], t[r], pourcentage(t[r], t.total)]),
            ["Présences invalidées (exclues)", totalInvalidees(lieu.donnees), ""],
          ],
        },
        {
          titre: "Contrôle du lieu par session",
          colonnes: [
            { titre: "Session" },
            { titre: "Sur place", type: "nombre" },
            { titre: "Hors zone", type: "nombre" },
            { titre: "Non localisée", type: "nombre" },
            { titre: "Non contrôlé", type: "nombre" },
            { titre: "Invalidées", type: "nombre" },
          ],
          lignes: (lieu.donnees ?? []).map((l) => [l.session, l.surPlace, l.horsZone, l.nonLocalise, l.nonControle, l.invalidees]),
        },
      ];
      await exporterPdfSections({
        titre: "Tableau de bord",
        sousTitre: nomSeminaire ? `Séminaire : ${nomSeminaire}` : "Tous les séminaires",
        nomFichier: "tableau-de-bord",
        sections: [
          await section(RAPPORTS.sessions, sessions.donnees, graphiqueSessions.current),
          ...sectionsLieu,
          await section(RAPPORTS.seminaires, parSeminaire.donnees, graphiqueSeminaires.current),
          await section(RAPPORTS.types, types.donnees, graphiqueTypes.current),
          await section(RAPPORTS.clubs, clubs.donnees, graphiqueClubs.current),
        ],
      });
    } catch {
      setErreurExport("L'export PDF a échoué. Veuillez réessayer.");
    } finally {
      setCaptureClaire(false);
      setExportEnCours(false);
    }
  };

  return (
    <>
      <EnTete
        titre="Tableau de bord"
        description="Participants et présences en temps réel (présences invalidées et QR Codes sans présence exclus)."
        actions={
          <>
            <select className="champ w-auto" value={seminaireId} onChange={(e) => setSeminaireId(e.target.value)} aria-label="Filtrer par séminaire">
              <option value="">Tous les séminaires</option>
              {seminaires.donnees?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.designation}
                </option>
              ))}
            </select>
            <Bouton variante="secondaire" onClick={recharger}>
              <RefreshCw size={16} aria-hidden /> Actualiser
            </Bouton>
            <Bouton onClick={exporterPdf} disabled={exportEnCours}>
              <Sheet size={16} aria-hidden /> {exportEnCours ? "Export…" : "Exporter en PDF"}
            </Bouton>
          </>
        }
      />
      {erreurExport && (
        <div className="mb-4">
          <Alerte>{erreurExport}</Alerte>
        </div>
      )}
      <div className="grid gap-5">
        <Rapport def={RAPPORTS.sessions} donnees={sessions} refGraphique={graphiqueSessions} filtre={nomSeminaire} captureClaire={captureClaire} />
        <RapportLieuCarte lignes={lieu.donnees} erreur={lieu.erreur} filtre={nomSeminaire} />
        <div className="grid gap-5 lg:grid-cols-2">
          <Rapport def={RAPPORTS.seminaires} donnees={parSeminaire} refGraphique={graphiqueSeminaires} captureClaire={captureClaire} />
          <Rapport def={RAPPORTS.types} donnees={types} refGraphique={graphiqueTypes} filtre={nomSeminaire} captureClaire={captureClaire} />
        </div>
        <Rapport def={RAPPORTS.clubs} donnees={clubs} refGraphique={graphiqueClubs} filtre={nomSeminaire} captureClaire={captureClaire} />
      </div>
    </>
  );
}

function Rapport({
  def,
  donnees: { donnees, erreur },
  refGraphique,
  filtre,
  captureClaire = false,
}: {
  def: DefinitionRapport;
  donnees: { donnees: RapportLigne[] | null; erreur: string | null };
  refGraphique: React.RefObject<HTMLDivElement | null>;
  filtre?: string;
  captureClaire?: boolean;
}) {
  const total = donnees?.reduce((s, l) => s + l.valeur, 0) ?? 0;
  return (
    <Carte titre={`${def.titre} · ${total}`}>
      {erreur && <Alerte>{erreur}</Alerte>}
      {donnees && (
        <>
          <div ref={refGraphique} className={captureClaire ? "bg-white" : "bg-surface"}>
            <GraphiqueBarres lignes={donnees} unite={def.unite} libelleAxe={def.libelleAxe} forcerClair={captureClaire} />
          </div>
          <details className="group mt-3 border-t border-bordure-douce pt-3">
            <summary className="cursor-pointer text-sm font-semibold text-lien select-none">
              <span className="group-open:hidden">Afficher le tableau</span>
              <span className="hidden group-open:inline">Masquer le tableau</span>
            </summary>
            <div className="mt-3">
              <TableDonnees
                lignes={donnees}
                cleLigne={(l) => l.cle}
                titreExport={filtre ? `${def.titre} – ${filtre}` : def.titre}
                nomFichier={def.nomFichier}
                triInitial={{ cle: "valeur", sens: "desc" }}
                colonnes={[
                  { cle: "libelle", titre: def.colonne, valeur: (l) => l.libelle },
                  { cle: "valeur", titre: def.unite, valeur: (l) => l.valeur, type: "nombre", classe: "font-semibold" },
                ]}
              />
            </div>
          </details>
        </>
      )}
    </Carte>
  );
}
