"use client";

import { MapPin } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { dateLongue, heure, plage } from "@/lib/format";
import { obtenirPosition } from "@/lib/lieu";
import type { PresenceConfirmation, ScanEtat } from "@/lib/types";

type Etat =
  | { type: "chargement" }
  | { type: "invalide" }
  | { type: "erreur"; message: string }
  | { type: "formulaire"; donnees: ScanEtat }
  | { type: "confirme"; confirmation: PresenceConfirmation };

export function ScanClient({ code }: { code: string | null }) {
  const [etat, setEtat] = useState<Etat>(code ? { type: "chargement" } : { type: "invalide" });

  const charger = useCallback(async () => {
    if (!code) return;
    setEtat({ type: "chargement" });
    try {
      const donnees = await api<ScanEtat>(`/api/public/scan/${code}`, { public: true, cache: "no-store" });
      setEtat({ type: "formulaire", donnees });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setEtat({ type: "invalide" });
      else setEtat({ type: "erreur", message: e instanceof Error ? e.message : "Erreur inattendue." });
    }
  }, [code]);

  useEffect(() => {
    void charger();
  }, [charger]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-8">
      <header className="flex flex-col items-center gap-2 pt-5 pb-4">
        <Image src="/logo-cnap.jpeg" alt="Commission Nationale Formation" width={240} height={80} priority className="h-auto w-56" />
        <p className="text-center text-xs font-semibold tracking-wide text-gris uppercase">Liste de présence · District 9101</p>
      </header>
      <div className="h-1 w-full rounded-full bg-or" />

      <section className="mt-5 flex-1">
        {etat.type === "chargement" && <Chargement />}
        {etat.type === "invalide" && (
          <Message
            icone="✕"
            ton="rouge"
            titre="Code invalide"
            texte="Ce billet n'est pas reconnu. Vérifiez que vous avez scanné le QR Code de votre billet ou adressez-vous à l'accueil."
          />
        )}
        {etat.type === "erreur" && (
          <Message icone="!" ton="orange" titre="Service momentanément indisponible" texte={etat.message}>
            <BoutonPrincipal onClick={charger}>Réessayer</BoutonPrincipal>
          </Message>
        )}
        {etat.type === "formulaire" && code && (
          <Formulaire code={code} donnees={etat.donnees} onConfirme={(c) => setEtat({ type: "confirme", confirmation: c })} />
        )}
        {etat.type === "confirme" && <Confirmation confirmation={etat.confirmation} onAutre={charger} />}
      </section>

      <footer className="mt-8 text-center text-xs text-gris">
        Commission Nationale Formation ·{" "}
        <a className="underline" href="https://cnap-ci.rotary-district9101.org/" target="_blank" rel="noreferrer">
          cnap-ci.rotary-district9101.org
        </a>
      </footer>
    </main>
  );
}

function Formulaire({
  code,
  donnees,
  onConfirme,
}: {
  code: string;
  donnees: ScanEtat;
  onConfirme: (c: PresenceConfirmation) => void;
}) {
  const premierScan = donnees.statut === "Inactif";
  const seminaires = donnees.seminaires;
  const [seminaireId, setSeminaireId] = useState(seminaires.length === 1 ? seminaires[0].id : "");
  const [sessionId, setSessionId] = useState("");
  const [clubCode, setClubCode] = useState("");
  const [nomComplet, setNomComplet] = useState("");
  const [email, setEmail] = useState("");
  const [etape, setEtape] = useState<"saisie" | "localisation" | "envoi">("saisie");
  const [erreur, setErreur] = useState<string | null>(null);

  const dejaPointees = useMemo(() => new Map(donnees.presences.map((p) => [p.sessionId, p.heureDePointage])), [donnees.presences]);
  const seminaire = seminaires.find((s) => s.id === seminaireId);
  const sessions = seminaire?.sessions ?? [];
  const controleLieu = seminaire !== undefined && seminaire.controlePosition !== "Desactive";

  // Présélection de la session si une seule reste disponible.
  useEffect(() => {
    const disponibles = sessions.filter((s) => !dejaPointees.has(s.id));
    setSessionId(disponibles.length === 1 ? disponibles[0].id : "");
  }, [seminaireId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (seminaires.length === 0) {
    return (
      <Message
        icone="⏸"
        ton="orange"
        titre="Pointage indisponible"
        texte="Aucune session de formation n'est ouverte au pointage pour le moment. Réessayez à l'ouverture de la session."
      />
    );
  }

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    if (!seminaireId) return setErreur("Veuillez sélectionner le séminaire.");
    if (!sessionId) return setErreur("Veuillez sélectionner la session.");
    if (premierScan) {
      if (!clubCode) return setErreur("Veuillez sélectionner votre club.");
      if (nomComplet.trim().length < 2) return setErreur("Veuillez saisir votre nom complet.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErreur("Veuillez saisir une adresse email valide.");
    }

    try {
      // Position demandée uniquement si le séminaire contrôle le lieu ; un refus n'empêche pas l'envoi,
      // c'est le serveur qui décide selon le mode (signaler ou refuser).
      let position = null;
      if (controleLieu) {
        setEtape("localisation");
        const p = await obtenirPosition();
        if (p) position = { latitude: p.latitude, longitude: p.longitude, precision: p.precision };
      }
      setEtape("envoi");
      const identite = premierScan ? { clubCode, nomComplet: nomComplet.trim(), email: email.trim() } : {};
      const confirmation = await api<PresenceConfirmation>(`/api/public/scan/${code}/presences`, {
        method: "POST",
        public: true,
        body: { seminaireId, sessionId, ...identite, position },
      });
      onConfirme(confirmation);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur inattendue.");
    } finally {
      setEtape("saisie");
    }
  };

  return (
    <form onSubmit={valider} className="flex flex-col gap-5" noValidate>
      {premierScan ? (
        <div>
          <h1 className="text-xl font-bold">Bienvenue !</h1>
          <p className="mt-1 text-sm text-gris">Première utilisation de votre billet : renseignez vos informations pour valider votre présence.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-rotary/20 bg-rotary-clair p-4">
          <p className="text-xs font-semibold tracking-wide text-rotary uppercase">Participant</p>
          <p className="mt-1 text-lg font-bold">{donnees.participant?.nomComplet}</p>
          <p className="text-sm text-gris">{donnees.participant?.clubNom}</p>
          <p className="text-sm text-gris">{donnees.participant?.emailMasque}</p>
        </div>
      )}

      {premierScan && (
        <Champ libelle="Votre club" id="club">
          <select id="club" className="champ" value={clubCode} onChange={(e) => setClubCode(e.target.value)} required>
            <option value="">Sélectionnez votre club…</option>
            {donnees.clubs.map((c) => (
              <option key={c.code} value={c.code}>
                {c.nom}
              </option>
            ))}
          </select>
        </Champ>
      )}

      <Champ libelle="Séminaire" id="seminaire">
        {seminaires.length === 1 ? (
          <p id="seminaire" className="champ bg-slate-50 font-semibold">
            {seminaires[0].designation}
          </p>
        ) : (
          <select id="seminaire" className="champ" value={seminaireId} onChange={(e) => setSeminaireId(e.target.value)} required>
            <option value="">Sélectionnez le séminaire…</option>
            {seminaires.map((s) => (
              <option key={s.id} value={s.id}>
                {s.designation}
              </option>
            ))}
          </select>
        )}
      </Champ>

      {seminaireId && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Session de formation</legend>
          {sessions.map((s) => {
            const pointee = dejaPointees.get(s.id);
            const choisie = sessionId === s.id;
            return (
              <label
                key={s.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition ${
                  pointee
                    ? "cursor-not-allowed border-emerald-200 bg-emerald-50 opacity-80"
                    : choisie
                      ? "border-rotary bg-rotary-clair"
                      : "border-slate-200 bg-white active:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="session"
                  value={s.id}
                  checked={choisie}
                  disabled={!!pointee}
                  onChange={() => setSessionId(s.id)}
                  className="mt-1 size-5 accent-rotary"
                />
                <span className="flex-1">
                  <span className="block font-semibold">{s.designation}</span>
                  <span className="block text-sm text-gris">{plage(s.heureDebut, s.heureFin)}</span>
                  {pointee && <span className="mt-1 block text-sm font-semibold text-emerald-700">✓ Présence enregistrée à {heure(pointee)}</span>}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}

      {premierScan && (
        <>
          <Champ libelle="Nom complet" id="nom">
            <input
              id="nom"
              className="champ"
              autoComplete="name"
              value={nomComplet}
              onChange={(e) => setNomComplet(e.target.value)}
              maxLength={200}
              placeholder="Prénom et nom"
              required
            />
          </Champ>
          <Champ libelle="Adresse email" id="email" aide="Vous y recevrez la confirmation de chaque présence.">
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              className="champ"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
              placeholder="vous@exemple.com"
              required
            />
          </Champ>
        </>
      )}

      {erreur && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
          {erreur}
        </div>
      )}

      {seminaireId && sessions.length > 0 && sessions.every((s) => dejaPointees.has(s.id)) ? (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center font-semibold text-emerald-800">
          Votre présence est déjà enregistrée pour toutes les sessions ouvertes de ce séminaire.
        </div>
      ) : (
        <>
          <BoutonPrincipal type="submit" disabled={etape !== "saisie"}>
            {etape === "localisation" ? "Vérification de votre position…" : etape === "envoi" ? "Validation en cours…" : "Valider ma présence"}
          </BoutonPrincipal>
          {controleLieu && (
            <p className="-mt-2 flex items-start gap-1.5 text-xs text-gris">
              <MapPin size={14} aria-hidden className="mt-px shrink-0 text-rotary" />
              Votre position sera demandée pour vérifier que vous êtes sur le lieu de la formation. Seule la distance au lieu est
              enregistrée.
            </p>
          )}
        </>
      )}
    </form>
  );
}

function Confirmation({ confirmation, onAutre }: { confirmation: PresenceConfirmation; onAutre: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex size-24 animate-[pop_.35s_ease-out] items-center justify-center rounded-full bg-emerald-500 text-5xl text-white shadow-lg">
        ✓
      </div>
      <h1 className="mt-5 text-2xl font-bold">Présence validée</h1>
      <p className="mt-1 text-lg">{confirmation.nomComplet}</p>

      <dl className="mt-6 w-full divide-y divide-slate-200 rounded-xl bg-white text-left shadow-sm">
        <Ligne terme="Séminaire" valeur={confirmation.seminaire} />
        <Ligne terme="Session" valeur={confirmation.session} />
        <Ligne terme="Pointage" valeur={`${dateLongue(confirmation.heureDePointage)} à ${heure(confirmation.heureDePointage)}`} />
      </dl>

      <p className="mt-4 text-sm text-gris">Un email de confirmation vous sera envoyé.</p>
      <button type="button" onClick={onAutre} className="mt-6 text-sm font-semibold text-rotary underline">
        Valider une autre session
      </button>
      <style>{`@keyframes pop{0%{transform:scale(.4);opacity:0}80%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}`}</style>
    </div>
  );
}

function Ligne({ terme, valeur }: { terme: string; valeur: string }) {
  return (
    <div className="flex flex-col px-4 py-3">
      <dt className="text-xs font-semibold tracking-wide text-gris uppercase">{terme}</dt>
      <dd className="font-semibold">{valeur}</dd>
    </div>
  );
}

function Champ({ libelle, id, aide, children }: { libelle: string; id: string; aide?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {libelle}
      </label>
      {children}
      {aide && <p className="text-xs text-gris">{aide}</p>}
    </div>
  );
}

function BoutonPrincipal(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="w-full rounded-xl bg-rotary px-5 py-4 text-lg font-bold text-white shadow-md transition active:scale-[.98] active:bg-rotary-fonce disabled:opacity-60"
    />
  );
}

function Message({
  icone,
  ton,
  titre,
  texte,
  children,
}: {
  icone: string;
  ton: "rouge" | "orange";
  titre: string;
  texte: string;
  children?: React.ReactNode;
}) {
  const couleur = ton === "rouge" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";
  return (
    <div className="flex flex-col items-center gap-3 pt-6 text-center">
      <div className={`flex size-20 items-center justify-center rounded-full text-4xl font-bold ${couleur}`}>{icone}</div>
      <h1 className="text-xl font-bold">{titre}</h1>
      <p className="text-gris">{texte}</p>
      {children && <div className="mt-3 w-full">{children}</div>}
    </div>
  );
}

function Chargement() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-label="Chargement">
      <div className="h-7 w-2/3 rounded bg-slate-200" />
      <div className="h-12 rounded-lg bg-slate-200" />
      <div className="h-12 rounded-lg bg-slate-200" />
      <div className="h-20 rounded-xl bg-slate-200" />
      <div className="h-14 rounded-xl bg-slate-300" />
    </div>
  );
}
