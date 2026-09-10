import Link from "next/link";

// Ortak "Powered by feedl" İŞARETİ (saf sunum). Ayrı dosyada durur çünkü
// `powered-by-feedl.tsx` planı okumak için server-only kod (getPlanLimits)
// import eder; onu bir client bileşenden import etmek server kodunu istemci
// paketine çekerdi. Bu dosya hiçbir server bağımlılığı taşımaz.
//
// Rozet hem public yüzeylerde (portal / yol haritası / changelog) hem widget
// panelinde kullanılır — markup tek kaynak.
export function PoweredByFeedlMark({ className }: { className?: string }) {
  return (
    <p
      className={
        className ??
        "mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground"
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo_brand_orange.svg"
        alt=""
        className="size-4 shrink-0 object-contain"
        aria-hidden="true"
      />
      <span>Powered by</span>
      <Link
        href="https://feedl.app"
        target="_blank"
        rel="noreferrer"
        className="font-medium underline-offset-4 hover:underline"
      >
        feedl
      </Link>
    </p>
  );
}
