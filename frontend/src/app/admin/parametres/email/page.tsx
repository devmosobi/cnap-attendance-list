"use client";

import { useEffect, useState } from "react";
import { Alerte, Bouton, Carte, Chargement, Champ, EnTete } from "@/components/ui";
import { api } from "@/lib/api";
import { useDonnees } from "@/lib/hooks";
import type { FileEmailStats, ParametresSmtp } from "@/lib/types";

const VIDE = {
  hote: "",
  port: 587,
  utilisateur: "",
  motDePasse: "",
  expediteurEmail: "",
  expediteurNom: "Commission Nationale Formation",
  utiliserTls: true,
  estActif: true,
};

export default function PageParametresEmail() {
  const config = useDonnees<ParametresSmtp | null>("/api/admin/parametres/email");
  const file = useDonnees<FileEmailStats>("/api/admin/parametres/email/file");
  const [v, setV] = useState(VIDE);
  const [motDePasseDefini, setMotDePasseDefini] = useState(false);
  const [retour, setRetour] = useState<{ ton: "erreur" | "succes"; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [destinataire, setDestinataire] = useState("");
  const [test, setTest] = useState<{ ton: "erreur" | "succes"; texte: string } | null>(null);
  const [envoiTest, setEnvoiTest] = useState(false);

  useEffect(() => {
    const c = config.donnees;
    if (!c) return;
    setV({ ...c, utilisateur: c.utilisateur ?? "", motDePasse: "" });
    setMotDePasseDefini(c.motDePasseDefini);
  }, [config.donnees]);

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setRetour(null);
    try {
      const resultat = await api<ParametresSmtp>("/api/admin/parametres/email", {
        method: "PUT",
        body: { ...v, port: Number(v.port), utilisateur: v.utilisateur || null, motDePasse: v.motDePasse || null },
      });
      setMotDePasseDefini(resultat.motDePasseDefini);
      setV((x) => ({ ...x, motDePasse: "" }));
      setRetour({ ton: "succes", texte: "Configuration enregistrée." });
    } catch (e) {
      setRetour({ ton: "erreur", texte: e instanceof Error ? e.message : "Enregistrement impossible." });
    } finally {
      setEnvoi(false);
    }
  };

  const envoyerTest = async () => {
    setEnvoiTest(true);
    setTest(null);
    try {
      await api("/api/admin/parametres/email/test", { method: "POST", body: { destinataire } });
      setTest({ ton: "succes", texte: `Email de test envoyé à ${destinataire}.` });
    } catch (e) {
      setTest({ ton: "erreur", texte: e instanceof Error ? e.message : "Envoi impossible." });
    } finally {
      setEnvoiTest(false);
    }
  };

  const relancer = async () => {
    await api("/api/admin/parametres/email/file/relancer", { method: "POST" });
    file.recharger();
  };

  if (config.chargement && !config.donnees) return <Chargement />;

  return (
    <>
      <EnTete titre="Configuration email" description="Serveur SMTP utilisé pour les confirmations de présence." />
      <div className="grid gap-5 lg:grid-cols-3">
        <Carte titre="Serveur SMTP" className="lg:col-span-2">
          <form onSubmit={enregistrer} className="grid gap-4 sm:grid-cols-2">
            <Champ libelle="Hôte SMTP">
              <input className="champ" value={v.hote} onChange={(e) => setV({ ...v, hote: e.target.value })} required placeholder="smtp.exemple.com" />
            </Champ>
            <Champ libelle="Port" aide="587 (STARTTLS) ou 465 (SSL).">
              <input type="number" className="champ" value={v.port} onChange={(e) => setV({ ...v, port: Number(e.target.value) })} required />
            </Champ>
            <Champ libelle="Utilisateur">
              <input className="champ" autoComplete="off" value={v.utilisateur} onChange={(e) => setV({ ...v, utilisateur: e.target.value })} />
            </Champ>
            <Champ libelle="Mot de passe" aide={motDePasseDefini ? "Laissez vide pour conserver le mot de passe enregistré." : undefined}>
              <input
                type="password"
                className="champ"
                autoComplete="new-password"
                value={v.motDePasse}
                placeholder={motDePasseDefini ? "••••••••" : ""}
                onChange={(e) => setV({ ...v, motDePasse: e.target.value })}
              />
            </Champ>
            <Champ libelle="Adresse expéditeur">
              <input type="email" className="champ" value={v.expediteurEmail} onChange={(e) => setV({ ...v, expediteurEmail: e.target.value })} required />
            </Champ>
            <Champ libelle="Nom expéditeur">
              <input className="champ" value={v.expediteurNom} onChange={(e) => setV({ ...v, expediteurNom: e.target.value })} required />
            </Champ>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-rotary" checked={v.utiliserTls} onChange={(e) => setV({ ...v, utiliserTls: e.target.checked })} />
              Utiliser TLS
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-rotary" checked={v.estActif} onChange={(e) => setV({ ...v, estActif: e.target.checked })} />
              Envoi des emails activé
            </label>
            {retour && (
              <div className="sm:col-span-2">
                <Alerte ton={retour.ton}>{retour.texte}</Alerte>
              </div>
            )}
            <div className="sm:col-span-2">
              <Bouton type="submit" disabled={envoi}>
                {envoi ? "Enregistrement…" : "Enregistrer"}
              </Bouton>
            </div>
          </form>
        </Carte>

        <div className="flex flex-col gap-5">
          <Carte titre="Email de test">
            <div className="flex flex-col gap-3">
              <input
                type="email"
                className="champ"
                placeholder="destinataire@exemple.com"
                value={destinataire}
                onChange={(e) => setDestinataire(e.target.value)}
              />
              <Bouton variante="secondaire" onClick={envoyerTest} disabled={envoiTest || !destinataire}>
                {envoiTest ? "Envoi…" : "Envoyer un email de test"}
              </Bouton>
              {test && <Alerte ton={test.ton}>{test.texte}</Alerte>}
            </div>
          </Carte>
          <Carte
            titre="File d'envoi"
            actions={
              <Bouton variante="secondaire" taille="petit" onClick={file.recharger}>
                Actualiser
              </Bouton>
            }
          >
            {file.donnees && (
              <div className="flex flex-col gap-2 text-sm">
                <p>
                  <strong className="tabular-nums">{file.donnees.enAttente}</strong> en attente ·{" "}
                  <strong className="tabular-nums">{file.donnees.envoyes}</strong> envoyé(s) ·{" "}
                  <strong className="tabular-nums">{file.donnees.echecs}</strong> en échec
                </p>
                {file.donnees.derniereErreur && <p className="text-xs break-words text-red-700 dark:text-red-300">Dernière erreur : {file.donnees.derniereErreur}</p>}
                {file.donnees.echecs > 0 && (
                  <Bouton variante="secondaire" taille="petit" onClick={relancer}>
                    Relancer les envois en échec
                  </Bouton>
                )}
              </div>
            )}
          </Carte>
        </div>
      </div>
    </>
  );
}
