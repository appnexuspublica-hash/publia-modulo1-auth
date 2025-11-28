"use client";
import { ReactNode } from "react";

export default function AuthTitle({
  title,
  subtitle,
  brand,
}: {
  title: string;
  subtitle?: string;
  brand?: ReactNode;  // passe <Brand /> aqui
}) {
  return (
    <div className="flex flex-col items-center text-center mb-6">
      {brand ? <div className="mb-2">{brand}</div> : null}
      <h1 className="text-lg font-semibold">{title}</h1>
      {subtitle ? <p className="text-sm text-gray-500">{subtitle}</p> : null}
    </div>
  );
}
