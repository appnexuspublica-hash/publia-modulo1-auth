// src/app/p/[shareId]/page.tsx
import SharedConversationClient from "./SharedConversationClient";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { shareId: string } }) {
  return <SharedConversationClient shareId={params.shareId} />;
}
