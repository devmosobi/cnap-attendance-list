"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChoixTheme } from "@/components/choix-theme";
import { api } from "@/lib/api";
import { UtilisateurContext } from "@/lib/hooks";
import type { UtilisateurConnecte } from "@/lib/types";

const MENU: { href: string; libelle: string; admin?: boolean }[] = [
  { href: "/admin", libelle: "Tableau de bord" },
  { href: "/admin/presences", libelle: "Présences" },
  { href: "/admin/qrcodes", libelle: "QR Codes" },
  { href: "/admin/seminaires", libelle: "Séminaires" },
  { href: "/admin/sessions", libelle: "Sessions" },
  { href: "/admin/clubs", libelle: "Clubs" },
  { href: "/admin/parametres/email", libelle: "Paramètres email", admin: true },
  { href: "/admin/parametres/utilisateurs", libelle: "Utilisateurs", admin: true },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const chemin = usePathname();
  const [utilisateur, setUtilisateur] = useState<UtilisateurConnecte | null>(null);
  const [menuOuvert, setMenuOuvert] = useState(false);

  useEffect(() => {
    api<UtilisateurConnecte>("/api/auth/me")
      .catch(async () => {
        // Jeton d'accès expiré : tentative de rafraîchissement avant de renvoyer à la connexion.
        return api<UtilisateurConnecte>("/api/auth/refresh", { method: "POST" });
      })
      .then((u) => {
        if (u.doitChangerMotDePasse) router.replace(`/changer-mot-de-passe?suivant=${encodeURIComponent(chemin)}`);
        else setUtilisateur(u);
      })
      .catch(() => router.replace(`/login?suivant=${encodeURIComponent(chemin)}`));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setMenuOuvert(false), [chemin]);

  const deconnecter = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
  };

  if (!utilisateur) return <p className="py-20 text-center text-sm text-gris">Chargement…</p>;

  const estActif = (href: string) => (href === "/admin" ? chemin === "/admin" : chemin.startsWith(href));

  return (
    <UtilisateurContext.Provider value={utilisateur}>
      <div className="min-h-dvh lg:flex">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-bordure bg-surface transition lg:static lg:translate-x-0 ${
            menuOuvert ? "translate-x-0 shadow-xl" : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-bordure-douce p-4">
              <Image src="/logo-cnap.jpeg" alt="Commission Nationale Apprentissage" width={220} height={73} className="logo-plaque h-auto w-full" />
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              {MENU.filter((m) => !m.admin || utilisateur.role === "Administrateur").map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  className={`mb-1 block rounded-lg px-3 py-2 text-sm font-medium ${
                    estActif(m.href) ? "bg-rotary text-white" : "text-encre hover:bg-rotary-clair"
                  }`}
                >
                  {m.libelle}
                </Link>
              ))}
            </nav>
            <div className="border-t border-bordure-douce p-4 text-sm">
              <p className="font-semibold">{utilisateur.nomComplet}</p>
              <p className="text-xs text-gris">
                {utilisateur.email} · {utilisateur.role}
              </p>
              <div className="mt-2 flex gap-3 text-xs">
                <Link href="/changer-mot-de-passe" className="text-lien hover:underline">
                  Mot de passe
                </Link>
                <button type="button" onClick={deconnecter} className="text-red-700 dark:text-red-300 hover:underline">
                  Déconnexion
                </button>
              </div>
              <ChoixTheme className="mt-3" />
            </div>
          </div>
        </aside>
        {menuOuvert && <div className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden" onClick={() => setMenuOuvert(false)} />}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-bordure bg-surface px-4 py-3 lg:hidden">
            <button type="button" onClick={() => setMenuOuvert(true)} className="rounded-lg border border-bordure-forte px-3 py-1.5 text-sm font-semibold">
              ☰ Menu
            </button>
            <span className="text-sm font-bold">Liste de présence</span>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </div>
      </div>
    </UtilisateurContext.Provider>
  );
}
