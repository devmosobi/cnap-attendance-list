"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { use, useState } from "react";
import { BadgeLieu } from "@/components/badge-lieu";
import { BadgeStatutQr } from "@/components/badge-statut-qr";
import { BadgeValidite, libelleValidite } from "@/components/badge-validite";
import { TableDonnees } from "@/components/table-donnees";
import { Alerte, Bouton, Carte, Chargement, Champ, EnTete, Modale } from "@/components/ui";
import { api } from "@/lib/api";
import { dateHeure } from "@/lib/format";
import { useDonnees, useEstAdministrateur } from "@/lib/hooks";
import { LIBELLES_RESULTAT } from "@/lib/lieu";
import type { Club, QrCodeDetail } from "@/lib/types";

export default function PageQrCode({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const estAdmin = useEstAdministrateur();
  const { donnees: qr, erreur, recharger } = useDonnees<QrCodeDetail>(`/api/admin/qrcodes/${code}`);
  const [edition, setEdition] = useState(false);

  return (
    <>
      <Link href="/admin/qrcodes" className="text-sm text-lien hover:underline">
        ← QR Codes
      </Link>
      <EnTete
        titre={qr?.nomComplet ?? "QR Code"}
        description={code}
        actions={
          estAdmin && qr?.statut === "Actif" ? (
            <Bouton variante="secondaire" onClick={() => setEdition(true)}>
              <Pencil size={16} aria-hidden /> Modifier le participant
            </Bouton>
          ) : undefined
        }
      />
      {erreur && <Alerte>{erreur}</Alerte>}
      {!qr && !erreur && <Chargement />}
      {qr && (
        <div className="grid gap-5 lg:grid-cols-3">
          <Carte titre="Participant">
            <dl className="grid gap-3 text-sm">
              <Info terme="Statut" valeur={<BadgeStatutQr statut={qr.statut} />} />
              <Info terme="Nom complet" valeur={qr.nomComplet ?? "—"} />
              <Info terme="Email" valeur={qr.email ?? "—"} />
              <Info terme="Club" valeur={qr.club ?? "—"} />
              <Info terme="Séminaire d'inscription" valeur={qr.seminaire ?? "—"} />
              <Info terme="Activation" valeur={dateHeure(qr.dateActivation)} />
            </dl>
          </Carte>
          <Carte titre={`Historique des présences (${qr.presences.length})`} className="lg:col-span-2">
            <TableDonnees
              lignes={qr.presences}
              cleLigne={(p) => p.id}
              titreExport={`Historique des présences – ${qr.nomComplet ?? qr.code}`}
              nomFichier={`presences-${qr.code}`}
              triInitial={{ cle: "pointage", sens: "asc" }}
              exclureDesExports={{ exclure: (p) => p.estInvalidee, libelle: "présence(s) invalidée(s) exclue(s)" }}
              colonnes={[
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
                  rendu: (p) => <BadgeValidite estInvalidee={p.estInvalidee} motif={p.motifInvalidation} />,
                  exportable: false,
                },
                { cle: "motif", titre: "Motif d'invalidation", valeur: (p) => p.motifInvalidation ?? "", classe: "text-gris", exportable: false },
              ]}
            />
          </Carte>
        </div>
      )}
      {qr && edition && (
        <EditionParticipant
          qr={qr}
          onFermer={() => setEdition(false)}
          onEnregistre={() => {
            setEdition(false);
            recharger();
          }}
        />
      )}
    </>
  );
}

function Info({ terme, valeur }: { terme: string; valeur: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-gris uppercase">{terme}</dt>
      <dd className="mt-0.5 break-words">{valeur}</dd>
    </div>
  );
}

function EditionParticipant({ qr, onFermer, onEnregistre }: { qr: QrCodeDetail; onFermer: () => void; onEnregistre: () => void }) {
  const clubs = useDonnees<Club[]>("/api/admin/clubs");
  const [valeurs, setValeurs] = useState({ nomComplet: qr.nomComplet ?? "", email: qr.email ?? "", clubCode: qr.clubCode ?? "" });
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      await api(`/api/admin/qrcodes/${qr.code}/participant`, { method: "PUT", body: valeurs });
      onEnregistre();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Modale titre="Modifier le participant" ouverte onFermer={onFermer}>
      <form onSubmit={enregistrer} className="flex flex-col gap-4">
        <p className="text-sm text-gris">Correction d&apos;une erreur de saisie. L&apos;historique des présences est conservé.</p>
        <Champ libelle="Nom complet">
          <input className="champ" value={valeurs.nomComplet} onChange={(e) => setValeurs({ ...valeurs, nomComplet: e.target.value })} required />
        </Champ>
        <Champ libelle="Email">
          <input className="champ" type="email" value={valeurs.email} onChange={(e) => setValeurs({ ...valeurs, email: e.target.value })} required />
        </Champ>
        <Champ libelle="Club">
          <select className="champ" value={valeurs.clubCode} onChange={(e) => setValeurs({ ...valeurs, clubCode: e.target.value })} required>
            {clubs.donnees?.map((c) => (
              <option key={c.code} value={c.code}>
                {c.nom}
              </option>
            ))}
          </select>
        </Champ>
        {erreur && <Alerte>{erreur}</Alerte>}
        <div className="flex justify-end gap-2">
          <Bouton variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton type="submit" disabled={envoi}>
            Enregistrer
          </Bouton>
        </div>
      </form>
    </Modale>
  );
}
