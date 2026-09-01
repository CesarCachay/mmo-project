export const BATTLE_UI_THEME = {
  colors: {
    backdrop: "#07111f",
    surface: "rgba(15, 23, 42, 0.88)",
    surfaceStrong: "rgba(15, 23, 42, 0.96)",
    surfaceHover: "rgba(30, 41, 59, 0.96)",
    border: "rgba(148, 163, 184, 0.18)",
    borderStrong: "rgba(148, 163, 184, 0.3)",
    textPrimary: "#f8fafc",
    textSecondary: "#cbd5e1",
    textMuted: "#94a3b8",
    accent: "#60a5fa",
    accentStrong: "#3b82f6",
    hpHealthy: "#22c55e",
    hpWarning: "#f59e0b",
    hpDanger: "#ef4444",
    disabled: "#64748b",
  },

  radius: {
    small: 10,
    medium: 14,
    large: 20,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 18,
    xl: 24,
  },

  transitionMs: 160,
} as const;
