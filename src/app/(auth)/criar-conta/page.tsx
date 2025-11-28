// src/app/(auth)/criar-conta/page.tsx
import { Suspense } from "react";
import CriarContaPageClient from "./CriarContaPageClient";

export default function CriarContaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-600">
          Carregando formulário de cadastro...
        </div>
      }
    >
      <CriarContaPageClient />
    </Suspense>
  );
}
