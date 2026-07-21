/* Service worker: permite abrir la aplicación sin conexión.
   Estrategia: red primero para los archivos propios (así las
   actualizaciones llegan siempre), caché como respaldo. */
const CACHE = "mxf-v8";
const SHELL = [
  "./", "./index.html", "./db.js", "./drive.js", "./comercial.js", "./app.js",
  "./manifest.webmanifest", "./icon-192.png", "./icon-512.png",
  "https://unpkg.com/react@18.3.1/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = e.request.url;
  if (url.includes("googleapis.com") || url.includes("accounts.google.com") || url.includes("gstatic.com")) return;
  if (e.request.method !== "GET") return;

  const propio = url.startsWith(self.location.origin);

  if (propio) {
    // red primero: siempre la versión más reciente cuando hay señal
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copia));
          }
          return res;
        })
        .catch(() => caches.match(e.request).then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }

  // recursos externos (React): caché primero, son fijos
  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit || fetch(e.request).then((res) => {
        if (res && res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copia));
        }
        return res;
      })
    )
  );
});
