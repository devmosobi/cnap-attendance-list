"use client";

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

export function Tableau({ entetes, children, vide }: { entetes: string[]; children: React.ReactNode; vide?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-slate-200 text-xs tracking-wide text-gris uppercase">
          <tr>
            {entetes.map((e) => (
              <th key={e} className="px-3 py-2 font-semibold whitespace-nowrap">
                {e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
      {vide && <p className="py-8 text-center text-sm text-gris">Aucun résultat.</p>}
    </div>
  );
}

export function Cellule({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-middle ${className}`}>{children}</td>;
}

export function Pagination({ page, taille, total, onPage }: { page: number; taille: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / taille));
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-gris">
      <span>
        {total} résultat{total > 1 ? "s" : ""}
      </span>
      <div className="flex items-center gap-2">
        <Bouton variante="secondaire" taille="petit" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ← Précédent
        </Bouton>
        <span>
          Page {page} / {pages}
        </span>
        <Bouton variante="secondaire" taille="petit" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Suivant →
        </Bouton>
      </div>
    </div>
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
