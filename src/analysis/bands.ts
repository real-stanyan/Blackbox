// 阈值单一来源。features.ts 的 ruleAlerts 与图表上的正常/异常带共用这里的数字,
// 避免「规则说 115、图上画 110」这种两套真相(ADR-0002 的同源原则)。
//
// 每个数字都必须能追溯到一条本地规则,不许为了好看凭空造区间——没有
// 可辩护阈值的通道(rpm/speed)就不画带,只画曲线。

/** 本地规则层阈值 — features.ts extractFeatures 直接用这些常量。 */
export const RULE_THRESHOLDS = {
  /** 水温峰值上限(°C),超过 = red。 */
  coolantMaxC: 115,
  /** 油温峰值上限(°C),超过 = red。 */
  oilMaxC: 125,
  /** LTFT 均值绝对值上限(%),超过 = yellow。 */
  ltftAbsMean: 8,
  /** STFT p95 绝对值上限(%),超过 = yellow。 */
  stftAbsP95: 12,
} as const;

/** 单点正常区间。null = 该侧无可辩护阈值(例:水温偏低是暖机,不是故障)。 */
export interface ChannelBand {
  min: number | null;
  max: number | null;
  /** 阈值出处,给 UI 当说明文字。 */
  note: string;
}

/** key = PID key。不在表里的通道不画带。 */
export const CHANNEL_BANDS: Record<string, ChannelBand> = {
  coolant_temp: {
    min: null,
    max: RULE_THRESHOLDS.coolantMaxC,
    note: `正常 ≤ ${RULE_THRESHOLDS.coolantMaxC} °C(暖机低温不计)`,
  },
  oil_temp: {
    min: null,
    max: RULE_THRESHOLDS.oilMaxC,
    note: `正常 ≤ ${RULE_THRESHOLDS.oilMaxC} °C`,
  },
  stft_b1: {
    min: -RULE_THRESHOLDS.stftAbsP95,
    max: RULE_THRESHOLDS.stftAbsP95,
    note: `正常 ±${RULE_THRESHOLDS.stftAbsP95} %`,
  },
  ltft_b1: {
    min: -RULE_THRESHOLDS.ltftAbsMean,
    max: RULE_THRESHOLDS.ltftAbsMean,
    note: `正常 ±${RULE_THRESHOLDS.ltftAbsMean} %`,
  },
};

export function bandFor(key: string): ChannelBand | undefined {
  return CHANNEL_BANDS[key];
}

export function isOutOfBand(v: number, band: ChannelBand | undefined): boolean {
  if (!band) return false;
  if (band.max !== null && v > band.max) return true;
  if (band.min !== null && v < band.min) return true;
  return false;
}

/** 中文通道名 — 与 livePidMeta 的用词保持一致。 */
export const CHANNEL_LABEL_ZH: Record<string, string> = {
  rpm: '转速',
  speed: '车速',
  coolant_temp: '水温',
  oil_temp: '机油温度',
  stft_b1: '短期燃油修正',
  ltft_b1: '长期燃油修正',
};
