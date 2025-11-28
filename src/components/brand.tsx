"use client";
import * as React from "react";

export function Brand({
  size = 44,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center mb-1 ${className}`}>
      <img
        src="/logos/nexus.png"
        alt="Nexus Pública"
        width={size}
        height={size}
        onError={(e) => {
          (e.target as HTMLImageElement).src = "/logos/logo-nexus.png";
        }}
      />
    </div>
  );
}

export default Brand;

