// Outlook 缓存:outlook.json。新行程分析完成后 refreshOutlook() 重算。
import { File, Paths } from 'expo-file-system';
import { Outlook, TripRecord } from './types';
import { getIndex, getTrip } from './tripStore';
import { analyzeOutlook, buildOutlookInput } from '../analysis/outlook';
import { getApiKey } from './settingsStore';

const outlookFile = new File(Paths.document, 'outlook.json');

let outlook: Outlook | null = null;
const listeners = new Set<() => void>();

export function subscribeOutlook(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getOutlook = () => outlook;

export async function initOutlookStore(): Promise<void> {
  try {
    if (outlookFile.exists) outlook = JSON.parse(await outlookFile.text());
  } catch (e) {
    console.log(`[outlook] init 失败: ${e}`);
  }
  listeners.forEach((fn) => fn());
}

export async function refreshOutlook(): Promise<void> {
  try {
    const key = await getApiKey();
    if (!key) return;
    const recs = (await Promise.all(getIndex().map((e) => getTrip(e.id)))).filter(
      (r): r is TripRecord => r !== null,
    );
    if (!recs.some((r) => r.report)) return; // 一个已分析行程都没有,没料可聚合
    outlook = await analyzeOutlook(buildOutlookInput(recs), key);
    outlookFile.write(JSON.stringify(outlook));
    listeners.forEach((fn) => fn());
  } catch (e) {
    console.log(`[outlook] refresh 失败: ${e}`); // 失败留旧缓存,下次行程再试
  }
}
