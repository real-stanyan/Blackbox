import { useSyncExternalStore } from 'react';
import { getOutlook, subscribeOutlook } from '../data/outlookStore';
import type { Outlook } from '../data/types';

/** null = 尚无展望(没有已分析行程/没配 key)。 */
export function useOutlook(): Outlook | null {
  return useSyncExternalStore(subscribeOutlook, getOutlook);
}
