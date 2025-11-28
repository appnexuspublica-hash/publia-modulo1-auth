// src/app/debug/page.tsx
"use client";

export default function DebugPage() {
  return (
    <div className="p-6 text-sm text-slate-800">
      <h1 className="mb-2 text-lg font-semibold">Debug Publ.IA</h1>
      <p>
        Página de debug desativada nesta versão. (O módulo{" "}
        <code>@/lib/external/supabase</code> foi removido para não impactar o
        build de produção.)
      </p>
    </div>
  );
}
