import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default function NexusAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
