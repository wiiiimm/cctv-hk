// Offline support (as in midi-mixer): service worker registration (production builds only), an "update ready" prompt,
// and offline / online notices. The worker (public/sw.js) caches the app shell and the last picture of every feed.
import { notify } from "./toast";
import { DICTS } from "./i18n";
import { store } from "./store";

const t = () => DICTS[store.get().lang];

export function initPwa(): void {
  window.addEventListener("offline", () => notify(t().offlineNotice));
  window.addEventListener("online", () => notify(t().onlineNotice));

  const enabled = document.querySelector<HTMLMetaElement>('meta[name="service-worker"]')?.content === "on";
  if (!enabled || !("serviceWorker" in navigator)) return;

  navigator.serviceWorker
    .register("/sw.js")
    .then((registration) => {
      // A new version finished installing while this page was open.
      const offerUpdate = (worker: ServiceWorker) => notify(t().updateReady, t().reload, () => worker.postMessage("skip-waiting"), true);
      if (registration.waiting && navigator.serviceWorker.controller) offerUpdate(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) offerUpdate(worker);
        });
      });
      setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    })
    .catch(() => {});

  // Reload only when an update replaces a worker that was already in control (not on the first install).
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading || !hadController) return;
    reloading = true;
    location.reload();
  });
}
