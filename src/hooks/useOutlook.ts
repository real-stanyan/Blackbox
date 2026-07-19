import { MOCK } from '../data/mock';
import type { Outlook } from '../data/mock';

export function useOutlook(): Outlook {
  return MOCK.outlook;
}
