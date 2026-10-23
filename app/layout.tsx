import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const font = Bricolage_Grotesque({ subsets: ["latin"], display: "swap", variable: "--font", axes: ["opsz", "wdth"] });

export const metadata: Metadata = {
  title: "Pin Sheet: make & print your own pins",
  description: "Add your pics, fit each one in a circle and download a print-ready PDF at the exact size for your pin press.",
};

// viewport-fit=cover libera env(safe-area-inset-bottom) para o painel fixo do celular
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={font.variable}>
      <body>{children}</body>
    </html>
  );
}
