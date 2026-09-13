// Sprint 70.3 — şirket/fırsat görünümlerinin paylaştığı etiketler, biçimleyiciler ve tipler.

// Görünüm tipleri (sunucudan gelen serileştirilmiş biçim). Sprint 70.3'te
// `companies-manager.tsx`'ten buraya taşındı: üç dialog ve manager aynı şekli
// paylaşıyor, tipin tek yerde durması gerekir.
export interface CompanyMemberView {
  id: string;
  userId: string;
  jobTitle: string | null;
  userName: string;
  userEmail: string;
}

export interface CompanyView {
  id: string;
  name: string;
  domain: string | null;
  mrr: string | null;
  status: string;
  renewalDate: string | null;
  segment: string | null;
  notes: string | null;
  members: CompanyMemberView[];
}

export interface UserOption {
  id: string;
  label: string;
}

export interface OpportunityView {
  id: string;
  companyId: string;
  title: string;
  dealValue: string;
  stage: string;
  expectedCloseDate: string | null;
  notes: string | null;
}


export const stageLabels: Record<string, string> = {
  open: "Açık",
  proposal: "Teklif",
  won: "Kazanıldı",
  lost: "Kaybedildi",
};

export const stageBadgeClasses: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  proposal:
    "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  won: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  lost: "bg-muted text-muted-foreground",
};

export const mrrFormatter = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 2,
});

// Sprint 30: şirket oluştur/düzenle formu — aynı dialog iki modu paylaşır;
// alanlar dialog her açılışta props'tan tazelenir.
