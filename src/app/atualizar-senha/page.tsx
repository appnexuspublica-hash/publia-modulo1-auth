"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AtualizarSenhaPage() {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  const [canReset, setCanReset] = React.useState(false);
  const [hashError, setHashError] = React.useState<string | null>(null);

  const [senha, setSenha] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [showSenha, setShowSenha] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const [status, setStatus] = React.useState<"idle" | "saving" | "ok" | "error">("idle");
  const [msg, setMsg] = React.useState<string>("");

  const success = status === "ok";

  React.useEffect(() => {
    let isMounted = true;

    function getHashParams() {
      const raw = window.location.hash?.startsWith("#")
        ? window.location.hash.slice(1)
        : "";
      return new URLSearchParams(raw);
    }

    function clearUrlHash() {
      window.history.replaceState(null, "", window.location.pathname);
    }

    async function bootstrap() {
      const hp = getHashParams();

      const errorCode = hp.get("error_code");
      const errorDesc = hp.get("error_description");

      if (errorCode || errorDesc) {
        if (!isMounted) return;

        setHashError(
          errorCode === "otp_expired"
            ? "Link inválido ou expirado. Solicite um novo e-mail de recuperação."
            : decodeURIComponent(errorDesc || "Não foi possível validar o link de recuperação.")
        );

        clearUrlHash();
        return;
      }

      const type = hp.get("type"); // "recovery"
      const isRecovery = type === "recovery";

      // força o supabase-js a consumir o hash e criar sessão
      const { data } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (isRecovery && data?.session) {
        setCanReset(true);
        clearUrlHash();
      }
    }

    bootstrap();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!isMounted) return;

      if (event === "PASSWORD_RECOVERY") {
        setCanReset(true);
        window.history.replaceState(null, "", window.location.pathname);
      }
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (success) return;

    setMsg("");

    if (senha.length < 8) {
      setStatus("error");
      setMsg("A senha precisa ter 8+ caracteres.");
      return;
    }

    if (senha !== confirm) {
      setStatus("error");
      setMsg("As senhas não conferem.");
      return;
    }

    setStatus("saving");
    const { error } = await supabase.auth.updateUser({ password: senha });

    if (error) {
      setStatus("error");
      setMsg("Não foi possível atualizar a senha. Solicite um novo link e tente novamente.");
      return;
    }

    setStatus("ok");
    setMsg("Senha atualizada com sucesso! Você já pode fazer login.");
    await supabase.auth.signOut();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        {/* Logo + Título centralizado */}
        <div className="flex flex-col items-center text-center">
          <Image
            src="/logos/nexus.png"
            alt="Nexus Pública"
            width={56}
            height={56}
            className="mb-2"
            priority
          />
          <h1 className="text-xl font-semibold">Atualizar Senha</h1>
          <p className="mt-1 text-sm text-slate-600">
            Defina uma nova senha para acessar sua conta.
          </p>
        </div>

        {hashError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {hashError}
          </div>
        )}

        {!canReset && !hashError && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Abra esta página usando o link de recuperação enviado por e-mail.
          </div>
        )}

        {msg && (
          <div
            className={`mt-4 rounded-xl border px-3 py-2 text-sm ${
              success
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {msg}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          {/* Senha */}
          <div>
            <label className="text-sm font-medium text-slate-700">Nova senha</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                disabled={!canReset || status === "saving" || success}
                className="w-full rounded-xl border px-3 py-2 outline-none focus:ring"
                type={showSenha ? "text" : "password"}
                placeholder="mínimo 8 caracteres"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowSenha((v) => !v)}
                disabled={!canReset || status === "saving" || success}
                className="whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {showSenha ? "Ocultar" : "Ver"}
              </button>
            </div>
          </div>

          {/* Confirmar */}
          <div>
            <label className="text-sm font-medium text-slate-700">Confirmar nova senha</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                disabled={!canReset || status === "saving" || success}
                className="w-full rounded-xl border px-3 py-2 outline-none focus:ring"
                type={showConfirm ? "text" : "password"}
                placeholder="repita a senha"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                disabled={!canReset || status === "saving" || success}
                className="whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {showConfirm ? "Ocultar" : "Ver"}
              </button>
            </div>
          </div>

          {/* Botão salvar */}
          <button
            type="submit"
            disabled={!canReset || status === "saving" || success}
            className="w-full rounded-xl bg-[#0d4161] px-4 py-2 text-white font-semibold hover:opacity-95 disabled:opacity-60"
          >
            {status === "saving" ? "Salvando..." : "Salvar nova senha"}
          </button>

          {/* CTA pós-sucesso */}
          {success && (
            <Link
              href="/login"
              className="block w-full rounded-xl bg-green-600 px-4 py-2 text-center font-semibold text-white hover:bg-green-700"
            >
              Fazer login agora
            </Link>
          )}
        </form>
      </div>
    </main>
  );
}
