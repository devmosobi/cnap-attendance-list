import type { Metadata } from "next";
import { ScanClient } from "./scan-client";

export const metadata: Metadata = { title: "Validation de présence – Commission Nationale Apprentissage" };

const FORMAT_CODE = /^[A-Za-z0-9]{20}$/;

export default async function PageScan({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const brut = decodeURIComponent(code).trim();
  return <ScanClient code={FORMAT_CODE.test(brut) ? brut.toUpperCase() : null} />;
}
