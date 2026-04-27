// src/app/pagamento/retorno/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type RedirectTarget = "/chat" | "/criar-conta";

const REDIRECT_DELAY_MS = 1800;

export default function PagamentoRetornoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [message, setMessage] = useState("Confirmando seu acesso...");
  const [target, setTarget] = useState<RedirectTarget | null>(null);
  const [manualTarget, setManualTarget] = useState<RedirectTarget>("/criar-conta");

  const criarContaUrl = useMemo(() => {
    const params = new URLSearchParams();

    // Mantém um marcador simples para a tela de cadastro saber que veio de pagamento.
    params.set("origem", "pagamento");

    // Preserva parâmetros úteis, caso a Kiwify envie algo no futuro.
    const orderId = searchParams.get("order_id") || searchParams.get("orderId");
    const email = searchParams.get("email");
    const cpfCnpj = searchParams.get("cpf_cnpj") || searchParams.get("document");

    if (orderId) params.set("order_id", orderId);
    if (email) params.set("email", email);
    if (cpfCnpj) params.set("cpf_cnpj", cpfCnpj);

    return `/criar-conta?${params.toString()}`;
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function resolveDestination() {
      try {
        setMessage("Verificando sua sessão...");

        const response = await fetch("/api/access/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (cancelled) return;

        if (response.ok) {
          setTarget("/chat");
          setManualTarget("/chat");
          setMessage("Pagamento confirmado. Vamos abrir seu painel.");
          window.setTimeout(() => {
            if (!cancelled) router.replace("/chat");
          }, REDIRECT_DELAY_MS);
          return;
        }

        setTarget("/criar-conta");
        setManualTarget("/criar-conta");
        setMessage("Pagamento confirmado. Vamos abrir a criação da sua conta.");
        window.setTimeout(() => {
          if (!cancelled) router.replace(criarContaUrl);
        }, REDIRECT_DELAY_MS);
      } catch {
        if (cancelled) return;

        setTarget("/criar-conta");
        setManualTarget("/criar-conta");
        setMessage("Pagamento confirmado. Vamos abrir a criação da sua conta.");
        window.setTimeout(() => {
          if (!cancelled) router.replace(criarContaUrl);
        }, REDIRECT_DELAY_MS);
      }
    }

    resolveDestination();

    return () => {
      cancelled = true;
    };
  }, [router, criarContaUrl]);

  const manualHref = manualTarget === "/chat" ? "/chat" : criarContaUrl;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center justify-center">
        <section className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-700">
            ✓
          </div>

          <h1 className="text-2xl font-bold tracking-tight">
            Pagamento aprovado
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            {message}
          </p>

          <div className="mt-6 flex justify-center">
            <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-slate-300" />
            </div>
          </div>

          <div className="mt-7 text-xs text-slate-500">
            {target === "/chat" ? (
              <p>Você será redirecionado para o chat.</p>
            ) : (
              <p>
                Se você ainda não possui senha, crie sua conta usando os mesmos
                dados informados na compra.
              </p>
            )}
          </div>

          <a
            href={manualHref}
            className="mt-6 inline-flex rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Continuar agora
          </a>
        </section>
      </div>
    </main>
  );
}
