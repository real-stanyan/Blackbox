// 行程持久化:每行程一个 JSON 文件 + index.json 缓存(ADR-0028)。
// 文件是事实源,索引只是加速;启动时校对,不符就重建。
import { Directory, File, Paths } from 'expo-file-system';
import { Tone, TripIndexEntry, TripRecord } from './types';
import { TripReport } from '../analysis/minimax';

const tripsDir = new Directory(Paths.document, 'trips');
const indexFile = new File(tripsDir, 'index.json');

let index: TripIndexEntry[] = [];
let initialized = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

export function subscribeTrips(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getIndex(): TripIndexEntry[] {
  return index;
}

export function tripFileUri(id: string): string {
  return new File(tripsDir, `${id}.json`).uri;
}

function entryOf(r: TripRecord): TripIndexEntry {
  return {
    id: r.id, startedAt: r.startedAt, durationMin: r.durationMin,
    distanceKm: r.distanceKm, verdict: r.verdict, analyzed: r.report !== null,
  };
}

function writeIndex() {
  indexFile.write(JSON.stringify(index));
}

async function rebuildIndex(): Promise<void> {
  const entries: TripIndexEntry[] = [];
  for (const item of tripsDir.list()) {
    if (!(item instanceof File) || !item.name.endsWith('.json') || item.name === 'index.json') continue;
    try {
      const rec = JSON.parse(await item.text()) as TripRecord;
      entries.push(entryOf(rec));
    } catch (e) {
      console.log(`[store] 跳过损坏行程文件 ${item.name}: ${e}`);
    }
  }
  index = entries.sort((a, b) => b.startedAt - a.startedAt);
  writeIndex();
}

export async function initTripStore(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    if (!tripsDir.exists) tripsDir.create();
    const fileIds = tripsDir
      .list()
      .filter((i): i is File => i instanceof File && i.name.endsWith('.json') && i.name !== 'index.json')
      .map((f) => f.name.replace(/\.json$/, ''))
      .sort();
    let cached: TripIndexEntry[] = [];
    if (indexFile.exists) {
      try {
        cached = JSON.parse(await indexFile.text());
      } catch {
        cached = [];
      }
    }
    const cachedIds = cached.map((e) => e.id).sort();
    if (JSON.stringify(fileIds) === JSON.stringify(cachedIds)) {
      index = cached.sort((a, b) => b.startedAt - a.startedAt);
    } else {
      await rebuildIndex(); // 索引和目录不符(写失败/手动删文件)→ 文件为准
    }
  } catch (e) {
    console.log(`[store] init 失败: ${e}`);
  }
  notifyListeners();
}

export async function saveTrip(record: TripRecord): Promise<void> {
  const f = new File(tripsDir, `${record.id}.json`);
  f.write(JSON.stringify(record)); // 不吞错:抛给调用方,LiveSession 记 console
  index = [entryOf(record), ...index.filter((e) => e.id !== record.id)];
  writeIndex();
  notifyListeners();
}

export async function getTrip(id: string): Promise<TripRecord | null> {
  const f = new File(tripsDir, `${id}.json`);
  if (!f.exists) return null;
  try {
    return JSON.parse(await f.text()) as TripRecord;
  } catch {
    return null;
  }
}

export async function updateTripReport(id: string, report: TripReport, verdict: Tone): Promise<void> {
  const rec = await getTrip(id);
  if (!rec) return;
  await saveTrip({ ...rec, report, verdict });
}
