// src/app/essencial/chat/EssentialChatClient.tsx
"use client";

import EssentialChatPageClient from "./EssentialChatPageClient";

type EssentialChatClientProps = {
  userId: string;
  userLabel: string;
};

export default function EssentialChatClient({
  userId,
  userLabel,
}: EssentialChatClientProps) {
  return (
    <EssentialChatPageClient
      userId={userId}
      userLabel={userLabel}
      chatApiEndpoint="/api/essential/chat"
    />
  );
}
