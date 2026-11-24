"use client";

import { Printer, Sparkles } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { exporterBilletsPdf } from "@/lib/billets-pdf";
import type { GenerationResultat, Seminaire } from "@/lib/types";
import { Alerte, Bouton, Champ, Modale } from "./ui";

const MAXIMUM = 1000;
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;
const origine = () => (typeof window === "undefined" ? "" : window.location.origin);

/** Rappel du domaine encodé dans les QR Codes : celui sur lequel la console est ouverte. */
function NoteDomaine() {
  return (
    <p className="text-xs text-gris">
      Les QR Codes ouvrent <span className="font-mono">{origine()}/attendance=…</span> : le domaine utilisé est celui de cette console.
    </p>
  );
}

async function telechargerPdf(codes: string[], seminaire: string) {
  await exporterBilletsPdf({ codes, seminaire, origine: origine(), nomFichier: "qrcodes-a-imprimer" });
}

/** Génère des billets réservés à un séminaire actif, en complément de l'import d'un fichier de codes. */
export function GenererQrCodes({ seminaires, seminaireId, onTermine }: { seminaires: Seminaire[]; seminaireId: string; onTermine: () => void }) {
  const actifs = seminaires.filter((s) => s.estActif);
  const [ouverte, setOuverte] = useState(false);
  const [choix, setChoix] = useState("");
  const [nombre, setNombre] = useState("50");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<{ codes: string[]; seminaire: string } | null>(null);

  const ouvrir = () => {
    setChoix(actifs.some((s) => s.id === seminaireId) ? seminaireId : (actifs[0]?.id ?? ""));
    setNombre("50");
    setErreur(null);
    setResultat(null);
    setOuverte(true);
  };

  const generer = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(nombre);
    if (!Number.isInteger(n) || n < 1 || n > MAXIMUM) return setErreur(`Saisissez un nombre entre 1 et ${MAXIMUM}.`);
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api<GenerationResultat>("/api/admin/qrcodes/generer", { method: "POST", body: { seminaireId: choix, nombre: n } });
      setResultat({ codes: r.codes, seminaire: actifs.find((s) => s.id === choix)?.designation ?? "" });
      onTermine();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Génération impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  const imprimer = async () => {
    if (!resultat) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await telechargerPdf(resultat.codes, resultat.seminaire);
    } catch {
      setErreur("La création du PDF a échoué. Veuillez réessayer.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <>
      <Bouton variante="secondaire" onClick={ouvrir} disabled={actifs.length === 0} title={actifs.length === 0 ? "Aucun séminaire actif" : undefined}>
        <Sparkles size={16} aria-hidden /> Générer
      </Bouton>
      <Modale titre="Générer des QR Codes" ouverte={ouverte} onFermer={() => setOuverte(false)}>
        {!resultat ? (
          <form onSubmit={generer} className="flex flex-col gap-4">
            <p className="text-sm text-gris">
              Les QR Codes générés sont réservés au séminaire choisi : au scan, seules ses sessions sont proposées. Les codes importés
              depuis un fichier restent utilisables pour tous les séminaires.
            </p>
            <Champ libelle="Séminaire (actif)">
              <select className="champ" value={choix} onChange={(e) => setChoix(e.target.value)} required>
                {actifs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.designation}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ libelle="Nombre de QR Codes" aide={`Entre 1 et ${MAXIMUM} par génération (25 billets par page imprimée).`}>
              <input type="number" className="champ" min={1} max={MAXIMUM} step={1} value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </Champ>
            {erreur && <Alerte>{erreur}</Alerte>}
            <div className="flex justify-end gap-2">
              <Bouton variante="secondaire" onClick={() => setOuverte(false)}>
                Annuler
              </Bouton>
              <Bouton type="submit" disabled={envoi || !choix}>
                <Sparkles size={15} aria-hidden /> {envoi ? "Génération…" : "Générer"}
              </Bouton>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <Alerte ton="succes">
              {pluriel(resultat.codes.length, "QR Code généré")} pour « {resultat.seminaire} ».
            </Alerte>
            <NoteDomaine />
            {erreur && <Alerte>{erreur}</Alerte>}
            <div className="flex justify-end gap-2">
              <Bouton variante="secondaire" onClick={() => setOuverte(false)}>
                Fermer
              </Bouton>
              <Bouton onClick={imprimer} disabled={envoi}>
                <Printer size={15} aria-hidden /> {envoi ? "Création du PDF…" : `Imprimer ces ${resultat.codes.length} QR Codes`}
              </Bouton>
            </div>
          </div>
        )}
      </Modale>
    </>
  );
}

/** PDF des QR Codes non utilisés (statut Inactif) du séminaire sélectionné, à imprimer puis découper. */
export function ImprimerQrCodes({ codes, seminaire }: { codes: string[]; seminaire: Seminaire | null }) {
  const [ouverte, setOuverte] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const indisponible = !seminaire ? "Choisissez un séminaire dans le filtre" : codes.length === 0 ? "Aucun QR Code non utilisé pour ce séminaire" : undefined;

  const imprimer = async () => {
    if (!seminaire) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await telechargerPdf(codes, seminaire.designation);
      setOuverte(false);
    } catch {
      setErreur("La création du PDF a échoué. Veuillez réessayer.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <>
      <Bouton variante="secondaire" onClick={() => setOuverte(true)} disabled={!!indisponible} title={indisponible}>
        <Printer size={16} aria-hidden /> Imprimer{seminaire && codes.length > 0 ? ` (${codes.length})` : ""}
      </Bouton>
      <Modale titre="Imprimer les QR Codes non utilisés" ouverte={ouverte} onFermer={() => setOuverte(false)}>
        <div className="flex flex-col gap-4 text-sm">
          <p>
            <strong className="tabular-nums">{pluriel(codes.length, "QR Code")}</strong> non utilisé{codes.length > 1 ? "s" : ""} pour «{" "}
            {seminaire?.designation} », soit {pluriel(Math.ceil(codes.length / 25), "page")} A4 de 25 billets à découper (logo, titre du séminaire
            et QR Code).
          </p>
          <p className="text-gris">Imprimez à l&apos;échelle 100 % (« Taille réelle ») pour conserver les dimensions des billets.</p>
          <NoteDomaine />
          {erreur && <Alerte>{erreur}</Alerte>}
          <div className="flex justify-end gap-2">
            <Bouton variante="secondaire" onClick={() => setOuverte(false)}>
              Annuler
            </Bouton>
            <Bouton onClick={imprimer} disabled={envoi}>
              <Printer size={15} aria-hidden /> {envoi ? "Création du PDF…" : "Télécharger le PDF"}
            </Bouton>
          </div>
        </div>
      </Modale>
    </>
  );
}
