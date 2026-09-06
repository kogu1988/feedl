// Sprint 63x (B) — Clerk shadcn görünümü INLINE. `@clerk/themes` paketi shared
// 3.x'e kilitli (nextjs'in shared 4.x'iyle çakışır) ve bozuk `require` CJS
// dosyası eksik. Bu yüzden Clerk `appearance`'ının `variables`/`elements`
// alanlarıyla kendi tema tokenlarımıza bağlarız (resmi Clerk özelleştirme
// yolu — `theme`/BaseTheme'den daha basit ve kırılgan değil).
//
// Kaldırılan `@clerk/themes` shadcn temadaki `--font-weight-*` referansları
// geçersizdi (globals.css'te yok); burada buna gerek yok.
export const clerkVariables = {
  colorBackground: "var(--card)",
  colorDanger: "var(--destructive)",
  colorForeground: "var(--card-foreground)",
  colorInput: "var(--input)",
  colorInputForeground: "var(--card-foreground)",
  colorMuted: "var(--muted)",
  colorMutedForeground: "var(--muted-foreground)",
  colorNeutral: "var(--foreground)",
  colorPrimary: "var(--primary)",
  colorPrimaryForeground: "var(--primary-foreground)",
  colorRing: "var(--ring)",
} as const;

export const clerkElements = {
  input: "bg-transparent dark:bg-input/30",
  cardBox: "shadow-sm border",
  popoverBox: "shadow-sm border",
  button: {
    "&[data-variant=\"solid\"]::after": {
      display: "none",
    },
  },
  providerIcon__apple: "dark:invert",
  providerIcon__github: "dark:invert",
  providerIcon__okx_wallet: "dark:invert",
  providerIcon__vercel: "dark:invert",
} as const;
