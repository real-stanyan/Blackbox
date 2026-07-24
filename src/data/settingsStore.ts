// 小型 KV:通知开关 + 车辆信息(AsyncStorage),MiniMax key(SecureStore)。
// 行程数据不进 AsyncStorage(Android ~6MB 上限,ADR-0028)。
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Vehicle } from './types';

const SETTINGS_KEY = 'settings.v1';
const VEHICLE_KEY = 'vehicle.v1';
const API_KEY = 'minimax_key';

export interface AppSettings {
  notifyConn: boolean;
  notifyDis: boolean;
  notifyReport: boolean;
  chime: boolean;
}

const DEFAULT_SETTINGS: AppSettings = { notifyConn: true, notifyDis: true, notifyReport: true, chime: true };
const DEFAULT_VEHICLE: Vehicle = {
  name: '我的车', model: '未设置', engine: '未设置', plate: '未设置', odo: 0, adapter: 'OBD 适配器',
};

let settings: AppSettings = DEFAULT_SETTINGS;
let vehicle: Vehicle = DEFAULT_VEHICLE;
const settingsListeners = new Set<() => void>();
const vehicleListeners = new Set<() => void>();

export function subscribeSettings(fn: () => void): () => void {
  settingsListeners.add(fn);
  return () => settingsListeners.delete(fn);
}
export function subscribeVehicle(fn: () => void): () => void {
  vehicleListeners.add(fn);
  return () => vehicleListeners.delete(fn);
}
export const getSettings = () => settings;
export const getVehicle = () => vehicle;

export async function initSettingsStore(): Promise<void> {
  try {
    const [s, v] = await AsyncStorage.multiGet([SETTINGS_KEY, VEHICLE_KEY]);
    if (s[1]) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(s[1]) };
    if (v[1]) vehicle = { ...DEFAULT_VEHICLE, ...JSON.parse(v[1]) };
  } catch (e) {
    console.log(`[store] settings init 失败: ${e}`);
  }
  settingsListeners.forEach((fn) => fn());
  vehicleListeners.forEach((fn) => fn());
}

export async function setSetting<K extends keyof AppSettings>(k: K, v: AppSettings[K]): Promise<void> {
  settings = { ...settings, [k]: v };
  settingsListeners.forEach((fn) => fn());
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function setVehicle(patch: Partial<Vehicle>): Promise<void> {
  vehicle = { ...vehicle, ...patch };
  vehicleListeners.forEach((fn) => fn());
  await AsyncStorage.setItem(VEHICLE_KEY, JSON.stringify(vehicle));
}

export async function getApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(API_KEY);
}

export async function setApiKey(v: string): Promise<void> {
  if (v) await SecureStore.setItemAsync(API_KEY, v);
  else await SecureStore.deleteItemAsync(API_KEY);
}
