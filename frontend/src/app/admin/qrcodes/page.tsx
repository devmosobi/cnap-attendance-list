"use client";

import Link from "next/link";
import { Eye, RefreshCw } from "lucide-react";
import { ImportFichier } from "@/components/import-fichier";
import { TableDonnees } from "@/components/table-donnees";
import { ActionIcone, Badge, Bouton, Carte, EnTete } from "@/components/ui";
import { dateHeure } from "@/lib/format";
import { useDonnees, useEstAdministrateur } from "@/lib/hooks";
import type { QrCodeListe } from "@/lib/types";

export default function PageQrCodes() {
  const estAdmin = useEstAdministrateur();
  const { donnees, erreur, chargement, recharger } = useDonnees<QrCodeListe[]>("/api/admin/qrcodes");

  return (
    <>
      <EnTete
        titre="QR Codes"
        description="Billets et participants inscrits."
        actions={
          estAdmin && (
            <ImportFichier
              titre="Importer des QR Codes"
              chemin="/api/admin/qrcodes/import"
              consigne="Une colonne « Code » (20 caractères) ; les autres colonnes sont ignorées. Les codes déjà présents sont ignorés."
              onTermine={recharger}
            />
          )
        }
      />
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
            { cle: "statut", titre: "Statut", valeur: (q) => q.statut, filtre: "liste", rendu: (q) => <Badge actif={q.statut === "Actif"} /> },
            { cle: "nom", titre: "Nom complet", valeur: (q) => q.nomComplet ?? "", classe: "font-semibold" },
            { cle: "email", titre: "Email", valeur: (q) => q.email ?? "" },
            { cle: "club", titre: "Club", valeur: (q) => q.club ?? "", filtre: "liste" },
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
          actions={(q) => <ActionIcone libelle="Voir le détail" icone={Eye} href={`/admin/qrcodes/${q.code}`} />}
        />
      </Carte>
    </>
  );
}
