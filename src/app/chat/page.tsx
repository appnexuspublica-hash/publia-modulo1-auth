// src/app/chat/page.tsx
import { redirect } from "next/navigation";

/**
 * Rota legada mantida por compatibilidade.
 * O Publ.IA Estratégico agora está isolado em /estrategico/chat.
 */
export default function LegacyStrategicChatPage() {
  redirect("/estrategico/chat");
}
