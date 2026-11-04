export interface HealthCheck { status: 'ok' | 'error'; driver?: string; version?: string; response?: string; writable?: boolean }
export interface HealthResponse {
  status: 'ok' | 'degraded'; service: string; timezone: string; timestamp: string;
  checks: { database: HealthCheck; postgis: HealthCheck; redis: HealthCheck; storage: HealthCheck };
}
export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health', { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  if (!response.ok && response.status !== 503) throw new Error('API tidak terjangkau (HTTP ' + response.status + ')');
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || !('checks' in data) || !('status' in data)) throw new Error('Respons health tidak valid');
  return data as HealthResponse;
}
