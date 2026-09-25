export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Options = Omit<RequestInit, "body"> & { body?: unknown; public?: boolean };

let rafraichissement: Promise<boolean> | null = null;

/** Un seul refresh à la fois, partagé par les requêtes concurrentes. */
function rafraichir(): Promise<boolean> {
  rafraichissement ??= fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => setTimeout(() => (rafraichissement = null), 0));
  return rafraichissement;
}

async function executer(chemin: string, options: Options): Promise<Response> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { body, public: _public, headers, ...reste } = options;
  const estFormulaire = body instanceof FormData;
  return fetch(chemin, {
    ...reste,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(body !== undefined && !estFormulaire ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : estFormulaire ? (body as FormData) : JSON.stringify(body),
  });
}

async function lireErreur(reponse: Response): Promise<ApiError> {
  let message = "Une erreur est survenue. Veuillez réessayer.";
  try {
    const probleme = await reponse.json();
    message = probleme.detail ?? probleme.title ?? message;
  } catch {
    if (reponse.status === 429) message = "Trop de tentatives. Patientez quelques instants puis réessayez.";
  }
  return new ApiError(reponse.status, message);
}

async function requete(chemin: string, options: Options = {}): Promise<Response> {
  let reponse: Response;
  try {
    reponse = await executer(chemin, options);
  } catch {
    throw new ApiError(0, "Connexion impossible. Vérifiez votre accès Internet puis réessayez.");
  }

  if (reponse.status === 401 && !options.public && !chemin.startsWith("/api/auth/")) {
    if (await rafraichir()) {
      reponse = await executer(chemin, options);
    }
    if (reponse.status === 401 && typeof window !== "undefined") {
      window.location.href = `/login?suivant=${encodeURIComponent(window.location.pathname)}`;
    }
  }

  if (!reponse.ok) throw await lireErreur(reponse);
  return reponse;
}

export async function api<T>(chemin: string, options: Options = {}): Promise<T> {
  const reponse = await requete(chemin, options);
  if (reponse.status === 204) return undefined as T;
  const texte = await reponse.text();
  return (texte ? JSON.parse(texte) : undefined) as T;
}

/** Télécharge un export (CSV/XLSX) en conservant le nom de fichier fourni par l'API. */
export async function telecharger(chemin: string): Promise<void> {
  const reponse = await requete(chemin);
  const disposition = reponse.headers.get("Content-Disposition") ?? "";
  const nom = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1] ?? /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? "export";
  const url = URL.createObjectURL(await reponse.blob());
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = decodeURIComponent(nom);
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function construireQuery(parametres: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(parametres)) {
    if (valeur !== undefined && valeur !== null && valeur !== "") q.set(cle, String(valeur));
  }
  const texte = q.toString();
  return texte ? `?${texte}` : "";
}
