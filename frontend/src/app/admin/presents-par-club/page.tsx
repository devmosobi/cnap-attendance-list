"use client";

import { ChevronsDownUp, ChevronsUpDown, FileSpreadsheet, FileText, RefreshCw, Sheet, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Alerte, Bouton, Carte, Chargement, EnTete } from "@/components/ui";
import { construireQuery } from "@/lib/api";
import { LIBELLES_TYPE_CLUB, TYPES_CLUB } from "@/lib/clubs";
import { exporterCsv, exporterPdfSections, exporterXlsx, type ColonneExport, type DocumentExport, type FeuilleExport, type SectionPdf } from "@/lib/export";
import { dateHeure } from "@/lib/format";
import { useDonnees } from "@/lib/hooks";
import type { PresentClub, Seminaire, Session, TypeClub } from "@/lib/types";

const SANS_CLUB = "Sans club";
const normaliser = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const comparateur = new Intl.Collator("fr", { sensitivity: "base" });
const part = (n: number, total: number) => (total === 0 ? 0 : (n / total) * 100);
const formatPart = (p: number) => `${p.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
/** Moyenne des sessions suivies par les présents (arrondie à 2 décimales). */
const moyenneSessions = (presents: PresentClub[]) =>
  presents.length === 0 ? 0 : Math.round((presents.reduce((s, p) => s + p.nombreSessions, 0) / presents.length) * 100) / 100;
const formatMoyenne = (m: number) => m.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

type Groupe = { cle: string; club: string; type: TypeClub | null; presents: PresentClub[] };

export default function PagePresentsParClub() {
  const seminaires = useDonnees<Seminaire[]>("/api/admin/seminaires");
  const sessions = useDonnees<Session[]>("/api/admin/sessions");
  const [seminaireId, setSeminaireId] = useState("");
  const [recherche, setRecherche] = useState("");
  const [type, setType] = useState<TypeClub | "">("");
  const [replies, setReplies] = useState<Set<string>>(new Set());
  const [exportEnCours, setExportEnCours] = useState<string | null>(null);
  const [erreurExport, setErreurExport] = useState<string | null>(null);

  // Séminaire actif proposé par défaut.
  useEffect(() => {
    if (!seminaireId && seminaires.donnees?.length) {
      setSeminaireId((seminaires.donnees.find((s) => s.estActif) ?? seminaires.donnees[0]).id);
    }
  }, [seminaires.donnees, seminaireId]);

  const presents = useDonnees<PresentClub[]>(seminaireId ? `/api/admin/rapports/presents-par-club${construireQuery({ seminaireId })}` : null);
  const seminaire = seminaires.donnees?.find((s) => s.id === seminaireId);
  const nomSeminaire = seminaire?.designation ?? "";
  const inscrits = seminaire?.inscritsDeclares ?? null;

  const groupes = useMemo<Groupe[]>(() => {
    const r = normaliser(recherche);
    const filtres = (presents.donnees ?? []).filter(
      (p) => (!type || p.typeClub === type) && (!r || [p.nomComplet, p.club].some((v) => v && normaliser(v).includes(r))),
    );
    const parClub = new Map<string, Groupe>();
    for (const p of filtres) {
      const cle = p.clubCode ?? "";
      if (!parClub.has(cle)) parClub.set(cle, { cle, club: p.club ?? SANS_CLUB, type: p.typeClub, presents: [] });
      parClub.get(cle)!.presents.push(p);
    }
    return [...parClub.values()]; // l'API renvoie déjà les présents triés par club puis par nom
  }, [presents.donnees, recherche, type]);

  // Synthèse : clubs classés par nombre de présents (l'engouement), puis par nom.
  const synthese = useMemo(
    () => [...groupes].sort((a, b) => b.presents.length - a.presents.length || comparateur.compare(a.club, b.club)),
    [groupes],
  );

  const nbPresents = groupes.reduce((s, g) => s + g.presents.length, 0);
  const moyenneGenerale = moyenneSessions(groupes.flatMap((g) => g.presents));
  // Chiffres clés de la synthèse PDF : les participants sans club ne comptent pas comme un club.
  const nbClubsRepresentes = groupes.filter((g) => g.cle !== "").length;
  const nbSessions = sessions.donnees?.filter((s) => s.seminaireId === seminaireId).length ?? 0;
  const maxPresents = synthese[0]?.presents.length ?? 0;
  const resumeFiltres = [recherche && `recherche « ${recherche} »`, type && `type ${LIBELLES_TYPE_CLUB[type]}`].filter(Boolean).join(", ");
  const sousTitre = `Séminaire : ${nomSeminaire} · ${nbPresents} présent${nbPresents > 1 ? "s" : ""} · ${groupes.length} club${groupes.length > 1 ? "s" : ""} · moyenne ${formatMoyenne(moyenneGenerale)} session(s) suivie(s) par présent${
    resumeFiltres ? ` · Filtres : ${resumeFiltres}` : ""
  }`;

  const basculer = (cle: string) =>
    setReplies((r) => {
      const n = new Set(r);
      if (n.has(cle)) n.delete(cle);
      else n.add(cle);
      return n;
    });

  const exporter = async (format: "csv" | "xlsx" | "pdf") => {
    setErreurExport(null);
    setExportEnCours(format);
    try {
      const nomFichier = "presents-par-club";
      const colonnesSynthese: ColonneExport[] = [
        { titre: "Club" },
        { titre: "Présents", type: "nombre" },
        { titre: "Part" },
        { titre: "Moyenne de sessions suivies", type: "nombre" },
      ];
      // Excel : moyenne numérique ; PDF : moyenne formatée (virgule décimale).
      const lignesSynthese = (moyenneTexte: boolean) =>
        synthese.map((g) => {
          const m = moyenneSessions(g.presents);
          return [g.club, g.presents.length, formatPart(part(g.presents.length, nbPresents)), moyenneTexte ? formatMoyenne(m) : m];
        });

      if (format === "pdf") {
        const colonnes: ColonneExport[] = [
          { titre: "Nom complet" },
          { titre: "Sessions suivies", type: "nombre" },
          { titre: "1re validation" },
          { titre: "Dernière validation" },
        ];
        const sections: SectionPdf[] = [
          {
            titre: "Synthèse",
            colonnes: [{ titre: "Indicateur" }, { titre: "Valeur", type: "nombre" }],
            lignes: [
              ["Nombre d'inscrits", inscrits ?? ""], // vide si non renseigné sur le séminaire (à remplir à la main)
              ["Nombre de participants (global)", nbPresents],
              ["Nombre de clubs représentés", nbClubsRepresentes],
              ["Nombre de sessions de formation", nbSessions],
              ...(inscrits ? [["Taux de participation (participants / inscrits)", formatPart(part(nbPresents, inscrits))]] : []),
            ],
            hauteurLigne: 9,
          },
          { titre: "Synthèse par club", colonnes: colonnesSynthese, lignes: lignesSynthese(true) },
          ...groupes.map((g) => ({
            titre: `${g.club} · ${g.presents.length} présent${g.presents.length > 1 ? "s" : ""} · moyenne ${formatMoyenne(moyenneSessions(g.presents))} session(s)`,
            colonnes,
            lignes: g.presents.map((p) => [p.nomComplet, p.nombreSessions, new Date(p.premiereValidation), new Date(p.derniereValidation)]),
          })),
        ];
        await exporterPdfSections({ titre: "Présents par club", sousTitre, nomFichier, sections });
        return;
      }

      const document: DocumentExport = {
        titre: "Présents",
        sousTitre,
        nomFichier,
        colonnes: [
          { titre: "Séminaire" },
          { titre: "Club" },
          { titre: "Nom complet" },
          { titre: "Sessions suivies", type: "nombre" },
          { titre: "1re validation", type: "date" },
          { titre: "Dernière validation", type: "date" },
        ],
        lignes: groupes.flatMap((g) =>
          g.presents.map((p) => [nomSeminaire, g.club, p.nomComplet, p.nombreSessions, new Date(p.premiereValidation), new Date(p.derniereValidation)]),
        ),
      };
      if (format === "csv") exporterCsv(document);
      else {
        const feuilleSynthese: FeuilleExport = { titre: "Synthèse par club", colonnes: colonnesSynthese, lignes: lignesSynthese(false) };
        await exporterXlsx(document, [feuilleSynthese]);
      }
    } catch {
      setErreurExport("L'export a échoué. Veuillez réessayer.");
    } finally {
      setExportEnCours(null);
    }
  };

  return (
    <>
      <EnTete
        titre="Présents par club"
        description="Nombre de participants ayant pointé au moins une session du séminaire, par club."
        actions={
          <select className="champ w-auto" value={seminaireId} onChange={(e) => setSeminaireId(e.target.value)} aria-label="Séminaire">
            {seminaires.donnees?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.designation}
                {s.estActif ? "" : " (inactif)"}
              </option>
            ))}
          </select>
        }
      />

      <Carte className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="champ w-64 max-w-full py-2 text-sm"
              placeholder="Rechercher un nom ou un club…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              aria-label="Rechercher"
            />
            <select className="champ w-auto py-2 text-sm" value={type} onChange={(e) => setType(e.target.value as TypeClub | "")} aria-label="Type de club">
              <option value="">Tous les types de club</option>
              {TYPES_CLUB.map((t) => (
                <option key={t} value={t}>
                  {LIBELLES_TYPE_CLUB[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Bouton variante="secondaire" taille="petit" onClick={presents.recharger}>
              <RefreshCw size={15} aria-hidden /> Actualiser
            </Bouton>
            <Bouton variante="secondaire" taille="petit" disabled={!!exportEnCours || nbPresents === 0} onClick={() => exporter("csv")}>
              <FileText size={15} aria-hidden /> CSV
            </Bouton>
            <Bouton variante="secondaire" taille="petit" disabled={!!exportEnCours || nbPresents === 0} onClick={() => exporter("xlsx")}>
              <FileSpreadsheet size={15} aria-hidden /> {exportEnCours === "xlsx" ? "Export…" : "Excel"}
            </Bouton>
            <Bouton variante="secondaire" taille="petit" disabled={!!exportEnCours || nbPresents === 0} onClick={() => exporter("pdf")}>
              <Sheet size={15} aria-hidden /> {exportEnCours === "pdf" ? "Export…" : "PDF"}
            </Bouton>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-sm text-gris">
          <Users size={15} aria-hidden />
          {nbPresents} présent{nbPresents > 1 ? "s" : ""} · {groupes.length} club{groupes.length > 1 ? "s" : ""}
          {presents.donnees && nbPresents !== presents.donnees.length && ` (sur ${presents.donnees.length})`}
          {nbPresents > 0 && ` · moyenne ${formatMoyenne(moyenneGenerale)} session(s) suivie(s) par présent`}
          {inscrits ? ` · ${inscrits} inscrit${inscrits > 1 ? "s" : ""} (participation ${formatPart(part(nbPresents, inscrits))})` : ""}
        </p>
        {(presents.erreur || erreurExport) && (
          <div className="mt-3">
            <Alerte>{presents.erreur ?? erreurExport}</Alerte>
          </div>
        )}
      </Carte>

      {!presents.donnees && presents.chargement && <Chargement />}
      {presents.donnees && groupes.length === 0 && (
        <Carte>
          <p className="py-6 text-center text-sm text-gris">Aucun présent pour ce séminaire{resumeFiltres ? " avec ces filtres" : ""}.</p>
        </Carte>
      )}

      {synthese.length > 0 && (
        <Carte titre="Synthèse par club" className="mb-5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-surface-2 text-xs tracking-wide text-gris uppercase">
                <tr>
                  <th className="w-10 px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">Club</th>
                  <th className="w-20 px-3 py-2 text-right font-semibold">Présents</th>
                  <th className="w-20 px-3 py-2 text-right font-semibold">Part</th>
                  <th className="w-28 px-3 py-2 text-right font-semibold" title="Moyenne des sessions suivies par présent">
                    Moy. sessions
                  </th>
                  <th className="w-2/5 px-3 py-2">
                    <span className="sr-only">Répartition</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bordure-douce">
                {synthese.map((g, i) => (
                  <tr key={g.cle}>
                    <td className="px-3 py-2 text-gris tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2 font-semibold">{g.club}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{g.presents.length}</td>
                    <td className="px-3 py-2 text-right text-gris tabular-nums">{formatPart(part(g.presents.length, nbPresents))}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatMoyenne(moyenneSessions(g.presents))}</td>
                    <td className="px-3 py-2" aria-hidden>
                      <div className="h-3 rounded-r bg-rotary dark:bg-[#6b9cf0]" style={{ width: `${part(g.presents.length, maxPresents)}%` }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Carte>
      )}

      {groupes.length > 0 && (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Détail par club</h2>
          <Bouton variante="lien" onClick={() => setReplies(replies.size ? new Set() : new Set(groupes.map((g) => g.cle)))}>
            {replies.size ? <ChevronsUpDown size={15} aria-hidden /> : <ChevronsDownUp size={15} aria-hidden />}
            {replies.size ? "Tout déplier" : "Tout replier"}
          </Bouton>
        </div>
      )}
      <div className="flex flex-col gap-4">
        {groupes.map((g) => {
          const ouvert = !replies.has(g.cle);
          return (
            <section key={g.cle} className="overflow-hidden rounded-xl border border-bordure bg-surface shadow-sm">
              <button
                type="button"
                onClick={() => basculer(g.cle)}
                aria-expanded={ouvert}
                className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-surface-2"
              >
                <span className="font-bold">{g.club}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gris tabular-nums">moyenne {formatMoyenne(moyenneSessions(g.presents))} session(s)</span>
                  <span className="rounded-full bg-rotary-clair px-2.5 py-0.5 text-sm font-semibold text-lien tabular-nums">
                    {g.presents.length} présent{g.presents.length > 1 ? "s" : ""}
                  </span>
                </span>
              </button>
              {ouvert && (
                <div className="overflow-x-auto border-t border-bordure-douce">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="bg-surface-2 text-xs tracking-wide text-gris uppercase">
                      <tr>
                        <th className="w-10 px-3 py-2 font-semibold">#</th>
                        <th className="px-3 py-2 font-semibold">Nom complet</th>
                        <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Sessions suivies</th>
                        <th className="px-3 py-2 font-semibold whitespace-nowrap">1re validation</th>
                        <th className="px-3 py-2 font-semibold whitespace-nowrap">Dernière validation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bordure-douce">
                      {g.presents.map((p, i) => (
                        <tr key={p.qrCode}>
                          <td className="px-3 py-2 text-gris tabular-nums">{i + 1}</td>
                          <td className="px-3 py-2 font-semibold">{p.nomComplet}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{p.nombreSessions}</td>
                          <td className="px-3 py-2 whitespace-nowrap tabular-nums">{dateHeure(p.premiereValidation)}</td>
                          <td className="px-3 py-2 whitespace-nowrap tabular-nums">{dateHeure(p.derniereValidation)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-bordure bg-surface-2 text-sm">
                      <tr>
                        <td className="px-3 py-2" />
                        <td className="px-3 py-2 font-semibold">Moyenne du club</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums">{formatMoyenne(moyenneSessions(g.presents))}</td>
                        <td className="px-3 py-2" colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
