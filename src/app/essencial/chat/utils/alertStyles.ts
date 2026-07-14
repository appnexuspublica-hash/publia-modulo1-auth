//src/app/chat/utils/alertStyles.ts
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
            "rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-emerald-100",
          button: "text-emerald-100/80 hover:text-emerald-50",
          cta: "inline-flex items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-500/20 px-4 py-2 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-500/30",
        };

      case "warning":
        return {
          container:
            "rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-amber-100",
          button: "text-amber-100/80 hover:text-amber-50",
          cta: "inline-flex items-center justify-center rounded-full bg-amber-500 px-4 py-2 text-[11px] font-semibold text-slate-950 transition hover:bg-amber-400",
        };

      case "error":
      default:
        return {
          container:
            "rounded-lg border border-red-300/30 bg-red-500/10 px-3 py-2 text-red-100",
          button: "text-red-100/80 hover:text-red-50",
          cta: "inline-flex items-center justify-center rounded-full border border-red-300/30 bg-red-500/20 px-4 py-2 text-[11px] font-semibold text-red-100 transition hover:bg-red-500/30",
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