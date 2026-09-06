import { ClerkProvider } from "@clerk/nextjs";
import { trTR } from "@clerk/localizations";
import { shadcn } from "@clerk/ui/themes";

import { SiteHeader } from "@/components/custom/site-header";
import { SiteFooter } from "@/components/custom/site-footer";
import { ThemeProvider } from "@/components/custom/theme-provider";
import { CanonicalLink } from "@/components/custom/canonical-link";
import { getWorkspaceBrand } from "@/lib/db/workspace";
import { brandOverlay, hexToRgb, textOn } from "@/lib/color";

// Sprint 63w (F3): workspace marka rengini GERÇEK akşana bağla. `--brand` /
// `--primary` (oy/buton/odak) workspace'e göre renklenir; yazı rengi WCAG
// (textOn), soft/tint markadan türetilir. Varsayılan mercanla aynıysa no-op.
function workspaceBrandStyle(brandColor: string | null): string {
  const color = brandColor?.trim().toLowerCase() ?? "";
  if (!color || color === "#ff5c35") return "";
  const rgb = hexToRgb(color);
  if (!rgb) return "";
  const [r, g, b] = rgb;
  const fg = textOn(color);
  const soft = brandOverlay(color, 0.14) ?? `rgba(${r} ${g} ${b} / 0.14)`;
  const tint = brandOverlay(color, 0.08) ?? `rgba(${r} ${g} ${b} / 0.08)`;
  const strong = `rgb(${Math.round(r * 0.72)} ${Math.round(g * 0.72)} ${Math.round(b * 0.72)})`;
  return `:root,.dark{--brand:${color};--brand-strong:${strong};--brand-soft:${soft};--brand-tint:${tint};--primary:${color};--primary-foreground:${fg};}`;
}

// Sprint 32: site üst barı ClerkProvider ile birlikte (main) route group'una
// taşındı. /widget iframe içinde bu layout'u KULLANMAZ — root layout bare
// html/body verir. Sprint 36: üst bar SiteHeader'a taşındı (aktif nav durumu
// client gerektirir), alt bar eklendi; flex iskelet footer'ı alta sabitler.
// Sprint 50: footer çok sütunlu — ürün + demo linkleri + yasal/şirket.
// Sprint 51: footer SiteFooter'a taşındı — rakip standardıyla admin
// (/dashboard*), onboarding, davet ve auth yüzeylerinde render edilmez.

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Sprint 48k: workspace markası (subdomain'e göre) üst bara taşınır.
  const brand = await getWorkspaceBrand();
  const brandStyle = workspaceBrandStyle(brand.brandColor);
  return (
    <ClerkProvider localization={trTR} appearance={{ theme: shadcn }}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
      <CanonicalLink customDomain={brand.customDomain} />
      {brandStyle ? <style dangerouslySetInnerHTML={{ __html: brandStyle }} /> : null}
      <div className="flex min-h-svh flex-col">
        <SiteHeader brand={brand} />
        <div className="flex-1">{children}</div>
        <SiteFooter brand={brand} />
      </div>
      </ThemeProvider>
    </ClerkProvider>
  );
}
