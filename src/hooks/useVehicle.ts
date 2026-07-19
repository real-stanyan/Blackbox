import { MOCK } from '../data/mock';
import type { Vehicle } from '../data/mock';

export function useVehicle(): Vehicle {
  return MOCK.vehicle;
}
