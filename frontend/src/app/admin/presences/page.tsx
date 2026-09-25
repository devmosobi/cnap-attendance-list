"use client";

import { Eye, RefreshCw } from "lucide-react";
import { TableDonnees } from "@/components/table-donnees";
import { ActionIcone, Bouton, Carte, EnTete } from "@/components/ui";
import { dateHeure } from "@/lib/format";
import { useDonnees } from "@/lib/hooks";
import type { PresenceListe } from "@/lib/types";

export default function PagePresences() {
  const { donnees, erreur, chargement, recharger } = useDonnees<PresenceListe[]>("/api/admin/presences");

  return (
    <>
      <EnTete titre="Suivi des présences" description="Filtrez sur n'importe quelle colonne ; les exports reprennent les filtres et le tri affichés." />
      <Carte>
        <TableDonnees
          lignes={donnees}
          erreur={erreur}
          chargement={chargement}
          cleLigne={(p) => p.id}
          titreExport="Suivi des présences"
          nomFichier="presences"
          triInitial={{ cle: "pointage", sens: "desc" }}
          outils={
            <Bouton variante="secondaire" taille="petit" onClick={recharger}>
              <RefreshCw size={15} aria-hidden /> Actualiser
            </Bouton>
          }
          colonnes={[
            { cle: "nom", titre: "Nom complet", valeur: (p) => p.nomComplet ?? "", classe: "font-semibold" },
            { cle: "email", titre: "Email", valeur: (p) => p.email ?? "" },
            { cle: "club", titre: "Club", valeur: (p) => p.club ?? "", filtre: "liste" },
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
            { cle: "code", titre: "QR Code", valeur: (p) => p.qrCode, classe: "font-mono text-xs" },
          ]}
          actions={(p) => <ActionIcone libelle="Voir le participant" icone={Eye} href={`/admin/qrcodes/${p.qrCode}`} />}
        />
      </Carte>
    </>
  );
}
