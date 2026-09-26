import Image from "next/image";
import Link from "next/link";

export default function Accueil() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <Image src="/logo-cnap.jpeg" alt="Commission Nationale Apprentissage" width={280} height={93} priority className="logo-plaque h-auto w-64" />
      <div className="h-1 w-24 rounded-full bg-or" />
      <h1 className="text-xl font-bold">Gestion Liste de Présence</h1>
      <p className="text-gris">Pour valider votre présence, scannez le QR Code imprimé sur votre billet avec l&apos;appareil photo de votre téléphone.</p>
      <Link href="/login" className="text-sm font-semibold text-lien underline">
        Accès organisateurs
      </Link>
    </main>
  );
}
