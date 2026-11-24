"use client";

import { CheckSquare, Eye, Printer, RotateCcw, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SelecteurSeminaire, useFiltreSeminaire } from "@/components/filtre-seminaire";
import { TableDonnees } from "@/components/table-donnees";
import { Alerte, Bouton, Carte, Champ, EnTete } from "@/components/ui";
import { construireQuery } from "@/lib/api";
import { MODELES_CERTIFICAT, exporterCertificatsPdf, reglageParDefaut, type Reglage, type TypeCertificat } from "@/lib/certificats-pdf";
import { libelleTypeClub } from "@/lib/clubs";
import { useDonnees } from "@/lib/hooks";
import type { PresentClub, TypeClub } from "@/lib/types";

type Onglet = TypeCertificat;
type Ligne = { cle: string; nom: string; club: string; typeClub: TypeClub | null; nombre: number };

const comparateur = new Intl.Collator("fr", { sensitivity: "base" });
const cleReglage = (o: Onglet) => `cnap.certificat.reglage.${o}`;

/** Réglage fin propre à l'imprimante, mémorisé dans ce navigateur pour chaque modèle. */
function lireReglage(o: Onglet): Reglage {
  const defaut = reglageParDefaut(MODELES_CERTIFICAT[o]);
  try {
    const brut = localStorage.getItem(cleReglage(o));
    if (!brut) return defaut;
    const r = JSON.parse(brut) as Partial<Reglage>;
    const nombre = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
    return { haut: nombre(r.haut, 0), droite: nombre(r.droite, 0), taillePolice: nombre(r.taillePolice, defaut.taillePolice) };
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
  const [onglet, setOnglet] = useState<Onglet>("participant");
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
  useEffect(() => setSelection({ participant: new Set(), club: new Set() }), [filtre.seminaireId]);

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

  const modifier = (cles: string[], cocher: boolean) =>
    setSelection((s) => {
      const suivant = new Set(s[onglet]);
      for (const c of cles) {
        if (cocher) suivant.add(c);
        else suivant.delete(c);
      }
      return { ...s, [onglet]: suivant };
    });

  const imprimer = async (apercu: boolean) => {
    setEnvoi(true);
    setErreur(null);
    try {
      const choisis = lignes.filter((l) => coches.has(l.cle)).sort((a, b) => comparateur.compare(a.nom, b.nom));
      // Aperçu sans sélection : quelques noms de la liste suffisent pour vérifier le placement.
      const noms = (choisis.length > 0 || !apercu ? choisis : lignes.slice(0, 3)).map((l) =>
        majuscules ? l.nom.toLocaleUpperCase("fr-FR") : l.nom,
      );
      await exporterCertificatsPdf({
        noms,
        modele,
        reglage,
        apercu,
        nomFichier: onglet === "participant" ? "certificats-participation" : "certificats-remerciements",
      });
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
      {(erreur || presents.erreur) && (
        <div className="mb-4">
          <Alerte>{erreur ?? presents.erreur}</Alerte>
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
            ? "Certificat de participation : participants ayant au moins une présence valide dans le séminaire. Cochez ceux dont le certificat doit être imprimé."
            : "Certificat de remerciements : clubs ayant au moins un participant présent dans le séminaire. Cochez ceux dont le certificat doit être imprimé."}
        </p>
        <TableDonnees
          key={onglet}
          lignes={filtre.seminaireId ? lignes : []}
          chargement={!filtre.pret || presents.chargement}
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
          <div className="grid gap-4 sm:grid-cols-3">
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
            <Champ libelle="Taille de la police (pt)" aide={`Réduite automatiquement jusqu'à ${modele.tailleMin} pt pour les noms longs.`}>
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
