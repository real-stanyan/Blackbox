// 实时 tile 的展示元数据(key/label/unit/note)。数值一律来自 BLE,这里没有数。
export const LIVE_PID_META = [
  { key: 'rpm', label: '转速', unit: 'rpm' },
  { key: 'speed', label: '车速', unit: 'km/h' },
  { key: 'coolant', label: '水温', unit: '°C' },
  { key: 'oil', label: '机油温度', unit: '°C', note: '车型未提供' },
  { key: 'stft', label: '短期燃油修正', unit: '%' },
  { key: 'ltft', label: '长期燃油修正', unit: '%' },
] as const;
