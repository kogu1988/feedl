# @feedl/widget

feedl geri bildirim widget'ını müşteri sitesine gömmek için **resmi yükleyici**.
`<script src="https://feedl.app/widget.js">` embed'inin bundler + TypeScript ile
kullanılabilir hali. Widget mantığı sunucuda tek yerde yaşar (feedl.app/widget.js)
— bu paket yalnızca o betiği enjekte eder ve `identify()` API'sini tipli sunar.

## Kurulum

```bash
npm install @feedl/widget
```

## Kullanım

### Bundler (Next.js, Vite, vb.)

```ts
import { init, identify } from "@feedl/widget";

// Sayfa açılışında widget'ı başlat (isteğe bağlı kimlik jetonu ile):
init({
  url: "https://feedl.app", // kendi feedl kurulumun
  // token: "<1 saatlik HS256 widget JWT>", // opsiyonel
  buttonText: "Geri bildirim",
  accent: "#ff5c35",
  theme: "auto",
});

// Kullanıcı girişi / session sonrası gerçek kimlik:
identify({ token: "<yeni kısa ömürlü JWT>" });
```

### Tarayıcı (bundler'sız, `<script type="module">`)

```html
<script type="module">
  import { init } from "https://feedl.app/@feedl/widget/index.js";
  init({ url: "https://feedl.app", buttonText: "Geri bildirim" });
</script>
```

### `<script>` embed (basit)

feedl/widget.js betiğini doğrudan yükle — kurulum gerektirmez:

```html
<script
  src="https://feedl.app/widget.js"
  data-feedl-url="https://feedl.app"
  data-token="<opsiyonel>"
  data-button-text="Geri bildirim"
  data-accent="#ff5c35"
  data-theme="auto"
></script>
```

## Widget JWT üretim (backend)

`identify`/`data-token` için kısa ömürlü HS256 JWT. `iss=feedl`,
`aud=feedl-widget`, `sub` zorunlu (max 64 karakter: harf/rakam/-/_); `exp`
zorunlu. Paylaşılan gizli anahtar: `FEEDL_WIDGET_SECRET`.

> Solo feedl'e bağlanmak için workspace'teki `NEXT_PUBLIC_APP_URL`'yi ver.

## API

### `init(options?)`

- `url` — feedl taban URL'si. Varsayılan `https://feedl.app`.
- `scriptUrl` — widget.js tam URL'si (özelleştirme). Varsayılan `url + "/widget.js"`.
- `token` — 1 saatlik widget JWT (opsiyonel).
- `buttonText` — launcher metni (varsayılan "Geri bildirim").
- `accent` — launcher rengi (hex; yazı rengi kontrasta göre).
- `theme` — `"light" | "dark" | "auto"` (varsayılan "light").

İdempotent: aynı `scriptUrl` ile tekrar çağrılırsa yeni betik eklemez.

### `identify({ token: string })`

Kullanıcı girişi sonrası yeni jetonla kimliği yeniler. Widget henüz yüklenmediyse
jeton kuyruğa alınır ve `widget.js` yüklenince yeniden oynatılır.

## Lisans

MIT
