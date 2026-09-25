"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function Bouton({
  variante = "principal",
  taille = "normal",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "principal" | "secondaire" | "danger" | "lien"; taille?: "normal" | "petit" }) {
  const styles = {
    principal: "bg-rotary text-white hover:bg-rotary-fonce",
    secondaire: "border border-slate-300 bg-white text-encre hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    lien: "text-rotary hover:underline",
  }[variante];
  const dimensions = variante === "lien" ? "" : taille === "petit" ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm";
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${dimensions} ${styles} ${className}`}
    />
  );
}

export function Champ({ libelle, aide, children }: { libelle: string; aide?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-semibold">{libelle}</span>
      {children}
      {aide && <span className="text-xs text-gris">{aide}</span>}
    </label>
  );
}

export function Carte({ titre, actions, children, className = "" }: { titre?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(titre || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          {titre && <h2 className="font-bold">{titre}</h2>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function EnTete({ titre, description, actions }: { titre: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{titre}</h1>
        {description && <p className="mt-1 text-sm text-gris">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({ actif, oui = "Actif", non = "Inactif" }: { actif: boolean; oui?: string; non?: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${actif ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}
    >
      {actif ? oui : non}
    </span>
  );
}

/**
 * Action de ligne sous forme d'icône, avec infobulle au survol et au focus clavier.
 * Le libellé sert aussi de nom accessible (lecteurs d'écran, écrans tactiles).
 */
export function ActionIcone({
  libelle,
  icone: Icone,
  onClick,
  href,
  ton = "normal",
  disabled,
}: {
  libelle: string;
  icone: LucideIcon;
  onClick?: () => void;
  href?: string;
  ton?: "normal" | "danger" | "succes";
  disabled?: boolean;
}) {
  const couleurs = {
    normal: "text-gris hover:bg-rotary-clair hover:text-rotary",
    danger: "text-gris hover:bg-red-50 hover:text-red-700",
    succes: "text-gris hover:bg-emerald-50 hover:text-emerald-700",
  }[ton];
  const classe = `inline-flex rounded-md p-1.5 transition focus-visible:outline-2 focus-visible:outline-rotary disabled:opacity-40 ${couleurs}`;
  return (
    <span className="group relative inline-flex">
      {href ? (
        <Link href={href} aria-label={libelle} className={classe}>
          <Icone size={16} aria-hidden />
        </Link>
      ) : (
        <button type="button" aria-label={libelle} onClick={onClick} disabled={disabled} className={classe}>
          <Icone size={16} aria-hidden />
        </button>
      )}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-30 mb-1 rounded bg-encre px-2 py-1 text-xs font-medium whitespace-nowrap text-white opacity-0 shadow transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {libelle}
      </span>
    </span>
  );
}

export function Modale({ titre, ouverte, onFermer, children }: { titre: string; ouverte: boolean; onFermer: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!ouverte) return;
    const echap = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [ouverte, onFermer]);

  if (!ouverte) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onMouseDown={onFermer}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="font-bold">{titre}</h2>
          <button type="button" onClick={onFermer} className="rounded p-1 text-2xl leading-none text-gris hover:bg-slate-100" aria-label="Fermer">
            ×
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/** Confirmation intégrée à la page (pas de window.confirm). */
export function Confirmer({
  message,
  ouverte,
  onAnnuler,
  onConfirmer,
  libelle = "Confirmer",
}: {
  message: string;
  ouverte: boolean;
  onAnnuler: () => void;
  onConfirmer: () => void | Promise<void>;
  libelle?: string;
}) {
  const [envoi, setEnvoi] = useState(false);
  return (
    <Modale titre="Confirmation" ouverte={ouverte} onFermer={onAnnuler}>
      <p className="text-sm">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Bouton variante="secondaire" onClick={onAnnuler}>
          Annuler
        </Bouton>
        <Bouton
          variante="danger"
          disabled={envoi}
          onClick={async () => {
            setEnvoi(true);
            try {
              await onConfirmer();
            } finally {
              setEnvoi(false);
            }
          }}
        >
          {libelle}
        </Bouton>
      </div>
    </Modale>
  );
}

export function Alerte({ ton = "erreur", children }: { ton?: "erreur" | "succes" | "info"; children: React.ReactNode }) {
  const styles = {
    erreur: "border-red-200 bg-red-50 text-red-800",
    succes: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-sky-200 bg-sky-50 text-sky-800",
  }[ton];
  return (
    <div role={ton === "erreur" ? "alert" : "status"} className={`rounded-lg border p-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}

export function Chargement() {
  return <p className="py-8 text-center text-sm text-gris">Chargement…</p>;
}
