// src/components/auth/AuthCard.tsx
"use client";

import * as React from "react";

export default function AuthCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

