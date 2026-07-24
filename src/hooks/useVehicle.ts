import { useSyncExternalStore } from 'react';
import { getVehicle, subscribeVehicle } from '../data/settingsStore';
import type { Vehicle } from '../data/types';

export function useVehicle(): Vehicle {
  return useSyncExternalStore(subscribeVehicle, getVehicle);
}
