// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Publ.IA - Nexus Pública",
  description: "Assistente virtual especializado em Gestão Pública, Licitações e Contratos.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-[#f4efea]`}>
        {children}
      </body>
    </html>
  );
}
