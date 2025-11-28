"use client";
import * as React from "react";
import Brand from "../brand";
import AuthCard from "./AuthCard";

export default function AuthShell({
  title,
  subtitle,
  children,
  showBrand = true,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showBrand?: boolean;
  className?: string;
}) {
  return (
    <div className="min-h-[70vh] w-full flex items-start justify-center pt-10">
      <AuthCard className={`w-full max-w-lg ${className}`}>
        <div className="flex flex-col items-center text-center">
          {showBrand ? <Brand size={44} /> : null}
          <h1 className="mt-1 text-xl font-semibold text-slate-800">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        <div className="mt-4">{children}</div>
      </AuthCard>
    </div>
  );
}
