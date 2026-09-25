"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Alerte, Bouton, Champ } from "@/components/ui";
import { api } from "@/lib/api";

function FormulaireMotDePasse() {
  const router = useRouter();
  const suivant = useSearchParams().get("suivant");
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    if (nouveau !== confirmation) return setErreur("Les deux mots de passe ne correspondent pas.");
    setEnvoi(true);
    try {
      await api("/api/auth/changer-mot-de-passe", { method: "POST", body: { motDePasseActuel: actuel, nouveauMotDePasse: nouveau } });
      router.replace(suivant?.startsWith("/admin") ? suivant : "/admin");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Modification impossible.");
      setEnvoi(false);
    }
  };

  return (
    <form onSubmit={enregistrer} className="flex flex-col gap-4">
      <Champ libelle="Mot de passe actuel">
        <input className="champ" type="password" autoComplete="current-password" value={actuel} onChange={(e) => setActuel(e.target.value)} required />
      </Champ>
      <Champ libelle="Nouveau mot de passe" aide="8 caractères minimum, avec au moins une majuscule, une minuscule et un chiffre.">
        <input className="champ" type="password" autoComplete="new-password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} required />
      </Champ>
      <Champ libelle="Confirmation">
        <input
          className="champ"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          required
        />
      </Champ>
      {erreur && <Alerte>{erreur}</Alerte>}
      <Bouton type="submit" disabled={envoi} className="py-3">
        {envoi ? "Enregistrement…" : "Enregistrer"}
      </Bouton>
    </form>
  );
}

export default function PageChangerMotDePasse() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-md">
        <h1 className="text-lg font-bold">Changer votre mot de passe</h1>
        <p className="mt-1 mb-5 text-sm text-gris">Pour des raisons de sécurité, choisissez un nouveau mot de passe personnel.</p>
        <Suspense>
          <FormulaireMotDePasse />
        </Suspense>
      </div>
    </main>
  );
}
