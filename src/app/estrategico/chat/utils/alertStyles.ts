//src/app/estrategico/chat/utils/alertStyles.ts
export type AlertTone = "success" | "warning" | "error";

type AlertStyles = {
  container: string;
  button: string;
  cta: string;
};

export function getAlertStyles(
  tone: AlertTone,
  isStrategic: boolean
): AlertStyles {
  if (isStrategic) {
    switch (tone) {
      case "success":
        return {
          container:
            "rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-900",
          button: "text-emerald-700 hover:text-emerald-900",
          cta: "inline-flex items-center justify-center rounded-full border border-emerald-300 bg-emerald-100 px-4 py-2 text-[11px] font-semibold text-emerald-900 transition hover:bg-emerald-200",
        };

      case "warning":
        return {
          container:
            "rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950",
          button: "text-amber-700 hover:text-amber-950",
          cta: "inline-flex items-center justify-center rounded-full border border-amber-300 bg-amber-100 px-4 py-2 text-[11px] font-semibold text-amber-950 transition hover:bg-amber-200",
        };

      case "error":
      default:
        return {
          container:
            "rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-red-950",
          button: "text-red-700 hover:text-red-950",
          cta: "inline-flex items-center justify-center rounded-full border border-red-300 bg-red-100 px-4 py-2 text-[11px] font-semibold text-red-950 transition hover:bg-red-200",
        };
    }
  }

  switch (tone) {
    case "success":
      return {
        container:
          "rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-2 text-emerald-950",
        button: "text-emerald-800 hover:text-emerald-950",
        cta: "inline-flex items-center justify-center rounded-full border border-emerald-300 bg-emerald-200 px-4 py-2 text-[11px] font-semibold text-emerald-950 transition hover:bg-emerald-300",
      };

    case "warning":
      return {
        container:
          "rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-amber-950",
        button: "text-amber-800 hover:text-amber-950",
        cta: "inline-flex items-center justify-center rounded-full border border-amber-300 bg-amber-200 px-4 py-2 text-[11px] font-semibold text-amber-950 transition hover:bg-amber-300",
      };

    case "error":
    default:
      return {
        container:
          "rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-red-950",
        button: "text-red-800 hover:text-red-950",
        cta: "inline-flex items-center justify-center rounded-full border border-red-300 bg-red-200 px-4 py-2 text-[11px] font-semibold text-red-950 transition hover:bg-red-300",
      };
  }
}