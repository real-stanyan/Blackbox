import { MOCK } from '../data/mock';
import type { Trip } from '../data/mock';

export function useTrips(): Trip[] {
  return MOCK.trips;
}
