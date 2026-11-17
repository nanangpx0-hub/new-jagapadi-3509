import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export type SyncStatus = 'draft' | 'queued' | 'syncing' | 'failed' | 'synced';
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export interface ReportPayload {
  form: Record<string, JsonValue>;
  photos: Array<{ name: string; blob: Blob }>;
}
export interface ReportDraft {
  id: string;
  client_uuid: string;
  owner_id: string;
  payload: ReportPayload;
  sync_status: SyncStatus;
  created_at: number;
  updated_at: number;
}
export interface OutboxItem {
  id: string;
  client_uuid: string;
  idempotency_key: string;
  owner_id: string;
  payload: ReportPayload;
  retry_count: number;
  sync_status: SyncStatus;
  next_attempt_at: number;
  lease_token?: string;
  lease_until?: number;
  last_error?: string;
  response_id?: string;
  created_at: number;
  updated_at: number;
}
interface FieldDB extends DBSchema {
  drafts: { key: string; value: ReportDraft; indexes: { 'by-owner': string } };
  outbox: {
    key: string;
    value: OutboxItem;
    indexes: { 'by-client': string; 'by-idempotency': string; 'by-next-attempt': number; 'by-owner': string };
  };
}
let connection: Promise<IDBPDatabase<FieldDB>> | undefined;

export function getFieldDB(): Promise<IDBPDatabase<FieldDB>> {
  if (!connection) {
    connection = openDB<FieldDB>('jagapadi-field-reports', 1, {
      upgrade(db) {
        const drafts = db.createObjectStore('drafts', { keyPath: 'id' });
        drafts.createIndex('by-owner', 'owner_id');
        const outbox = db.createObjectStore('outbox', { keyPath: 'id' });
        outbox.createIndex('by-client', 'client_uuid', { unique: true });
        outbox.createIndex('by-idempotency', 'idempotency_key', { unique: true });
        outbox.createIndex('by-next-attempt', 'next_attempt_at');
        outbox.createIndex('by-owner', 'owner_id');
      },
      blocking() {
        void connection?.then(db => db.close());
        connection = undefined;
      },
      terminated() { connection = undefined; },
    }).catch(error => { connection = undefined; throw error; });
  }
  return connection;
}

export function uuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  // Fallback untuk konteks insecure (HTTP) di mana randomUUID tidak tersedia.
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  throw new Error('Web Crypto API tidak tersedia di browser ini.');
}

function validatePayload(payload: ReportPayload): void {
  if (payload.photos.length > 10) throw new Error('Maximum 10 photos per report.');
  for (const photo of payload.photos) {
    if (photo.blob.type !== 'image/webp' || photo.blob.size <= 0 || photo.blob.size >= 300_000) {
      throw new Error('Compress each photo to WebP below 300,000 bytes before saving.');
    }
  }
}

export async function saveDraft(ownerId: string, payload: ReportPayload, draftId?: string): Promise<string> {
  if (!ownerId.trim()) throw new Error('A stable authenticated owner ID is required.');
  validatePayload(payload);
  const db = await getFieldDB();
  const tx = db.transaction('drafts', 'readwrite');
  const id = draftId ?? uuid();
  const existing = await tx.store.get(id);
  if ((draftId && !existing) || (existing && (existing.owner_id !== ownerId || existing.sync_status !== 'draft'))) {
    tx.abort();
    await tx.done.catch(() => undefined);
    throw new Error('Draft is missing, owned by another account, or already queued. Clone it with a new ID instead.');
  }
  const now = Date.now();
  await tx.store.put({
    id, client_uuid: existing?.client_uuid ?? uuid(), owner_id: ownerId,
    payload, sync_status: 'draft', created_at: existing?.created_at ?? now, updated_at: now,
  });
  await tx.done;
  return id;
}

/** Atomically freezes a draft and enqueues an immutable snapshot. Retrying never creates a new key. */
export async function enqueueDraft(draftId: string, ownerId: string): Promise<string> {
  const db = await getFieldDB();
  const tx = db.transaction(['drafts', 'outbox'], 'readwrite');
  const draft = await tx.objectStore('drafts').get(draftId);
  if (!draft || draft.owner_id !== ownerId) {
    tx.abort();
    await tx.done.catch(() => undefined);
    throw new Error('Draft not found for this account.');
  }
  const existing = await tx.objectStore('outbox').index('by-client').get(draft.client_uuid);
  if (existing) { await tx.done; return existing.id; }
  if (draft.sync_status !== 'draft') {
    tx.abort();
    await tx.done.catch(() => undefined);
    throw new Error('Draft is not editable/queueable.');
  }
  const now = Date.now();
  const id = uuid();
  await tx.objectStore('outbox').add({
    id, client_uuid: draft.client_uuid, idempotency_key: uuid(), owner_id: ownerId,
    payload: draft.payload, retry_count: 0, sync_status: 'queued', next_attempt_at: now,
    created_at: now, updated_at: now,
  });
  draft.sync_status = 'queued';
  draft.updated_at = now;
  await tx.objectStore('drafts').put(draft);
  await tx.done;
  return id;
}

export async function retryFailed(id: string, ownerId: string): Promise<void> {
  const db = await getFieldDB();
  const tx = db.transaction('outbox', 'readwrite');
  const item = await tx.store.get(id);
  if (item?.owner_id === ownerId && item.sync_status === 'failed') {
    item.sync_status = 'queued';
    item.retry_count = 0;
    item.next_attempt_at = Date.now();
    item.updated_at = Date.now();
    delete item.last_error;
    await tx.store.put(item);
  }
  await tx.done;
}

/** A request, not a durability guarantee. Surface denial/quota errors to the user. */
export async function requestPersistentStorage(): Promise<boolean> {
  return typeof navigator !== 'undefined' && !!navigator.storage?.persist
    ? navigator.storage.persist() : false;
}
