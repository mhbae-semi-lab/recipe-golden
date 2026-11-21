// 서비스 워커: 앱 파일을 미리 저장해 오프라인에서도 연다. 파일을 바꾸면 VERSION 을 올린다.
const VERSION = "recipe-golden-v1.0.0-4";
const FILES = [
  "./", "index.html", "app.css", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png",
  "src/app.js", "src/parse.js", "src/diff.js", "src/flow.js", "src/bundle.js", "src/sample.js", "src/i18n.js", "src/store.js",
  "vendor/pretendard/pretendard.css", "vendor/pretendard/Pretendard-Regular.subset.woff2", "vendor/pretendard/Pretendard-SemiBold.subset.woff2",
  "vendor/pretendard/Pretendard-Bold.subset.woff2", "vendor/pretendard/Pretendard-ExtraBold.subset.woff2",
];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES))); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", (e) => { if (e.data === "skip") self.skipWaiting(); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit ||
      fetch(e.request).catch(() => (e.request.mode === "navigate" ? caches.match("index.html") : Response.error()))),
  );
});
