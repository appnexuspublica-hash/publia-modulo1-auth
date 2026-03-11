// src/components/brand.tsx
import Image from "next/image";

export default function Brand({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <Image
        src="https://nexuspublica.com.br/wp-content/uploads/2025/09/icon_nexus.png"
        alt="Nexus Pública"
        width={size}
        height={size}
        className="rounded"
      />
      </div>
  );
}