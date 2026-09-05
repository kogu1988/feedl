import { NotFoundView } from "@/components/custom/not-found-view";

// (main) segmentlerindeki notFound() çağrıları bu sürümü kullanır — site
// üst barı (main)/layout.tsx'ten otomatik görünür.
export default function NotFound() {
  return (
    <main className="container mx-auto max-w-none p-4 sm:p-8">
      <NotFoundView />
    </main>
  );
}
