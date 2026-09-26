"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileSpreadsheet,
  FileText,
  FunnelX,
  Sheet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { exporterCsv, exporterPdf, exporterXlsx, type DocumentExport, type TypeCellule, type ValeurCellule } from "@/lib/export";
import { Alerte, Bouton } from "./ui";

export type Colonne<T> = {
  cle: string;
  titre: string;
  /** Valeur servant au tri (nombre, chaîne ISO pour les dates…). */
  valeur: (ligne: T) => string | number | boolean | null | undefined;
  /** Texte affiché, filtré et exporté (par défaut : la valeur). */
  texte?: (ligne: T) => string;
  /** Rendu riche dans la cellule (par défaut : le texte). */
  rendu?: (ligne: T) => React.ReactNode;
  /** « texte » : saisie libre ; « liste » : choix parmi les valeurs présentes ; false : pas de filtre. */
  filtre?: "texte" | "liste" | false;
  triable?: boolean;
  exportable?: boolean;
  type?: TypeCellule;
  classe?: string;
};

const TAILLES = [10, 30, 50, 100] as const;
const comparateur = new Intl.Collator("fr", { sensitivity: "base", numeric: true });
const normaliser = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function TableDonnees<T>({
  lignes,
  colonnes,
  cleLigne,
  actions,
  titreExport,
  nomFichier,
  chargement,
  erreur,
  triInitial,
  outils,
  exportable = true,
  taillesPage = TAILLES,
}: {
  lignes: T[] | null;
  colonnes: Colonne<T>[];
  cleLigne: (ligne: T) => string;
  actions?: (ligne: T) => React.ReactNode;
  titreExport: string;
  nomFichier: string;
  chargement?: boolean;
  erreur?: string | null;
  triInitial?: { cle: string; sens: "asc" | "desc" };
  /** Boutons supplémentaires affichés dans la barre d'outils. */
  outils?: React.ReactNode;
  exportable?: boolean;
  taillesPage?: readonly number[];
}) {
  const [tri, setTri] = useState<{ cle: string; sens: "asc" | "desc" } | null>(triInitial ?? null);
  const [filtres, setFiltres] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [taille, setTaille] = useState<number>(taillesPage[0]);
  const [exportEnCours, setExportEnCours] = useState<string | null>(null);
  const [erreurExport, setErreurExport] = useState<string | null>(null);

  const texte = (c: Colonne<T>, l: T) => (c.texte ? c.texte(l) : String(c.valeur(l) ?? ""));

  const optionsListe = useMemo(() => {
    const options: Record<string, string[]> = {};
    for (const c of colonnes.filter((c) => c.filtre === "liste")) {
      options[c.cle] = [...new Set((lignes ?? []).map((l) => texte(c, l)).filter(Boolean))].sort(comparateur.compare);
    }
    return options;
  }, [lignes, colonnes]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtrees = useMemo(() => {
    const actifs = colonnes.filter((c) => filtres[c.cle]);
    let resultat = (lignes ?? []).filter((l) =>
      actifs.every((c) => {
        const f = filtres[c.cle];
        const t = texte(c, l);
        return c.filtre === "liste" ? t === f : normaliser(t).includes(normaliser(f));
      }),
    );
    const colonneTri = tri && colonnes.find((c) => c.cle === tri.cle);
    if (colonneTri && tri) {
      const signe = tri.sens === "asc" ? 1 : -1;
      resultat = [...resultat].sort((a, b) => {
        const va = colonneTri.valeur(a);
        const vb = colonneTri.valeur(b);
        if (va === vb) return 0;
        if (va === null || va === undefined || va === "") return 1;
        if (vb === null || vb === undefined || vb === "") return -1;
        if (typeof va === "number" && typeof vb === "number") return (va - vb) * signe;
        return comparateur.compare(String(va), String(vb)) * signe;
      });
    }
    return resultat;
  }, [lignes, colonnes, filtres, tri]); // eslint-disable-line react-hooks/exhaustive-deps

  const pages = Math.max(1, Math.ceil(filtrees.length / taille));
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);
  const visibles = filtrees.slice((page - 1) * taille, page * taille);
  const nbFiltres = Object.values(filtres).filter(Boolean).length;

  const modifierFiltre = (cle: string, valeur: string) => {
    setFiltres((f) => ({ ...f, [cle]: valeur }));
    setPage(1);
  };

  const basculerTri = (cle: string) => {
    setTri((t) => (t?.cle !== cle ? { cle, sens: "asc" } : t.sens === "asc" ? { cle, sens: "desc" } : null));
    setPage(1);
  };

  const exporter = async (format: "csv" | "xlsx" | "pdf") => {
    const colonnesExport = colonnes.filter((c) => c.exportable !== false);
    const resumeFiltres = colonnes
      .filter((c) => filtres[c.cle])
      .map((c) => `${c.titre} ${c.filtre === "liste" ? "=" : "contient"} « ${filtres[c.cle]} »`)
      .join(" ; ");
    const document: DocumentExport = {
      titre: titreExport,
      sousTitre: `${filtrees.length} ligne${filtrees.length > 1 ? "s" : ""}${resumeFiltres ? ` · Filtres : ${resumeFiltres}` : ""}`,
      nomFichier,
      colonnes: colonnesExport.map((c) => ({ titre: c.titre, type: c.type })),
      lignes: filtrees.map((l) =>
        colonnesExport.map((c): ValeurCellule => {
          const v = c.valeur(l);
          if (c.type === "nombre" && typeof v === "number") return v;
          if (c.type === "date" && typeof v === "string" && v) return new Date(v);
          return texte(c, l);
        }),
      ),
    };
    setErreurExport(null);
    setExportEnCours(format);
    try {
      if (format === "csv") exporterCsv(document);
      else if (format === "xlsx") await exporterXlsx(document);
      else await exporterPdf(document);
    } catch {
      setErreurExport("L'export a échoué. Veuillez réessayer.");
    } finally {
      setExportEnCours(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-sm text-gris">
          <span>
            {filtrees.length} résultat{filtrees.length > 1 ? "s" : ""}
            {nbFiltres > 0 && lignes ? ` sur ${lignes.length}` : ""}
          </span>
          {nbFiltres > 0 && (
            <Bouton variante="lien" onClick={() => (setFiltres({}), setPage(1))}>
              <FunnelX size={15} aria-hidden /> Effacer les filtres
            </Bouton>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {outils}
          {exportable && (
            <>
              <Bouton variante="secondaire" taille="petit" disabled={!!exportEnCours || !lignes} onClick={() => exporter("csv")}>
                <FileText size={15} aria-hidden /> CSV
              </Bouton>
              <Bouton variante="secondaire" taille="petit" disabled={!!exportEnCours || !lignes} onClick={() => exporter("xlsx")}>
                <FileSpreadsheet size={15} aria-hidden /> {exportEnCours === "xlsx" ? "Export…" : "Excel"}
              </Bouton>
              <Bouton variante="secondaire" taille="petit" disabled={!!exportEnCours || !lignes} onClick={() => exporter("pdf")}>
                <Sheet size={15} aria-hidden /> {exportEnCours === "pdf" ? "Export…" : "PDF"}
              </Bouton>
            </>
          )}
        </div>
      </div>

      {(erreur || erreurExport) && <Alerte>{erreur ?? erreurExport}</Alerte>}

      <div className="overflow-x-auto rounded-lg border border-bordure">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-surface-2 text-xs tracking-wide text-gris uppercase">
            <tr>
              {actions && <th className="w-px px-3 py-2 font-semibold whitespace-nowrap">Actions</th>}
              {colonnes.map((c) => {
                const actif = tri?.cle === c.cle;
                const Icone = !actif ? ArrowUpDown : tri.sens === "asc" ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={c.cle}
                    className="px-3 py-2 font-semibold whitespace-nowrap"
                    aria-sort={actif ? (tri.sens === "asc" ? "ascending" : "descending") : undefined}
                  >
                    {c.triable === false ? (
                      c.titre
                    ) : (
                      <button
                        type="button"
                        onClick={() => basculerTri(c.cle)}
                        className={`inline-flex items-center gap-1 uppercase hover:text-lien ${actif ? "text-lien" : ""}`}
                        title={`Trier par ${c.titre.toLowerCase()}`}
                      >
                        {c.titre}
                        <Icone size={13} aria-hidden className={actif ? "" : "opacity-40"} />
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
            <tr className="border-t border-bordure bg-surface normal-case">
              {actions && <th className="px-2 py-1.5" />}
              {colonnes.map((c) => (
                <th key={c.cle} className="px-2 py-1.5 font-normal">
                  {c.filtre === false ? null : c.filtre === "liste" ? (
                    <select
                      className="w-full min-w-24 rounded-md border border-bordure-forte bg-surface px-2 py-1 text-xs text-encre"
                      value={filtres[c.cle] ?? ""}
                      onChange={(e) => modifierFiltre(c.cle, e.target.value)}
                      aria-label={`Filtrer par ${c.titre.toLowerCase()}`}
                    >
                      <option value="">Tous</option>
                      {optionsListe[c.cle]?.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="w-full min-w-20 rounded-md border border-bordure-forte px-2 py-1 text-xs text-encre"
                      placeholder="Filtrer…"
                      value={filtres[c.cle] ?? ""}
                      onChange={(e) => modifierFiltre(c.cle, e.target.value)}
                      aria-label={`Filtrer par ${c.titre.toLowerCase()}`}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-bordure-douce">
            {visibles.map((l) => (
              <tr key={cleLigne(l)} className="hover:bg-surface-2">
                {actions && (
                  <td className="px-2 py-1.5 align-middle whitespace-nowrap">
                    <div className="flex items-center gap-0.5">{actions(l)}</div>
                  </td>
                )}
                {colonnes.map((c) => (
                  <td key={c.cle} className={`px-3 py-2.5 align-middle ${c.type === "nombre" ? "tabular-nums" : ""} ${c.classe ?? ""}`}>
                    {c.rendu ? c.rendu(l) : texte(c, l)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!lignes && chargement && <p className="py-8 text-center text-sm text-gris">Chargement…</p>}
        {lignes && filtrees.length === 0 && <p className="py-8 text-center text-sm text-gris">Aucun résultat.</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gris">
        <label className="flex items-center gap-2">
          Lignes par page
          <select
            className="rounded-md border border-bordure-forte bg-surface px-2 py-1 text-encre"
            value={taille}
            onChange={(e) => (setTaille(Number(e.target.value)), setPage(1))}
          >
            {taillesPage.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <span className="mr-2 tabular-nums">
            {filtrees.length === 0 ? "0" : `${(page - 1) * taille + 1}–${Math.min(page * taille, filtrees.length)}`} sur {filtrees.length}
          </span>
          <BoutonPage libelle="Première page" disabled={page <= 1} onClick={() => setPage(1)}>
            <ChevronsLeft size={16} />
          </BoutonPage>
          <BoutonPage libelle="Page précédente" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft size={16} />
          </BoutonPage>
          <span className="px-1 tabular-nums">
            {page} / {pages}
          </span>
          <BoutonPage libelle="Page suivante" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            <ChevronRight size={16} />
          </BoutonPage>
          <BoutonPage libelle="Dernière page" disabled={page >= pages} onClick={() => setPage(pages)}>
            <ChevronsRight size={16} />
          </BoutonPage>
        </div>
      </div>
    </div>
  );
}

function BoutonPage({ libelle, disabled, onClick, children }: { libelle: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={libelle}
      title={libelle}
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-bordure-forte bg-surface p-1 text-encre hover:bg-surface-2 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
