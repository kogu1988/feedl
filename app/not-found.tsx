import { NotFoundView } from "@/components/custom/not-found-view";

// Eşleşmeyen URL'ler için global 404. Route group yeniden yapılandırması
// (Sprint 32) sonrası root layout bare olduğu için üst bar gösterilmez;
// (main) segmentlerindeki notFound() çağrıları üst barlı sürümü kullanır:
// app/(main)/not-found.tsx
export default function NotFound() {
  return (
    <main className="container mx-auto max-w-3xl p-4 sm:p-8">
      <NotFoundView />
    </main>
  );
}
