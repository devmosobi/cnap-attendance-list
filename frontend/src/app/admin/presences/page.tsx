"use client";

import { Ban, Eye, RefreshCw, RotateCcw } from "lucide-react";
import { useState } from "react";
import { BadgeLieu } from "@/components/badge-lieu";
import { BadgeValidite, libelleValidite } from "@/components/badge-validite";
import { TableDonnees } from "@/components/table-donnees";
import { ActionIcone, Alerte, Bouton, Carte, Champ, Confirmer, EnTete, Modale } from "@/components/ui";
import { api } from "@/lib/api";
import { libelleTypeClub } from "@/lib/clubs";
import { dateHeure } from "@/lib/format";
import { useDonnees } from "@/lib/hooks";
import { LIBELLES_RESULTAT, formaterDistance } from "@/lib/lieu";
import type { PresenceListe } from "@/lib/types";

const MOTIFS = ["Pointage hors du site de la formation", "Pointage effectué pour un absent", "Erreur de pointage"];

export default function PagePresences() {
  const { donnees, erreur, chargement, recharger } = useDonnees<PresenceListe[]>("/api/admin/presences");
  const [aInvalider, setAInvalider] = useState<PresenceListe | null>(null);
  const [aRetablir, setARetablir] = useState<PresenceListe | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const nbInvalidees = donnees?.filter((p) => p.estInvalidee).length ?? 0;

  return (
    <>
      <EnTete
        titre="Suivi des présences"
        description="Filtrez sur n'importe quelle colonne ; les exports reprennent les filtres et le tri affichés. Une présence invalidée reste visible ici mais est exclue des statistiques et des exports."
      />
      {message && (
        <div className="mb-4">
          <Alerte>{message}</Alerte>
        </div>
      )}
      <Carte>
        {nbInvalidees > 0 && (
          <p className="mb-3 flex items-center gap-1.5 text-sm text-gris">
            <Ban size={14} aria-hidden className="text-red-700 dark:text-red-300" />
            {nbInvalidees} présence{nbInvalidees > 1 ? "s" : ""} invalidée{nbInvalidees > 1 ? "s" : ""}, exclue{nbInvalidees > 1 ? "s" : ""} des
            statistiques et des exports.
          </p>
        )}
        <TableDonnees
          lignes={donnees}
          erreur={erreur}
          chargement={chargement}
          cleLigne={(p) => p.id}
          titreExport="Suivi des présences"
          nomFichier="presences"
          triInitial={{ cle: "pointage", sens: "desc" }}
          exclureDesExports={{ exclure: (p) => p.estInvalidee, libelle: "présence(s) invalidée(s) exclue(s)" }}
          outils={
            <Bouton variante="secondaire" taille="petit" onClick={recharger}>
              <RefreshCw size={15} aria-hidden /> Actualiser
            </Bouton>
          }
          colonnes={[
            {
              cle: "nom",
              titre: "Nom complet",
              valeur: (p) => p.nomComplet ?? "",
              rendu: (p) => <span className={`font-semibold ${p.estInvalidee ? "text-gris line-through" : ""}`}>{p.nomComplet}</span>,
            },
            { cle: "email", titre: "Email", valeur: (p) => p.email ?? "" },
            { cle: "club", titre: "Club", valeur: (p) => p.club ?? "", filtre: "liste" },
            { cle: "typeClub", titre: "Type de club", valeur: (p) => libelleTypeClub(p.typeClub), filtre: "liste" },
            { cle: "seminaire", titre: "Séminaire", valeur: (p) => p.seminaire, filtre: "liste" },
            { cle: "session", titre: "Session", valeur: (p) => p.session, filtre: "liste" },
            {
              cle: "pointage",
              titre: "Heure de pointage",
              valeur: (p) => p.heureDePointage,
              texte: (p) => dateHeure(p.heureDePointage),
              type: "date",
              classe: "whitespace-nowrap tabular-nums",
            },
            {
              cle: "lieu",
              titre: "Lieu",
              valeur: (p) => LIBELLES_RESULTAT[p.resultatPosition],
              filtre: "liste",
              rendu: (p) => <BadgeLieu resultat={p.resultatPosition} distance={p.distanceMetres} />,
            },
            {
              cle: "distance",
              titre: "Distance (m)",
              valeur: (p) => p.distanceMetres ?? "",
              texte: (p) => (p.distanceMetres === null ? "" : String(p.distanceMetres)),
              type: "nombre",
              filtre: false,
            },
            {
              cle: "validite",
              titre: "Validité",
              valeur: (p) => libelleValidite(p.estInvalidee),
              filtre: "liste",
              exportable: false,
              rendu: (p) => (
                <BadgeValidite
                  estInvalidee={p.estInvalidee}
                  motif={p.motifInvalidation}
                  detail={p.invalideeLe ? `par ${p.invalideePar ?? "?"} le ${dateHeure(p.invalideeLe)}` : undefined}
                />
              ),
            },
            { cle: "motif", titre: "Motif d'invalidation", valeur: (p) => p.motifInvalidation ?? "", classe: "text-gris", exportable: false },
            { cle: "code", titre: "QR Code", valeur: (p) => p.qrCode, classe: "font-mono text-xs" },
          ]}
          actions={(p) => (
            <>
              <ActionIcone libelle="Voir le participant" icone={Eye} href={`/admin/qrcodes/${p.qrCode}`} />
              {p.estInvalidee ? (
                <ActionIcone libelle="Rétablir la présence" icone={RotateCcw} ton="succes" onClick={() => setARetablir(p)} />
              ) : (
                <ActionIcone libelle="Invalider la présence" icone={Ban} ton="danger" onClick={() => setAInvalider(p)} />
              )}
            </>
          )}
        />
      </Carte>

      {aInvalider && (
        <FormulaireInvalidation
          presence={aInvalider}
          onFermer={() => setAInvalider(null)}
          onTermine={() => {
            setAInvalider(null);
            recharger();
          }}
        />
      )}
      <Confirmer
        ouverte={!!aRetablir}
        message={`Rétablir la présence de ${aRetablir?.nomComplet} (${aRetablir?.session}) ? Elle sera de nouveau comptée dans les statistiques.`}
        libelle="Rétablir"
        onAnnuler={() => setARetablir(null)}
        onConfirmer={async () => {
          setMessage(null);
          try {
            await api(`/api/admin/presences/${aRetablir!.id}/retablir`, { method: "POST" });
            recharger();
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Rétablissement impossible.");
          }
          setARetablir(null);
        }}
      />
    </>
  );
}

function FormulaireInvalidation({ presence, onFermer, onTermine }: { presence: PresenceListe; onFermer: () => void; onTermine: () => void }) {
  const horsZone = presence.resultatPosition === "HorsZone" && presence.distanceMetres !== null;
  const [motif, setMotif] = useState(horsZone ? `${MOTIFS[0]} (à ${formaterDistance(presence.distanceMetres)})` : "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      await api(`/api/admin/presences/${presence.id}/invalider`, { method: "POST", body: { motif: motif.trim() || null } });
      onTermine();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Invalidation impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Modale titre="Invalider la présence" ouverte onFermer={onFermer}>
      <form onSubmit={valider} className="flex flex-col gap-4">
        <div className="rounded-lg bg-surface-2 p-3 text-sm">
          <p className="font-semibold">{presence.nomComplet}</p>
          <p className="text-gris">
            {presence.session} · {dateHeure(presence.heureDePointage)}
          </p>
          <div className="mt-1">
            <BadgeLieu resultat={presence.resultatPosition} distance={presence.distanceMetres} />
          </div>
        </div>
        <p className="text-sm text-gris">
          La présence reste visible dans le suivi mais n&apos;est plus comptée dans les statistiques ni dans les exports. Elle peut être
          rétablie à tout moment. Le participant ne pourra pas pointer de nouveau cette session.
        </p>
        <Champ libelle="Motif (facultatif)">
          <textarea className="champ" rows={2} maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)} />
        </Champ>
        <div className="flex flex-wrap gap-2">
          {MOTIFS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMotif(m)}
              className="rounded-full border border-bordure px-2.5 py-1 text-xs text-encre hover:bg-surface-2"
            >
              {m}
            </button>
          ))}
        </div>
        {erreur && <Alerte>{erreur}</Alerte>}
        <div className="flex justify-end gap-2">
          <Bouton variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton type="submit" variante="danger" disabled={envoi}>
            <Ban size={15} aria-hidden /> Invalider
          </Bouton>
        </div>
      </form>
    </Modale>
  );
}
