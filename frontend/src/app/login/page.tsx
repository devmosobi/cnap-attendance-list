"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Alerte, Bouton, Champ } from "@/components/ui";
import { api } from "@/lib/api";
import type { UtilisateurConnecte } from "@/lib/types";

function FormulaireConnexion() {
  const router = useRouter();
  const suivant = useSearchParams().get("suivant");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const connecter = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      const utilisateur = await api<UtilisateurConnecte>("/api/auth/login", { method: "POST", body: { email, motDePasse } });
      const destination = suivant?.startsWith("/admin") ? suivant : "/admin";
      router.replace(utilisateur.doitChangerMotDePasse ? `/changer-mot-de-passe?suivant=${encodeURIComponent(destination)}` : destination);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Connexion impossible.");
      setEnvoi(false);
    }
  };

  return (
    <form onSubmit={connecter} className="flex flex-col gap-4">
      <Champ libelle="Adresse email">
        <input className="champ" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      </Champ>
      <Champ libelle="Mot de passe">
        <input
          className="champ"
          type="password"
          autoComplete="current-password"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          required
        />
      </Champ>
      {erreur && <Alerte>{erreur}</Alerte>}
      <Bouton type="submit" disabled={envoi} className="py-3">
        {envoi ? "Connexion…" : "Se connecter"}
      </Bouton>
    </form>
  );
}

export default function PageConnexion() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-md">
        <div className="mb-6 flex flex-col items-center gap-3">
          <Image src="/logo-cnap.jpeg" alt="Commission Nationale Formation" width={240} height={80} priority className="h-auto w-52" />
          <h1 className="text-lg font-bold">Console d&apos;administration</h1>
        </div>
        <Suspense>
          <FormulaireConnexion />
        </Suspense>
      </div>
    </main>
  );
}
