import { supabase } from '../supabase/client';
import type { AIResp } from './schemas';

export type AnalysisRow = {
  id: string;
  user_id: string;
  created_at: string;
  symbol: string;
  interval: string;
  last_price: number;
  ai: AIResp;
  snapshot_url: string | null;
};

export async function listAnalyses(): Promise<AnalysisRow[]> {
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as any[]).map((d) => ({ ...d, ai: d.ai })) as AnalysisRow[];
}

export async function saveAnalysis(params: {
  symbol: string;
  interval: string;
  last_price: number;
  ai: AIResp;
  snapshotDataUrl?: string;
}): Promise<AnalysisRow> {
  let snapshot_url: string | null = null;
  if (params.snapshotDataUrl) {
    const file = dataURLtoFile(params.snapshotDataUrl, `snap_${Date.now()}.png`);
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.png`;
    const { error: upErr } = await supabase.storage.from('snapshots').upload(path, file, { contentType: 'image/png', upsert: false });
    if (upErr) throw upErr;
    const { data: signed, error: signErr } = await supabase.storage.from('snapshots').createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signErr) throw signErr;
    snapshot_url = signed.signedUrl;
  }

  const { data, error } = await supabase
    .from('analyses')
    .insert({ symbol: params.symbol, interval: params.interval, last_price: params.last_price, ai: params.ai, snapshot_url })
    .select()
    .single();
  if (error) throw error;
  return data as AnalysisRow;
}

export async function deleteAnalysis(id: string) {
  const { error } = await supabase.from('analyses').delete().eq('id', id);
  if (error) throw error;
}

function dataURLtoFile(dataurl: string, filename: string): File {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] ?? 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
}


