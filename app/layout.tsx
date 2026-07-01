import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GIMA — Gaming Intelligence Meta Assistant",
  description: "Tu asistente de IA para Lore profundo y Meta actualizado de videojuegos. Consulta builds, composiciones y análisis en tiempo real con búsqueda web integrada.",
  keywords: ["GIMA", "gaming", "AI assistant", "lore", "meta", "builds", "Genshin Impact", "Wuthering Waves", "Honkai Star Rail"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
