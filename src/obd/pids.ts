export interface PidDef {
  /** Mode 01 request, e.g. '010C' */
  request: string;
  /** Expected response header, e.g. '410C' */
  responsePrefix: string;
  key: string;
  name: string;
  unit: string;
  /** Decode from data bytes (after the 41xx prefix). */
  decode: (bytes: number[]) => number;
}

// V0 validation set — standard Mode 01 PIDs only, no BMW-specific UDS.
export const PIDS: PidDef[] = [
  {
    request: '010C',
    responsePrefix: '410C',
    key: 'rpm',
    name: 'Engine RPM',
    unit: 'rpm',
    decode: (b) => (b[0] * 256 + b[1]) / 4,
  },
  {
    request: '010D',
    responsePrefix: '410D',
    key: 'speed',
    name: 'Vehicle speed',
    unit: 'km/h',
    decode: (b) => b[0],
  },
  {
    request: '0105',
    responsePrefix: '4105',
    key: 'coolant_temp',
    name: 'Coolant temperature',
    unit: '°C',
    decode: (b) => b[0] - 40,
  },
  {
    request: '015C',
    responsePrefix: '415C',
    key: 'oil_temp',
    name: 'Engine oil temperature',
    unit: '°C',
    decode: (b) => b[0] - 40,
  },
  {
    request: '0106',
    responsePrefix: '4106',
    key: 'stft_b1',
    name: 'Short term fuel trim B1',
    unit: '%',
    decode: (b) => b[0] / 1.28 - 100,
  },
  {
    request: '0107',
    responsePrefix: '4107',
    key: 'ltft_b1',
    name: 'Long term fuel trim B1',
    unit: '%',
    decode: (b) => b[0] / 1.28 - 100,
  },
];
