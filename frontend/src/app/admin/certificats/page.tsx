"use client";

import { BookmarkCheck, BookmarkX, CheckSquare, Eye, ListChecks, Printer, RotateCcw, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SelecteurSeminaire, useFiltreSeminaire } from "@/components/filtre-seminaire";
import { TableDonnees } from "@/components/table-donnees";
import { Alerte, Badge, Bouton, Carte, Champ, EnTete } from "@/components/ui";
import { api, construireQuery } from "@/lib/api";
import { GRAISSES, MODELES_CERTIFICAT, exporterCertificatsPdf, reglageParDefaut, type Reglage, type TypeCertificat } from "@/lib/certificats-pdf";
import { libelleTypeClub } from "@/lib/clubs";
import { dateHeure } from "@/lib/format";
import { useDonnees } from "@/lib/hooks";
import type { CertificatImprime, PresentClub, TypeClub } from "@/lib/types";

type Onglet = TypeCertificat;
type Ligne = { cle: string; nom: string; club: string; typeClub: TypeClub | null; nombre: number };

const TYPE_API: Record<Onglet, CertificatImprime["type"]> = { participant: "Participant", club: "Club" };
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

const comparateur = new Intl.Collator("fr", { sensitivity: "base" });
/** Ordre d'impression des certificats de participation : par club, puis par nom ; participants sans club en dernier. */
const parClubPuisNom = (a: Ligne, b: Ligne) =>
  Number(!a.club) - Number(!b.club) || comparateur.compare(a.club, b.club) || comparateur.compare(a.nom, b.nom);
const parNom = (a: Ligne, b: Ligne) => comparateur.compare(a.nom, b.nom);
/** Ordre d'impression : par club puis par nom pour les participants, par nom pour les clubs. */
const ordreImpression = (o: Onglet) => (o === "participant" ? parClubPuisNom : parNom);
const cleReglage = (o: Onglet) => `cnap.certificat.reglage.${o}`;

/** Réglage fin propre à l'imprimante, mémorisé dans ce navigateur pour chaque modèle. */
function lireReglage(o: Onglet): Reglage {
  const defaut = reglageParDefaut(MODELES_CERTIFICAT[o]);
  try {
    const brut = localStorage.getItem(cleReglage(o));
    if (!brut) return defaut;
    const r = JSON.parse(brut) as Partial<Reglage>;
    const nombre = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
    return {
      haut: nombre(r.haut, 0),
      droite: nombre(r.droite, 0),
      taillePolice: nombre(r.taillePolice, defaut.taillePolice),
      graisse: nombre(r.graisse, defaut.graisse),
    };
  } catch {
    return defaut;
  }
}

function memoriserReglage(o: Onglet, r: Reglage) {
  try {
    localStorage.setItem(cleReglage(o), JSON.stringify(r));
  } catch {
    // Stockage indisponible : le réglage vaut pour la page seulement.
  }
}

export default function PageCertificats() {
  // Les certificats concernent un séminaire précis : « Tous les séminaires » n'est pas proposé.
  const filtre = useFiltreSeminaire({ obligatoire: true });
  const presents = useDonnees<PresentClub[]>(
    filtre.pret && filtre.seminaireId ? `/api/admin/rapports/presents-par-club${construireQuery({ seminaireId: filtre.seminaireId })}` : null,
  );
  // Certificats déjà marqués comme imprimés (enregistrés en base : partagés entre postes et utilisateurs).
  const imprimes = useDonnees<CertificatImprime[]>(
    filtre.pret && filtre.seminaireId ? `/api/admin/certificats/imprimes${construireQuery({ seminaireId: filtre.seminaireId })}` : null,
  );
  const [onglet, setOnglet] = useState<Onglet>("participant");
  const [tailleLot, setTailleLot] = useState("20");
  /** Lot venant d'être imprimé, en attente de confirmation avant d'être marqué. */
  const [aMarquer, setAMarquer] = useState<{ onglet: Onglet; cles: string[] } | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [majuscules, setMajuscules] = useState(false);
  const [selection, setSelection] = useState<Record<Onglet, Set<string>>>({ participant: new Set(), club: new Set() });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [reglages, setReglages] = useState<Record<Onglet, Reglage>>(() => ({
    participant: reglageParDefaut(MODELES_CERTIFICAT.participant),
    club: reglageParDefaut(MODELES_CERTIFICAT.club),
  }));
  useEffect(() => setReglages({ participant: lireReglage("participant"), club: lireReglage("club") }), []);
  const reglage = reglages[onglet];
  const modele = MODELES_CERTIFICAT[onglet];
  const regler = (r: Reglage) => {
    setReglages((tous) => ({ ...tous, [onglet]: r }));
    memoriserReglage(onglet, r);
  };

  // Changement de séminaire : la sélection repart de zéro (aucun certificat coché par défaut).
  useEffect(() => {
    setSelection({ participant: new Set(), club: new Set() });
    setAMarquer(null);
    setInfo(null);
  }, [filtre.seminaireId]);

  const participants = useMemo<Ligne[]>(
    () =>
      (presents.donnees ?? [])
        .filter((p) => p.nomComplet)
        .map((p) => ({ cle: p.qrCode, nom: p.nomComplet!, club: p.club ?? "", typeClub: p.typeClub, nombre: p.nombreSessions })),
    [presents.donnees],
  );

  // Clubs représentés : au moins un participant présent (les participants sans club ne forment pas un club).
  const clubs = useMemo<Ligne[]>(() => {
    const parClub = new Map<string, Ligne>();
    for (const p of presents.donnees ?? []) {
      if (!p.clubCode || !p.club) continue;
      const ligne = parClub.get(p.clubCode) ?? { cle: p.clubCode, nom: p.club, club: p.club, typeClub: p.typeClub, nombre: 0 };
      ligne.nombre++;
      parClub.set(p.clubCode, ligne);
    }
    return [...parClub.values()].sort((a, b) => comparateur.compare(a.nom, b.nom));
  }, [presents.donnees]);

  const lignes = onglet === "participant" ? participants : clubs;
  const coches = selection[onglet];
  const nbCoches = lignes.filter((l) => coches.has(l.cle)).length;

  const marques = useMemo(() => {
    const m = new Map<string, CertificatImprime>();
    for (const c of imprimes.donnees ?? []) if (c.type === TYPE_API[onglet]) m.set(c.cle, c);
    return m;
  }, [imprimes.donnees, onglet]);
  const nbImprimes = lignes.filter((l) => marques.has(l.cle)).length;
  const nbCochesImprimes = lignes.filter((l) => coches.has(l.cle) && marques.has(l.cle)).length;

  const modifier = (cles: string[], cocher: boolean) =>
    setSelection((s) => {
      const suivant = new Set(s[onglet]);
      for (const c of cles) {
        if (cocher) suivant.add(c);
        else suivant.delete(c);
      }
      return { ...s, [onglet]: suivant };
    });

  /** Coche le prochain lot : les N premiers certificats non imprimés, dans l'ordre d'impression (remplace la sélection). */
  const cocherProchainLot = () => {
    const n = Math.max(1, Math.floor(Number(tailleLot)) || 1);
    const lot = lignes.filter((l) => !marques.has(l.cle)).sort(ordreImpression(onglet)).slice(0, n);
    setSelection((s) => ({ ...s, [onglet]: new Set(lot.map((l) => l.cle)) }));
    setInfo(lot.length === 0 ? "Tous les certificats de cette liste sont déjà marqués comme imprimés." : null);
  };

  const changerMarque = async (o: Onglet, cles: string[], marquer: boolean) => {
    setEnvoi(true);
    setErreur(null);
    setInfo(null);
    try {
      const chemin = marquer ? "/api/admin/certificats/imprimes" : "/api/admin/certificats/imprimes/retirer";
      const { nombre } = await api<{ nombre: number }>(chemin, {
        method: "POST",
        body: { seminaireId: filtre.seminaireId, type: TYPE_API[o], cles },
      });
      if (marquer) {
        // Le lot marqué est décoché : la sélection est prête pour le lot suivant.
        setSelection((s) => {
          const suivant = new Set(s[o]);
          cles.forEach((c) => suivant.delete(c));
          return { ...s, [o]: suivant };
        });
      }
      setAMarquer(null);
      setInfo(marquer ? `${pluriel(nombre, "certificat marqué")} comme imprimé${nombre > 1 ? "s" : ""}.` : `Marque retirée pour ${pluriel(nombre, "certificat")}.`);
      imprimes.recharger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Opération impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  const imprimer = async (apercu: boolean) => {
    setEnvoi(true);
    setErreur(null);
    setInfo(null);
    try {
      const choisis = lignes.filter((l) => coches.has(l.cle)).sort(ordreImpression(onglet));
      // Aperçu sans sélection : quelques noms de la liste suffisent pour vérifier le placement.
      const certificats = (choisis.length > 0 || !apercu ? choisis : lignes.slice(0, 3)).map((l) => ({
        nom: majuscules ? l.nom.toLocaleUpperCase("fr-FR") : l.nom,
        // Certificat de participation : le club du participant sous son nom.
        sousTitre: onglet === "participant" ? l.club || null : null,
      }));
      await exporterCertificatsPdf({
        certificats,
        modele,
        reglage,
        apercu,
        nomFichier: onglet === "participant" ? "certificats-participation" : "certificats-remerciements",
      });
      // Le marquage est confirmé après l'impression : une feuille peut s'être bloquée dans l'imprimante.
      if (!apercu && choisis.length > 0) setAMarquer({ onglet, cles: choisis.map((l) => l.cle) });
    } catch {
      setErreur("La création du PDF a échoué. Veuillez réessayer.");
    } finally {
      setEnvoi(false);
    }
  };

  const ongletClasse = (o: Onglet) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold ${onglet === o ? "bg-rotary text-white" : "text-encre hover:bg-rotary-clair"}`;

  return (
    <>
      <EnTete
        titre="Certificats"
        description="Impression des noms sur les certificats préimprimés : un certificat par page, à imprimer sur A4 à l'échelle 100 % (« Taille réelle »)."
        actions={<SelecteurSeminaire filtre={filtre} tous={false} />}
      />
      {(erreur || presents.erreur || imprimes.erreur) && (
        <div className="mb-4">
          <Alerte>{erreur ?? presents.erreur ?? imprimes.erreur}</Alerte>
        </div>
      )}
      {aMarquer && (
        <div className="mb-4">
          <Alerte ton="info">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                PDF de {pluriel(aMarquer.cles.length, "certificat")} créé. Une fois l&apos;impression vérifiée, marquez-les comme imprimés
                pour les retirer des prochains lots.
              </span>
              <span className="flex gap-2">
                <Bouton variante="secondaire" taille="petit" onClick={() => setAMarquer(null)} disabled={envoi}>
                  Plus tard
                </Bouton>
                <Bouton taille="petit" onClick={() => changerMarque(aMarquer.onglet, aMarquer.cles, true)} disabled={envoi}>
                  <BookmarkCheck size={15} aria-hidden /> Marquer comme imprimés
                </Bouton>
              </span>
            </div>
          </Alerte>
        </div>
      )}
      {info && (
        <div className="mb-4">
          <Alerte ton="succes">{info}</Alerte>
        </div>
      )}
      <Carte>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1" role="tablist">
            <button type="button" role="tab" aria-selected={onglet === "participant"} className={ongletClasse("participant")} onClick={() => setOnglet("participant")}>
              Participants ({participants.length})
            </button>
            <button type="button" role="tab" aria-selected={onglet === "club"} className={ongletClasse("club")} onClick={() => setOnglet("club")}>
              Clubs ({clubs.length})
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-rotary" checked={majuscules} onChange={(e) => setMajuscules(e.target.checked)} />
            Noms en majuscules
          </label>
        </div>
        <p className="mb-3 text-sm text-gris">
          {onglet === "participant"
            ? "Certificat de participation (nom et club en dessous) : participants ayant au moins une présence valide dans le séminaire. Cochez ceux dont le certificat doit être imprimé : l'impression est triée par club, puis par nom."
            : "Certificat de remerciements : clubs ayant au moins un participant présent dans le séminaire. Cochez ceux dont le certificat doit être imprimé."}
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 p-3 text-sm">
          <p className="mr-auto">
            <strong className="tabular-nums">{nbImprimes}</strong> imprimé{nbImprimes > 1 ? "s" : ""} sur{" "}
            <strong className="tabular-nums">{lignes.length}</strong> · <strong className="tabular-nums">{lignes.length - nbImprimes}</strong> à
            imprimer
          </p>
          <label className="flex items-center gap-2">
            Lot de
            <input
              type="number"
              min={1}
              step={1}
              className="champ w-20"
              value={tailleLot}
              onChange={(e) => setTailleLot(e.target.value)}
              aria-label="Nombre de certificats par lot"
            />
          </label>
          <Bouton taille="petit" onClick={cocherProchainLot} disabled={lignes.length === nbImprimes}>
            <ListChecks size={15} aria-hidden /> Cocher le prochain lot
          </Bouton>
          <Bouton
            variante="secondaire"
            taille="petit"
            onClick={() => changerMarque(onglet, lignes.filter((l) => coches.has(l.cle)).map((l) => l.cle), true)}
            disabled={envoi || nbCoches === 0}
          >
            <BookmarkCheck size={15} aria-hidden /> Marquer la sélection imprimée
          </Bouton>
          <Bouton
            variante="secondaire"
            taille="petit"
            onClick={() => changerMarque(onglet, lignes.filter((l) => coches.has(l.cle) && marques.has(l.cle)).map((l) => l.cle), false)}
            disabled={envoi || nbCochesImprimes === 0}
          >
            <BookmarkX size={15} aria-hidden /> Retirer la marque
          </Bouton>
        </div>
        <TableDonnees
          key={onglet}
          lignes={filtre.seminaireId ? lignes : []}
          chargement={!filtre.pret || presents.chargement || imprimes.chargement}
          cleLigne={(l) => l.cle}
          titreExport={onglet === "participant" ? "Certificats – participants" : "Certificats – clubs"}
          nomFichier={onglet === "participant" ? "certificats-participants" : "certificats-clubs"}
          exportable={false}
          triInitial={{ cle: "nom", sens: "asc" }}
          outils={
            <>
              <Bouton variante="secondaire" taille="petit" onClick={() => modifier(lignes.map((l) => l.cle), true)} disabled={lignes.length === 0}>
                <CheckSquare size={15} aria-hidden /> Tout cocher
              </Bouton>
              <Bouton variante="secondaire" taille="petit" onClick={() => modifier(lignes.map((l) => l.cle), false)} disabled={nbCoches === 0}>
                <Square size={15} aria-hidden /> Tout décocher
              </Bouton>
              <Bouton variante="secondaire" taille="petit" onClick={() => imprimer(true)} disabled={envoi || lignes.length === 0}>
                <Eye size={15} aria-hidden /> Aperçu sur le modèle
              </Bouton>
              <Bouton taille="petit" onClick={() => imprimer(false)} disabled={envoi || nbCoches === 0}>
                <Printer size={15} aria-hidden /> {envoi ? "Création du PDF…" : `Imprimer ${nbCoches} certificat${nbCoches > 1 ? "s" : ""}`}
              </Bouton>
            </>
          }
          colonnes={[
            {
              cle: "imprimer",
              titre: "Imprimer",
              valeur: (l) => (coches.has(l.cle) ? "Oui" : "Non"),
              filtre: "liste",
              exportable: false,
              rendu: (l) => (
                <input
                  type="checkbox"
                  className="size-4 accent-rotary"
                  checked={coches.has(l.cle)}
                  onChange={(e) => modifier([l.cle], e.target.checked)}
                  aria-label={`Imprimer le certificat de ${l.nom}`}
                />
              ),
            },
            {
              cle: "statut",
              titre: "Statut",
              valeur: (l) => (marques.has(l.cle) ? "Imprimé" : "À imprimer"),
              filtre: "liste",
              rendu: (l) => {
                const m = marques.get(l.cle);
                return (
                  <span title={m ? `Marqué le ${dateHeure(m.imprimeLe)} par ${m.imprimePar}` : undefined} className="inline-flex flex-col gap-0.5">
                    <Badge actif={!!m} oui="Imprimé" non="À imprimer" />
                    {m && <span className="text-xs whitespace-nowrap text-gris tabular-nums">{dateHeure(m.imprimeLe)}</span>}
                  </span>
                );
              },
            },
            { cle: "nom", titre: onglet === "participant" ? "Nom complet" : "Club", valeur: (l) => l.nom, classe: "font-semibold" },
            ...(onglet === "participant" ? [{ cle: "club", titre: "Club", valeur: (l: Ligne) => l.club, filtre: "liste" as const }] : []),
            { cle: "typeClub", titre: "Type de club", valeur: (l) => libelleTypeClub(l.typeClub), filtre: "liste" },
            {
              cle: "nombre",
              titre: onglet === "participant" ? "Sessions suivies" : "Participants présents",
              valeur: (l) => l.nombre,
              type: "nombre",
            },
          ]}
        />
      </Carte>

      <Carte titre={`Réglage de l'impression · ${modele.libelle}`} className="mt-5">
        <div className="flex flex-col gap-4 text-sm">
          <p className="text-gris">
            Placez les feuilles préimprimées dans le bac dans le même sens que le modèle (certificat tourné, haut du certificat sur le bord
            gauche de la feuille). Vérifiez d&apos;abord avec « Aperçu sur le modèle », puis imprimez un certificat sur papier blanc et
            superposez-le à une feuille préimprimée à contre-jour. Si le nom est décalé, corrigez ci-dessous (réglage mémorisé dans ce
            navigateur).
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Champ libelle="Monter le nom (mm)" aide="Valeur négative pour le descendre.">
              <input
                type="number"
                step={0.5}
                className="champ"
                value={reglage.haut}
                onChange={(e) => regler({ ...reglage, haut: Number(e.target.value) || 0 })}
              />
            </Champ>
            <Champ libelle="Décaler vers la droite (mm)" aide="Valeur négative pour aller à gauche.">
              <input
                type="number"
                step={0.5}
                className="champ"
                value={reglage.droite}
                onChange={(e) => regler({ ...reglage, droite: Number(e.target.value) || 0 })}
              />
            </Champ>
            <Champ libelle="Taille de la police (pt)" aide={`Réduite automatiquement jusqu'à ${modele.tailleMin} pt pour les noms longs${modele.sousTitre ? ` ; ${modele.sousTitre.tailleNomMax} pt au plus lorsque le club est imprimé dessous` : ""}.`}>
              <input
                type="number"
                min={modele.tailleMin}
                max={48}
                step={1}
                className="champ"
                value={reglage.taillePolice}
                onChange={(e) => regler({ ...reglage, taillePolice: Number(e.target.value) || modele.taillePolice })}
              />
            </Champ>
            <Champ libelle="Renfort du gras" aide="Épaissit le tracé des lettres si l'impression est pâle (jet d'encre).">
              <select className="champ" value={reglage.graisse} onChange={(e) => regler({ ...reglage, graisse: Number(e.target.value) })}>
                {GRAISSES.map((libelle, niveau) => (
                  <option key={libelle} value={niveau}>
                    {libelle}
                  </option>
                ))}
              </select>
            </Champ>
          </div>
          <div>
            <Bouton variante="secondaire" taille="petit" onClick={() => regler(reglageParDefaut(modele))}>
              <RotateCcw size={15} aria-hidden /> Valeurs par défaut
            </Bouton>
          </div>
        </div>
      </Carte>
    </>
  );
}
