"use client";

import { RefreshCw, Sheet } from "lucide-react";
import { useRef, useState } from "react";
import { GraphiqueBarres } from "@/components/graphique-barres";
import { TableDonnees } from "@/components/table-donnees";
import { Alerte, Bouton, Carte, EnTete } from "@/components/ui";
import { construireQuery } from "@/lib/api";
import { exporterPdfSections, type SectionPdf } from "@/lib/export";
import { useDonnees } from "@/lib/hooks";
import type { RapportLigne, Seminaire } from "@/lib/types";

type DefinitionRapport = { titre: string; unite: string; colonne: string; nomFichier: string };

const RAPPORTS = {
  sessions: { titre: "Présences par session", unite: "Présences", colonne: "Session", nomFichier: "presences-par-session" },
  seminaires: { titre: "Inscrits par séminaire", unite: "Inscrits", colonne: "Séminaire", nomFichier: "inscrits-par-seminaire" },
  clubs: { titre: "Inscrits par club", unite: "Inscrits", colonne: "Club", nomFichier: "inscrits-par-club" },
} satisfies Record<string, DefinitionRapport>;

export default function TableauDeBord() {
  const [seminaireId, setSeminaireId] = useState("");
  const seminaires = useDonnees<Seminaire[]>("/api/admin/seminaires");
  const q = construireQuery({ seminaireId });
  const sessions = useDonnees<RapportLigne[]>(`/api/admin/rapports/presences-par-session${q}`);
  const parSeminaire = useDonnees<RapportLigne[]>("/api/admin/rapports/inscrits-par-seminaire");
  const clubs = useDonnees<RapportLigne[]>(`/api/admin/rapports/inscrits-par-club${q}`);

  const graphiqueSessions = useRef<HTMLDivElement>(null);
  const graphiqueSeminaires = useRef<HTMLDivElement>(null);
  const graphiqueClubs = useRef<HTMLDivElement>(null);
  const [exportEnCours, setExportEnCours] = useState(false);
  const [erreurExport, setErreurExport] = useState<string | null>(null);

  const nomSeminaire = seminaires.donnees?.find((s) => s.id === seminaireId)?.designation;

  const recharger = () => {
    sessions.recharger();
    parSeminaire.recharger();
    clubs.recharger();
  };

  const exporterPdf = async () => {
    setExportEnCours(true);
    setErreurExport(null);
    try {
      const { toPng } = await import("html-to-image");
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
      await exporterPdfSections({
        titre: "Tableau de bord",
        sousTitre: nomSeminaire ? `Séminaire : ${nomSeminaire}` : "Tous les séminaires",
        nomFichier: "tableau-de-bord",
        sections: [
          await section(RAPPORTS.sessions, sessions.donnees, graphiqueSessions.current),
          await section(RAPPORTS.seminaires, parSeminaire.donnees, graphiqueSeminaires.current),
          await section(RAPPORTS.clubs, clubs.donnees, graphiqueClubs.current),
        ],
      });
    } catch {
      setErreurExport("L'export PDF a échoué. Veuillez réessayer.");
    } finally {
      setExportEnCours(false);
    }
  };

  return (
    <>
      <EnTete
        titre="Tableau de bord"
        description="Inscriptions et présences en temps réel."
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
        <Rapport def={RAPPORTS.sessions} donnees={sessions} refGraphique={graphiqueSessions} filtre={nomSeminaire} />
        <div className="grid gap-5 lg:grid-cols-2">
          <Rapport def={RAPPORTS.seminaires} donnees={parSeminaire} refGraphique={graphiqueSeminaires} />
          <Rapport def={RAPPORTS.clubs} donnees={clubs} refGraphique={graphiqueClubs} filtre={nomSeminaire} />
        </div>
      </div>
    </>
  );
}

function Rapport({
  def,
  donnees: { donnees, erreur },
  refGraphique,
  filtre,
}: {
  def: DefinitionRapport;
  donnees: { donnees: RapportLigne[] | null; erreur: string | null };
  refGraphique: React.RefObject<HTMLDivElement | null>;
  filtre?: string;
}) {
  const total = donnees?.reduce((s, l) => s + l.valeur, 0) ?? 0;
  return (
    <Carte titre={`${def.titre} · ${total}`}>
      {erreur && <Alerte>{erreur}</Alerte>}
      {donnees && (
        <>
          <div ref={refGraphique} className="bg-white">
            <GraphiqueBarres lignes={donnees} unite={def.unite} />
          </div>
          <details className="group mt-3 border-t border-slate-100 pt-3">
            <summary className="cursor-pointer text-sm font-semibold text-rotary select-none">
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
