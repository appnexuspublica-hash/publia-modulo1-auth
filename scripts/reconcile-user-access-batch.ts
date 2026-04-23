// scripts/reconcile-user-access-batch.ts
//
// Uso:
// 1) Garanta no .env.local:
//    NEXT_PUBLIC_SUPABASE_URL=...
//    SUPABASE_SERVICE_ROLE_KEY=...
//
// 2) Instale o tsx:
//    npm install -D tsx
//
// 3) Adicione no package.json:
//    "reconcile:access-batch": "tsx scripts/reconcile-user-access-batch.ts"
//
// 4) Rode:
//    npm run reconcile:access-batch
//
// Comportamento:
// - Lê os user_id de user_access_grants
// - Remove duplicados
// - Reconcila o snapshot user_access para cada usuário
// - Mostra resumo final
//
// Observação:
// - Não altera grants
// - Não recria tabelas
// - Usa reconcileUserAccessSnapshot, respeitando a arquitetura atual

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { reconcileUserAccessSnapshot } from "@/lib/access/reconcileUserAccessSnapshot";

type GrantUserRow = {
  user_id: string | null;
};

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL não está definida.");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não está definida.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase
    .from("user_access_grants")
    .select("user_id");

  if (error) {
    throw new Error(`Erro ao buscar user_access_grants: ${error.message}`);
  }

  const userIds = Array.from(
    new Set(
      ((data ?? []) as GrantUserRow[])
        .map((row) => row.user_id)
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim())
    )
  );

  console.log("");
  console.log("=== RECONCILE BATCH DE USER_ACCESS ===");
  console.log(`Usuários distintos encontrados em grants: ${userIds.length}`);
  console.log("");

  let okCount = 0;
  let changedCount = 0;
  let unchangedCount = 0;
  let failedCount = 0;

  const failures: Array<{ userId: string; error: string }> = [];

  for (const userId of userIds) {
    try {
      const result = await reconcileUserAccessSnapshot({
        supabase,
        userId,
        now: new Date(),
      });

      okCount += 1;

      if (result.changed) {
        changedCount += 1;
        console.log(`[OK][ALTERADO] ${userId}`);
      } else {
        unchangedCount += 1;
        console.log(`[OK][SEM ALTERAÇÃO] ${userId}`);
      }
    } catch (err) {
      failedCount += 1;

      const message =
        err instanceof Error ? err.message : "Erro desconhecido ao reconciliar usuário.";

      failures.push({ userId, error: message });

      console.error(`[ERRO] ${userId} -> ${message}`);
    }
  }

  console.log("");
  console.log("=== RESUMO FINAL ===");
  console.log(`Processados com sucesso: ${okCount}`);
  console.log(`Snapshots criados/atualizados: ${changedCount}`);
  console.log(`Snapshots sem alteração: ${unchangedCount}`);
  console.log(`Falhas: ${failedCount}`);

  if (failures.length > 0) {
    console.log("");
    console.log("=== FALHAS ===");

    for (const failure of failures) {
      console.log(`- ${failure.userId}: ${failure.error}`);
    }
  }

  console.log("");
  console.log("Batch finalizado.");
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Erro fatal desconhecido.";

  console.error("");
  console.error("Falha ao executar reconcile em lote:");
  console.error(message);
  process.exit(1);
});
