import { Inngest } from "inngest";

// Lokal geliştirmede event'ler Dev Server'a (localhost:8288), production'da
// Inngest Cloud'a gider; SDK ortamı kendisi algılar, kod iki ortamda aynıdır.
export const inngest = new Inngest({ id: "feedl" });
