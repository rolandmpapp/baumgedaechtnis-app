import { useEffect, useState } from 'react';

export function OfflineStatus({showStatus=true}:{showStatus?:boolean}) {
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [failed, setFailed] = useState(false);
  const [update, setUpdate] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    const onlineChanged = () => setOnline(navigator.onLine);
    window.addEventListener('online', onlineChanged);
    window.addEventListener('offline', onlineChanged);
    let alive = true;
    let shouldReload = false;
    const controllerChanged = () => {if (shouldReload) window.location.reload();};
    const acceptUpdate = () => {shouldReload = true;};
    window.addEventListener('baum-update-accepted', acceptUpdate);
    navigator.serviceWorker?.addEventListener('controllerchange', controllerChanged);
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js', {scope:import.meta.env.BASE_URL}).then(registration => {
        if (!alive) return;
        if (registration.waiting) setUpdate(registration.waiting);
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (alive && worker.state === 'installed' && navigator.serviceWorker.controller) setUpdate(worker);
          });
        });
        return navigator.serviceWorker.ready.then(() => {if (alive) setReady(true);});
      }).catch(() => {if (alive) setFailed(true);});
    } else if (import.meta.env.PROD) setFailed(true);
    return () => {
      alive = false;
      window.removeEventListener('online', onlineChanged);
      window.removeEventListener('offline', onlineChanged);
      window.removeEventListener('baum-update-accepted', acceptUpdate);
      navigator.serviceWorker?.removeEventListener('controllerchange', controllerChanged);
    };
  }, []);
  return <div className="local-status" role="status">
    {showStatus&&<span>{ready ? (online ? 'Offline bereit · Lokal gespeichert' : 'Du bist offline · Lokal gespeichert') : failed ? 'Offline-Nutzung konnte nicht vorbereitet werden.' : import.meta.env.DEV ? 'Lokale Vorschau · Lokal gespeichert' : 'Offline-Nutzung wird vorbereitet …'}</span>}
    {update && <button className="textbutton" onClick={()=>{window.dispatchEvent(new Event('baum-update-accepted'));update.postMessage({type:'SKIP_WAITING'});}}>Neue Version laden</button>}
  </div>;
}
