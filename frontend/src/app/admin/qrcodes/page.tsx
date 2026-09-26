"use client";

import Link from "next/link";
import { Ban, Eye, RefreshCw, RotateCcw } from "lucide-react";
import { useState } from "react";
import { BadgeStatutQr, libelleStatutQr } from "@/components/badge-statut-qr";
import { CodesSansSession } from "@/components/codes-sans-session";
import { ImportFichier } from "@/components/import-fichier";
import { TableDonnees } from "@/components/table-donnees";
import { ActionIcone, Alerte, Bouton, Carte, EnTete } from "@/components/ui";
import { api } from "@/lib/api";
import { dateHeure } from "@/lib/format";
import { libelleTypeClub } from "@/lib/clubs";
import { useDonnees, useEstAdministrateur } from "@/lib/hooks";
import type { QrCodeListe } from "@/lib/types";

export default function PageQrCodes() {
  const estAdmin = useEstAdministrateur();
  const { donnees, erreur, chargement, recharger } = useDonnees<QrCodeListe[]>("/api/admin/qrcodes");
  const [message, setMessage] = useState<string | null>(null);

  const changerActivation = async (q: QrCodeListe, desactiver: boolean) => {
    setMessage(null);
    try {
      await api(`/api/admin/qrcodes/${q.code}/${desactiver ? "desactiver" : "reactiver"}`, { method: "POST" });
      recharger();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Opération impossible.");
    }
  };

  return (
    <>
      <EnTete
        titre="QR Codes"
        description="Billets et participants inscrits."
        actions={
          estAdmin && (
            <>
              <CodesSansSession onTermine={recharger} />
              <ImportFichier
                titre="Importer des QR Codes"
                chemin="/api/admin/qrcodes/import"
                consigne="Une colonne « Code » (20 caractères) ; les autres colonnes sont ignorées. Les codes déjà présents sont ignorés."
                onTermine={recharger}
              />
            </>
          )
        }
      />
      {message && (
        <div className="mb-4">
          <Alerte>{message}</Alerte>
        </div>
      )}
      <Carte>
        <TableDonnees
          lignes={donnees}
          erreur={erreur}
          chargement={chargement}
          cleLigne={(q) => q.code}
          titreExport="QR Codes"
          nomFichier="qrcodes"
          triInitial={{ cle: "activation", sens: "desc" }}
          outils={
            <Bouton variante="secondaire" taille="petit" onClick={recharger}>
              <RefreshCw size={15} aria-hidden /> Actualiser
            </Bouton>
          }
          colonnes={[
            {
              cle: "code",
              titre: "Code",
              valeur: (q) => q.code,
              rendu: (q) => (
                <Link href={`/admin/qrcodes/${q.code}`} className="font-mono text-xs font-semibold text-lien hover:underline">
                  {q.code}
                </Link>
              ),
            },
            { cle: "statut", titre: "Statut", valeur: (q) => libelleStatutQr(q.statut), filtre: "liste", rendu: (q) => <BadgeStatutQr statut={q.statut} /> },
            { cle: "nom", titre: "Nom complet", valeur: (q) => q.nomComplet ?? "", classe: "font-semibold" },
            { cle: "email", titre: "Email", valeur: (q) => q.email ?? "" },
            { cle: "club", titre: "Club", valeur: (q) => q.club ?? "", filtre: "liste" },
            { cle: "typeClub", titre: "Type de club", valeur: (q) => libelleTypeClub(q.typeClub), filtre: "liste" },
            { cle: "seminaire", titre: "Séminaire", valeur: (q) => q.seminaire ?? "", filtre: "liste" },
            {
              cle: "activation",
              titre: "Activation",
              valeur: (q) => q.dateActivation ?? "",
              texte: (q) => (q.dateActivation ? dateHeure(q.dateActivation) : ""),
              type: "date",
              classe: "whitespace-nowrap tabular-nums",
            },
            { cle: "presences", titre: "Présences", valeur: (q) => q.nombrePresences, type: "nombre" },
          ]}
          actions={(q) => (
            <>
              <ActionIcone libelle="Voir le détail" icone={Eye} href={`/admin/qrcodes/${q.code}`} />
              {estAdmin && q.statut === "Inactif" && (
                <ActionIcone libelle="Désactiver le QR Code" icone={Ban} ton="danger" onClick={() => changerActivation(q, true)} />
              )}
              {estAdmin && q.statut === "Desactive" && (
                <ActionIcone libelle="Réactiver le QR Code" icone={RotateCcw} ton="succes" onClick={() => changerActivation(q, false)} />
              )}
            </>
          )}
        />
      </Carte>
    </>
  );
}
