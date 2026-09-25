import { NextResponse, type NextRequest } from "next/server";

/** Format imprimé sur les billets : /attendance=<code de 20 caractères> */
const URL_BILLET = /^\/attendance=([^/]*)\/?$/;
const COOKIE_SESSION = "cnap_rt";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const billet = URL_BILLET.exec(pathname);
  if (billet) {
    // Réécriture interne : l'URL du billet reste affichée telle quelle dans le navigateur.
    const url = request.nextUrl.clone();
    url.pathname = `/scan/${encodeURIComponent(decodeURIComponent(billet[1]) || "-")}`;
    url.search = "";
    return NextResponse.rewrite(url);
  }

  if (pathname.startsWith("/admin") && !request.cookies.has(COOKIE_SESSION)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?suivant=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Tout sauf l'API et les ressources statiques ; le tri fin se fait dans le middleware.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|logo-cnap.jpeg).*)"],
};
