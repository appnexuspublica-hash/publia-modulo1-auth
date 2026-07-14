// src/app/pagamento/retorno/page.tsx
"use client";

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type StepStatus = "checking" | "redirecting";

function buildCreateAccountUrl(orderId: string | null) {
  const params = new URLSearchParams();

  if (orderId) {
    params.set("order_id", orderId);
  }

  const query = params.toString();
  return query ? `/criar-conta?${query}` : "/criar-conta";
}

function PagamentoRetornoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<StepStatus>("checking");

  const orderId = useMemo(() => {
    const orderCode = searchParams.get("order_code");
    const orderIdParam = searchParams.get("order_id");

    return (orderCode || orderIdParam || "").trim() || null;
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function resolveRedirect() {
      try {
        const response = await fetch("/api/access/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (cancelled) return;

        setStatus("redirecting");

        const timeoutId = window.setTimeout(() => {
          if (response.ok) {
            router.replace("/estrategico/chat");
            return;
          }

          router.replace(buildCreateAccountUrl(orderId));
        }, 600);

        return () => window.clearTimeout(timeoutId);
      } catch {
        if (cancelled) return;

        setStatus("redirecting");

        const timeoutId = window.setTimeout(() => {
          router.replace(buildCreateAccountUrl(orderId));
        }, 600);

        return () => window.clearTimeout(timeoutId);
      }
    }

    let cleanupTimer: (() => void) | undefined;

    resolveRedirect().then((cleanup) => {
      cleanupTimer = cleanup;
    });

    return () => {
      cancelled = true;
      cleanupTimer?.();
    };
  }, [orderId, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl">
          ✓
        </div>

        <h1 className="text-lg font-semibold text-slate-900">
          Pagamento confirmado
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          {status === "checking"
            ? "Estamos verificando seu acesso para direcionar você ao Publ.IA."
            : "Tudo certo. Estamos redirecionando você agora."}
        </p>

        <p className="mt-4 text-xs text-slate-500">
          Se você ainda não tem conta, será direcionado para criar sua senha de acesso.
        </p>
      </section>
    </main>
  );
}

function PagamentoRetornoFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">
          Carregando retorno do pagamento...
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Aguarde enquanto preparamos o próximo passo.
        </p>
      </section>
    </main>
  );
}

export default function PagamentoRetornoPage() {
  return (
    <Suspense fallback={<PagamentoRetornoFallback />}>
      <PagamentoRetornoContent />
    </Suspense>
  );
}

