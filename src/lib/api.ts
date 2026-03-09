import type { StatePayload } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function fetchState(token: string): Promise<StatePayload> {
  if (!API_URL) throw new Error('API_URL not configured');

  const res = await fetch(`${API_URL}/v1/state`, {
    headers: { 'X-Device-Token': token },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`State fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchEvidence(token: string, violationId: string) {
  if (!API_URL) throw new Error('API_URL not configured');

  const res = await fetch(`${API_URL}/v1/evidence/${violationId}`, {
    headers: { 'X-Device-Token': token },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Evidence fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchDrivers(token: string) {
  if (!API_URL) throw new Error('API_URL not configured');

  const res = await fetch(`${API_URL}/v1/drivers`, {
    headers: { 'X-Device-Token': token },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Drivers fetch failed: ${res.status}`);
  return res.json();
}

export async function uploadFills(token: string, csvText: string, fileName: string) {
  if (!API_URL) throw new Error('API_URL not configured');

  const res = await fetch(`${API_URL}/v1/fills`, {
    method: 'POST',
    headers: {
      'X-Device-Token': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ csv_text: csvText, source_file: fileName }),
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}
