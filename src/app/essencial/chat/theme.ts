//src/app/chat/theme.ts

export type ChatPlanTheme = "essential" | "strategic";

type ChatThemeColors = {
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  text: string;
  textMuted: string;
  textSoft: string;
  border: string;
  borderStrong: string;
  hover: string;
  active: string;
  buttonGhost: string;
  buttonGhostHover: string;
  inputBg: string;
  bubbleUser: string;
  bubbleAssistant: string;
};

export type ChatTheme = {
  plan: ChatPlanTheme;
  colors: ChatThemeColors;
};

export const chatThemes: Record<ChatPlanTheme, ChatTheme> = {
  essential: {
    plan: "essential",
    colors: {
      bg: "#e5e5e5",
      bgSecondary: "#dcdcdc",
      bgTertiary: "#f3f3f3",
      text: "#111111",
      textMuted: "#4b5563",
      textSoft: "#6b7280",
      border: "rgba(0, 0, 0, 0.08)",
      borderStrong: "rgba(0, 0, 0, 0.14)",
      hover: "rgba(0, 0, 0, 0.04)",
      active: "rgba(0, 0, 0, 0.08)",
      buttonGhost: "transparent",
      buttonGhostHover: "rgba(0, 0, 0, 0.05)",
      inputBg: "#ffffff",
      bubbleUser: "#ffffff",
      bubbleAssistant: "#f3f4f6",
    },
  },

  strategic: {
    plan: "strategic",
    colors: {
      bg: "#6c6c6c",
      bgSecondary: "#656565",
      bgTertiary: "#7a7a7a",
      text: "#ffffff",
      textMuted: "rgba(255, 255, 255, 0.9)",
      textSoft: "rgba(255, 255, 255, 0.72)",
      border: "rgba(255, 255, 255, 0.16)",
      borderStrong: "rgba(255, 255, 255, 0.26)",
      hover: "rgba(255, 255, 255, 0.1)",
      active: "rgba(255, 255, 255, 0.14)",
      buttonGhost: "transparent",
      buttonGhostHover: "rgba(255, 255, 255, 0.12)",
      inputBg: "#5f5f5f",
      bubbleUser: "#7a7a7a",
      bubbleAssistant: "#6c6c6c",
    },
  },
};

export function getChatTheme(isStrategic: boolean): ChatTheme {
  return isStrategic ? chatThemes.strategic : chatThemes.essential;
}