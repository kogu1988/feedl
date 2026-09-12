import { NotFoundView } from "@/components/custom/not-found-view";
import { isUnknownHostRequest } from "@/lib/db/workspace";

// Eşleşmeyen URL'ler VE bilinmeyen host'lar (fail-closed kapı: (main)/layout.tsx
// `notFound()` çağırır → buraya düşer, çünkü (main) layout'un kendisi hata
// verdiğinde onun altındaki not-found.tsx render edilemez).
//
// Host bilinen bir workspace'e çözülmüyorsa göreli `/portal` bağlantıları da
// 404'e gideceği için kullanıcıyı kök siteye (mutlak) yönlendiren varyant
// gösterilir.
export default async function NotFound() {
  const hostUnknown = await isUnknownHostRequest();

  return (
    <main className="container mx-auto max-w-none p-4 sm:p-8">
      <NotFoundView hostUnknown={hostUnknown} />
    </main>
  );
}
