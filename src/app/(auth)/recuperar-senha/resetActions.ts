"use server";

import { z, ZodError } from "zod";
import { createClient } from "@supabase/supabase-js";
import { onlyDigits } from "@/lib/validators";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
}

const schema = z.object({
  cpf_cnpj: z
    .string()
    .transform((v) => onlyDigits(v))
    .refine((d) => /^\d+$/.test(d), "Informe apenas n�meros")
    .refine((d) => d.length === 11 || d.length === 14, "Informe CPF (11) ou CNPJ (14)"),
  senha: z.string().min(8, "A senha precisa ter 8+ caracteres"),
  confirm: z.string().min(8, "A confirma��o precisa ter 8+ caracteres"),
}).refine((data) => data.senha === data.confirm, {
  message: "As senhas n�o conferem",
  path: ["confirm"],
});

export async function resetAction(prevState: any, formData: FormData) {
  try {
    const raw = Object.fromEntries(formData.entries());
    const { cpf_cnpj, senha } = schema.parse(raw);

    const supa = admin();

    // localizar user pelo CPF/CNPJ
    const { data: prof, error: e1 } = await supa
      .from("profiles")
      .select("user_id")
      .eq("cpf_cnpj", cpf_cnpj)
      .maybeSingle();

    if (e1) return { ok: false, error: "Falha ao consultar cadastro." };
    if (!prof?.user_id) return { ok: false, error: "CPF/CNPJ n�o encontrado." };

    // atualizar a senha do usu�rio (admin)
    const { error: e2 } = await supa.auth.admin.updateUserById(prof.user_id, {
      password: senha,
    });
    if (e2) return { ok: false, error: "N�o foi poss�vel atualizar a senha." };

    return { ok: true, message: "Senha cadastrada com sucesso. Voc� j� pode fazer login." };
  } catch (e: any) {
    if (e instanceof ZodError) {
      const msg = e.issues?.[0]?.message || "Dados inv�lidos.";
      return { ok: false, error: msg };
    }
    return { ok: false, error: "N�o foi poss�vel processar sua solicita��o agora." };
  }
}
