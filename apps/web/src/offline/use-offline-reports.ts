import { useCallback, useEffect, useRef, useState } from 'react';
import { enqueueDraft, retryFailed } from './database';
import { nextSyncAt, processOutbox, type SyncOptions } from './sync-engine';

/** Foreground fallback: works without Background Sync support, while the page remains active.
 * Keep one instance near the authenticated app root. A service worker is NOT registered here.
 */
export function useOfflineReports(options: SyncOptions) {
  const currentOptions = useRef(options);
  currentOptions.current = options;
  const kickRef = useRef<() => void>(() => undefined);
  const [online, setOnline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [revision, setRevision] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let running = false;
    let rerun = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel('jagapadi-outbox') : undefined;

    const changed = () => {
      if (!active) return;
      setRevision(value => value + 1);
      currentOptions.current.onChange?.();
    };
    const schedule = async () => {
      if (!active || !navigator.onLine) return;
      try {
        const at = await nextSyncAt(options.ownerId);
        if (!active) return;
        // Periodic polling also notices queues written by tabs without BroadcastChannel.
        const delay = at === undefined ? 30_000 : Math.min(30_000, Math.max(1000, at - Date.now()));
        timer = setTimeout(() => { void pump(); }, delay);
      } catch (error) {
        if (active) {
          setLastError(error instanceof Error ? error.message : 'IndexedDB unavailable');
          timer = setTimeout(() => { void pump(); }, 30_000);
        }
      }
    };
    const pump = async () => {
      if (!active) return;
      if (running) { rerun = true; return; }
      if (timer) clearTimeout(timer);
      if (!navigator.onLine) { setOnline(false); return; }
      running = true;
      setOnline(true);
      setSyncing(true);
      setLastError(null);
      try {
        await processOutbox({
          endpoint: options.endpoint,
          ownerId: options.ownerId,
          getSession: () => currentOptions.current.getSession(),
          onChange: changed,
        });
      } catch (error) {
        if (active) setLastError(error instanceof Error ? error.message : 'Sync failed');
      } finally {
        running = false;
        if (active) {
          setSyncing(false);
          if (rerun) {
            rerun = false;
            timer = setTimeout(() => { void pump(); }, 0);
          } else {
            void schedule();
          }
        }
      }
    };
    const onOnline = () => { setOnline(true); void pump(); };
    const onOffline = () => { setOnline(false); if (timer) clearTimeout(timer); };
    const onVisible = () => { if (document.visibilityState === 'visible') void pump(); };
    const onMessage = () => { changed(); void pump(); };
    kickRef.current = () => {
      changed();
      channel?.postMessage({ type: 'outbox-changed' });
      void pump();
    };
    channel?.addEventListener('message', onMessage);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    void pump();
    return () => {
      active = false;
      kickRef.current = () => undefined;
      if (timer) clearTimeout(timer);
      channel?.close();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [options.ownerId, options.endpoint]);

  const submitDraft = useCallback(async (draftId: string) => {
    const id = await enqueueDraft(draftId, currentOptions.current.ownerId);
    kickRef.current();
    return id;
  }, []);
  const retry = useCallback(async (id: string) => {
    await retryFailed(id, currentOptions.current.ownerId);
    kickRef.current();
  }, []);
  const syncNow = useCallback(() => kickRef.current(), []);

  return { online, syncing, lastError, revision, submitDraft, retry, syncNow };
}
