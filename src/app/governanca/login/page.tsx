// src/app/governanca/login/page.tsx
import GovernanceLoginForm from "./GovernanceLoginForm";

export default function GovernanceLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f5] px-6 py-10">
      <div className="w-full max-w-xl rounded-3xl border border-[#dedede] bg-white p-8 shadow-sm">
        <div className="mb-6">
          <span className="inline-flex rounded-full bg-[#e8f1f3] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#0b4a55]">
            Publ.IA Governança
          </span>

          <h1 className="mt-4 text-3xl font-bold text-slate-900">
            Login institucional
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Acesse utilizando o CNPJ do órgão, CPF do usuário autorizado e sua senha institucional.
          </p>
        </div>

        <GovernanceLoginForm />
      </div>
    </main>
  );
}
