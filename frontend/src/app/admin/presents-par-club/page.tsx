"use client";

import { ChevronsDownUp, ChevronsUpDown, FileSpreadsheet, FileText, RefreshCw, Sheet, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Alerte, Bouton, Carte, Chargement, EnTete } from "@/components/ui";
import { construireQuery } from "@/lib/api";
import { LIBELLES_TYPE_CLUB, TYPES_CLUB, libelleTypeClub } from "@/lib/clubs";
import { exporterCsv, exporterPdfSections, exporterXlsx, type ColonneExport, type DocumentExport, type SectionPdf } from "@/lib/export";
import { dateHeure } from "@/lib/format";
import { useDonnees } from "@/lib/hooks";
import type { PresentClub, Seminaire, TypeClub } from "@/lib/types";

const SANS_CLUB = "Sans club";
const normaliser = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

type Groupe = { cle: string; club: string; type: TypeClub | null; presents: PresentClub[] };

export default function PagePresentsParClub() {
  const seminaires = useDonnees<Seminaire[]>("/api/admin/seminaires");
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
  const nomSeminaire = seminaires.donnees?.find((s) => s.id === seminaireId)?.designation ?? "";

  const groupes = useMemo<Groupe[]>(() => {
    const r = normaliser(recherche);
    const filtres = (presents.donnees ?? []).filter(
      (p) =>
        (!type || p.typeClub === type) &&
        (!r || [p.nomComplet, p.email, p.club].some((v) => v && normaliser(v).includes(r))),
    );
    const parClub = new Map<string, Groupe>();
    for (const p of filtres) {
      const cle = p.clubCode ?? "";
      if (!parClub.has(cle)) parClub.set(cle, { cle, club: p.club ?? SANS_CLUB, type: p.typeClub, presents: [] });
      parClub.get(cle)!.presents.push(p);
    }
    return [...parClub.values()]; // l'API renvoie déjà les présents triés par club puis par nom
  }, [presents.donnees, recherche, type]);

  const nbPresents = groupes.reduce((s, g) => s + g.presents.length, 0);
  const resumeFiltres = [recherche && `recherche « ${recherche} »`, type && `type ${LIBELLES_TYPE_CLUB[type]}`].filter(Boolean).join(", ");
  const sousTitre = `Séminaire : ${nomSeminaire} · ${nbPresents} présent${nbPresents > 1 ? "s" : ""} · ${groupes.length} club${groupes.length > 1 ? "s" : ""}${
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
      if (format === "pdf") {
        const colonnes: ColonneExport[] = [{ titre: "Nom complet" }, { titre: "Email" }, { titre: "Sessions suivies" }, { titre: "Première présence" }];
        const sections: SectionPdf[] = groupes.map((g) => ({
          titre: `${g.club}${g.type ? ` (${LIBELLES_TYPE_CLUB[g.type]})` : ""} · ${g.presents.length} présent${g.presents.length > 1 ? "s" : ""}`,
          colonnes,
          lignes: g.presents.map((p) => [p.nomComplet, p.email, p.sessions.join(", "), new Date(p.premierePresence)]),
        }));
        await exporterPdfSections({ titre: "Présents par club", sousTitre, nomFichier, sections, paysage: true });
      } else {
        const document: DocumentExport = {
          titre: "Présents par club",
          sousTitre,
          nomFichier,
          colonnes: [
            { titre: "Club" },
            { titre: "Type de club" },
            { titre: "Nom complet" },
            { titre: "Email" },
            { titre: "Nombre de sessions", type: "nombre" },
            { titre: "Sessions suivies" },
            { titre: "Première présence", type: "date" },
            { titre: "QR Code" },
          ],
          lignes: groupes.flatMap((g) =>
            g.presents.map((p) => [
              g.club,
              libelleTypeClub(p.typeClub),
              p.nomComplet,
              p.email,
              p.sessions.length,
              p.sessions.join(", "),
              new Date(p.premierePresence),
              p.qrCode,
            ]),
          ),
        };
        if (format === "csv") exporterCsv(document);
        else await exporterXlsx(document);
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
        description="Participants ayant pointé au moins une session du séminaire, regroupés par club."
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
              placeholder="Rechercher un nom, un email, un club…"
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
            <Bouton
              variante="secondaire"
              taille="petit"
              onClick={() => setReplies(replies.size ? new Set() : new Set(groupes.map((g) => g.cle)))}
              disabled={groupes.length === 0}
            >
              {replies.size ? <ChevronsUpDown size={15} aria-hidden /> : <ChevronsDownUp size={15} aria-hidden />}
              {replies.size ? "Tout déplier" : "Tout replier"}
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
                <span className="font-bold">
                  {g.club}
                  {g.type && <span className="ml-2 text-xs font-semibold text-gris">{LIBELLES_TYPE_CLUB[g.type]}</span>}
                </span>
                <span className="rounded-full bg-rotary-clair px-2.5 py-0.5 text-sm font-semibold text-lien tabular-nums">
                  {g.presents.length} présent{g.presents.length > 1 ? "s" : ""}
                </span>
              </button>
              {ouvert && (
                <div className="overflow-x-auto border-t border-bordure-douce">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-surface-2 text-xs tracking-wide text-gris uppercase">
                      <tr>
                        <th className="w-10 px-3 py-2 font-semibold">#</th>
                        <th className="px-3 py-2 font-semibold">Nom complet</th>
                        <th className="px-3 py-2 font-semibold">Email</th>
                        <th className="px-3 py-2 font-semibold">Sessions suivies</th>
                        <th className="px-3 py-2 font-semibold whitespace-nowrap">Première présence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bordure-douce">
                      {g.presents.map((p, i) => (
                        <tr key={p.qrCode}>
                          <td className="px-3 py-2 text-gris tabular-nums">{i + 1}</td>
                          <td className="px-3 py-2 font-semibold">{p.nomComplet}</td>
                          <td className="px-3 py-2">{p.email}</td>
                          <td className="px-3 py-2">
                            <span className="font-semibold tabular-nums">{p.sessions.length}</span>
                            <span className="text-gris"> · {p.sessions.join(", ")}</span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap tabular-nums">{dateHeure(p.premierePresence)}</td>
                        </tr>
                      ))}
                    </tbody>
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
