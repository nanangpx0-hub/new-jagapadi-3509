import { getFieldDB, uuid, type OutboxItem } from './database';

export interface SyncSession {
  ownerId: string;
  headers?: Record<string, string>;
}
export interface SyncOptions {
  endpoint: string;
  ownerId: string;
  /** Resolve current auth on every request. Never persist bearer tokens in the queue. */
  getSession: () => Promise<SyncSession | null>;
  onChange?: () => void;
}
const LEASE_MS = 90_000;
const TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 8;

async function claim(ownerId: string): Promise<OutboxItem | undefined> {
  const db = await getFieldDB();
  const tx = db.transaction('outbox', 'readwrite');
  const now = Date.now();
  let cursor = await tx.store.index('by-owner').openCursor(ownerId);
  let claimed: OutboxItem | undefined;
  while (cursor) {
    const item = cursor.value;
    const ready = item.sync_status === 'queued' && item.next_attempt_at <= now;
    const abandoned = item.sync_status === 'syncing' && (item.lease_until ?? 0) <= now;
    if (ready || abandoned) {
      item.sync_status = 'syncing';
      item.lease_token = uuid();
      item.lease_until = now + LEASE_MS;
      item.updated_at = now;
      await cursor.update(item);
      claimed = item;
      break;
    }
    cursor = await cursor.continue();
  }
  await tx.done;
  return claimed;
}

function retryAfterMs(value: string | null): number {
  if (!value) return 0;
  const seconds = Number(value);
  const milliseconds = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now();
  return Number.isFinite(milliseconds) ? Math.min(86_400_000, Math.max(0, milliseconds)) : 0;
}

async function settle(
  item: OutboxItem,
  outcome: { success: boolean; retryable?: boolean; message?: string; retryAfter?: number },
): Promise<void> {
  const db = await getFieldDB();
  const tx = db.transaction(['outbox', 'drafts'], 'readwrite');
  const current = await tx.objectStore('outbox').get(item.id);
  if (!current || current.lease_token !== item.lease_token || current.sync_status !== 'syncing') {
    await tx.done;
    return;
  }
  const now = Date.now();
  delete current.lease_token;
  delete current.lease_until;
  current.updated_at = now;
  if (outcome.success) {
    current.sync_status = 'synced';
    delete current.last_error;
    // Retain form metadata, release photo storage only after a confirmed HTTP success.
    current.payload = { ...current.payload, photos: [] };
    const drafts = await tx.objectStore('drafts').index('by-owner').getAll(item.owner_id);
    const draft = drafts.find(row => row.client_uuid === item.client_uuid);
    if (draft) {
      draft.sync_status = 'synced';
      draft.updated_at = now;
      draft.payload = { ...draft.payload, photos: [] };
      await tx.objectStore('drafts').put(draft);
    }
  } else {
    current.retry_count += 1;
    current.last_error = outcome.message ?? 'Unknown sync error';
    if (outcome.retryable && current.retry_count < MAX_ATTEMPTS) {
      current.sync_status = 'queued';
      const ceiling = Math.min(300_000, 2000 * 2 ** (current.retry_count - 1));
      const jitter = Math.round(ceiling * (0.5 + Math.random() * 0.5));
      current.next_attempt_at = now + Math.max(jitter, outcome.retryAfter ?? 0);
    } else {
      current.sync_status = 'failed';
    }
  }
  await tx.objectStore('outbox').put(current);
  await tx.done;
}

function multipart(item: OutboxItem): FormData {
  const body = new FormData();
  body.append('client_uuid', item.client_uuid);
  body.append('payload', JSON.stringify(item.payload.form));
  for (const [index, photo] of item.payload.photos.entries()) {
    body.append('photos[]', photo.blob, `photo-${index + 1}.webp`);
  }
  return body;
}

async function send(item: OutboxItem, options: SyncOptions): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const session = await options.getSession();
    if (!session || session.ownerId !== item.owner_id) {
      await settle(item, { success: false, message: 'Authentication/account changed; sign in as the report owner and retry.' });
      return false;
    }
    if (controller.signal.aborted) throw new Error('Session resolution timed out.');
    const headers = new Headers(session.headers);
    // Browser must generate the multipart boundary; never set Content-Type manually.
    headers.delete('Content-Type');
    headers.set('Accept', 'application/json');
    headers.set('Idempotency-Key', item.idempotency_key);
    const response = await fetch(options.endpoint, {
      method: 'POST', credentials: 'include', headers,
      body: multipart(item), signal: controller.signal, redirect: 'error',
    });
    const completed = response.status >= 200 && response.status < 300 && response.status !== 202;
    if (completed) {
      await settle(item, { success: true });
      return true;
    }
    const retryable = response.status >= 500 || [202, 408, 425, 429].includes(response.status);
    await settle(item, {
      success: false, retryable,
      message: `HTTP ${response.status}${response.status === 202 ? ': processing pending; retry the SAME idempotency key' : ''}`,
      retryAfter: retryAfterMs(response.headers.get('Retry-After')),
    });
    return retryable;
  } catch (error) {
    // Network failures and ambiguous timeouts reuse the original key: the server may have committed.
    await settle(item, { success: false, retryable: true, message: error instanceof Error ? error.message : 'Network error' });
    return false;
  } finally {
    clearTimeout(timer);
    options.onChange?.();
  }
}

/** Shared by a foreground hook and, if configured, a service worker.
 * IndexedDB read/write claims prevent two cooperating tabs/workers taking the same live lease.
 * Backend idempotency remains mandatory because leases can expire during suspended requests.
 */
export async function processOutbox(options: SyncOptions): Promise<void> {
  const endpoint = new URL(options.endpoint, globalThis.location.origin);
  if (endpoint.origin !== globalThis.location.origin || endpoint.username || endpoint.password) {
    throw new Error('Use a same-origin Laravel API/proxy endpoint.');
  }
  const normalized = { ...options, endpoint: endpoint.href };
  for (let processed = 0; processed < 20; processed++) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const session = await options.getSession();
    if (!session || session.ownerId !== options.ownerId) return;
    const item = await claim(options.ownerId);
    if (!item) return;
    if (!(await send(item, normalized))) return;
  }
}

export async function nextSyncAt(ownerId: string): Promise<number | undefined> {
  const db = await getFieldDB();
  const items = await db.getAllFromIndex('outbox', 'by-owner', ownerId);
  const times = items.flatMap(item => item.sync_status === 'queued'
    ? [item.next_attempt_at]
    : item.sync_status === 'syncing' ? [item.lease_until ?? Date.now()] : []);
  return times.length ? Math.min(...times) : undefined;
}
