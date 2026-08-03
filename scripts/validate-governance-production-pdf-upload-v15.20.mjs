import fs from "node:fs";

const clientPath = "src/app/governanca/chat/GovernanceChatClient.tsx";
const routePath = "src/app/api/upload-pdf/route.ts";

const client = fs.readFileSync(clientPath, "utf8");
const route = fs.readFileSync(routePath, "utf8");

const checks = [
  ["cliente prepara URL assinada", client.includes('mode: "prepare_signed_upload"')],
  ["cliente envia diretamente ao Storage", client.includes("uploadToSignedUrl")],
  ["cliente registra após upload", client.includes('mode: "register"')],
  ["cliente não envia o PDF pela função Vercel", !client.includes('formData.append("file", file, file.name)')],
  ["servidor cria URL assinada", route.includes("createSignedUploadUrl")],
  ["servidor valida prefixo de usuário e conversa", route.includes("expectedStoragePrefix")],
  ["servidor mantém upload multipart legado", route.includes('mode: "legacy_multipart"')],
  ["service role não foi exposta ao cliente", !client.includes("SUPABASE_SERVICE_ROLE_KEY")],
];

let failed = false;
for (const [label, ok] of checks) {
  console.log(`${ok ? "OK" : "ERRO"}: ${label}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
