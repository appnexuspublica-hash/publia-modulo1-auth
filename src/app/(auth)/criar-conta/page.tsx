// src/app/(auth)/criar-conta/page.tsx
import { Suspense } from "react";
import { redirect } from "next/navigation";
import CriarContaPageClient from "./CriarContaPageClient";

export default function CriarContaPage({
  searchParams,
}: {
  searchParams: { tk?: string };
}) {
  const tk = (searchParams.tk ?? "").trim();

  // 🔒 Agora o cadastro é aberto, mas exige tk (gerado automaticamente)
  // Se não tiver tk, manda voltar pro login para clicar em "Criar conta".
  if (!tk) {
    redirect("/login");
  }

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
