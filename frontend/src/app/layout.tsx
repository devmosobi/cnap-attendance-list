import type { Metadata, Viewport } from "next";
import { FournisseurTheme } from "@/lib/theme";
import { SCRIPT_THEME } from "@/lib/theme-script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestion Liste de Présence – Commission Nationale Formation",
  description: "Validation de présence aux séminaires de formation du District Rotary 9101 (Côte d'Ivoire).",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#17458f" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // La classe « dark » est posée avant l'hydratation par SCRIPT_THEME.
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_THEME }} />
      </head>
      <body className="min-h-dvh antialiased">
        <FournisseurTheme>{children}</FournisseurTheme>
      </body>
    </html>
  );
}
