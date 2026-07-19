// Mock 数据 — 1:1 抽自 prototype/data.js,带 TS 类型。
// 后续 sub-project B/C/D 接入真实数据时,接口字段保持不变。

export interface Vehicle {
  name: string;
  model: string;
  engine: string;
  plate: string;
  odo: number;
  adapter: string;
}

export interface LivePid {
  key: string;
  label: string;
  unit: string;
  idle: number | null;
  drive: number | null;
  jitter: number;
  note?: string;
}

export type Tone = 'good' | 'watch' | 'inspect' | 'info';

export interface Finding {
  tone: Tone;
  title: string;
  detail: string;
  action?: string;
}

export interface Trip {
  id: string;
  group: string;
  time: string;
  title: string;
  dur: number;
  dist: number;
  verdict: Tone;
  cold: boolean;
  maxCoolant: number;
  avgRpm: number;
  ltft: number;
  stft: number;
  samples: number;
  route: string;
  summary: string;
  findings: Finding[];
  featured?: boolean;
}

export interface Trend {
  label: string;
  unit: string;
  now: number;
  dir: 'up' | 'down' | 'flat';
  tone: Tone;
  note: string;
  series: number[];
  months: string[];
}

export interface Outlook {
  score: number;
  verdictLabel: string;
  verdictTone: Tone;
  headline: string;
  current: Finding[];
  future: Finding[];
  normal: string[];
}

export const MOCK = {
  vehicle: {
    name: 'BMW 1系',
    model: '125i · F20',
    engine: 'N20 2.0T',
    plate: '沪A·M4NB0',
    odo: 68420,
    adapter: 'OBDLink CX',
  } satisfies Vehicle,
  livePids: [
    { key: 'rpm', label: '转速', unit: 'rpm', idle: 742, drive: 1980, jitter: 60 },
    { key: 'speed', label: '车速', unit: 'km/h', idle: 0, drive: 63, jitter: 4 },
    { key: 'coolant', label: '水温', unit: '°C', idle: 92, drive: 94, jitter: 1 },
    { key: 'oil', label: '机油温度', unit: '°C', idle: null, drive: null, jitter: 0, note: '车型未提供' },
    { key: 'stft', label: '短期燃油修正', unit: '%', idle: -1.6, drive: 2.4, jitter: 2.5 },
    { key: 'ltft', label: '长期燃油修正', unit: '%', idle: 5.5, drive: 5.4, jitter: 0.3 },
  ] satisfies LivePid[],
  trips: [
    {
      id: 't1', group: '今天', time: '07:42', title: '早高峰通勤', dur: 27, dist: 8.6,
      verdict: 'watch', cold: true, maxCoolant: 92, avgRpm: 1180, ltft: 5.5, stft: 4.2,
      samples: 1320, route: '家 → 公司',
      summary: '整体状况良好,只有一项需要留意:长期燃油修正略偏高,建议下次保养顺便检查。',
      findings: [
        { tone: 'good', title: '冷却系统工作正常', detail: '水温 8 分钟内从 21°C 平稳升到 92°C,全程没有超过 94°C,没有过热迹象。' },
        { tone: 'watch', title: '长期燃油修正略偏高', detail: '长期燃油修正平均 +5.5%,怠速时短期修正也偏正(+4.2%)。这通常意味着有一处很轻微的进气泄漏,目前不影响日常驾驶。', action: '下次保养时,让技师顺手检查一下进气侧的真空管路和节气门。' },
        { tone: 'info', title: '机油温度暂时读不到', detail: '你这台车的电脑没有对外提供机油温度,这一项已自动跳过,不影响其它监控。' },
      ],
      featured: true,
    },
    {
      id: 't2', group: '今天', time: '18:20', title: '下班回家', dur: 34, dist: 9.1,
      verdict: 'good', cold: false, maxCoolant: 93, avgRpm: 1090, ltft: 5.4, stft: 1.1,
      samples: 1610, route: '公司 → 家',
      summary: '一切正常,热车状态下各项指标都在健康范围内。',
      findings: [{ tone: 'good', title: '各项指标正常', detail: '热车行驶,水温、燃油修正、怠速转速都在正常范围。' }],
    },
    {
      id: 't3', group: '昨天', time: '08:05', title: '早高峰通勤', dur: 25, dist: 8.4,
      verdict: 'good', cold: true, maxCoolant: 92, avgRpm: 1210, ltft: 5.3, stft: 3.9,
      samples: 1240, route: '家 → 公司',
      summary: '冷启动升温正常,无异常。',
      findings: [{ tone: 'good', title: '冷启动正常', detail: '水温升温曲线正常,没有异常抖动。' }],
    },
    {
      id: 't4', group: '昨天', time: '12:36', title: '午间外出', dur: 12, dist: 3.2,
      verdict: 'good', cold: false, maxCoolant: 93, avgRpm: 1020, ltft: 5.2, stft: 0.8,
      samples: 560, route: '公司 → 餐厅',
      summary: '短途行驶,正常。',
      findings: [{ tone: 'good', title: '短途行程正常', detail: '行程较短,未发现异常。' }],
    },
    {
      id: 't5', group: '本周', time: '周三 07:51', title: '早高峰通勤', dur: 29, dist: 8.7,
      verdict: 'good', cold: true, maxCoolant: 93, avgRpm: 1150, ltft: 5.0, stft: 3.6,
      samples: 1400, route: '家 → 公司',
      summary: '正常。',
      findings: [{ tone: 'good', title: '各项指标正常', detail: '未发现异常。' }],
    },
    {
      id: 't6', group: '本周', time: '周二 19:10', title: '晚间购物', dur: 41, dist: 14.5,
      verdict: 'good', cold: false, maxCoolant: 94, avgRpm: 1240, ltft: 4.9, stft: 1.4,
      samples: 1980, route: '家 → 商场 → 家',
      summary: '中长途行驶,正常。',
      findings: [{ tone: 'good', title: '各项指标正常', detail: '高速与市区混合工况均正常。' }],
    },
    {
      id: 't7', group: '更早', time: '上周日 09:22', title: '周末郊游', dur: 78, dist: 46.3,
      verdict: 'good', cold: true, maxCoolant: 95, avgRpm: 1520, ltft: 4.2, stft: 2.1,
      samples: 3760, route: '市区 → 郊区',
      summary: '长途高速行驶,发动机状态良好。',
      findings: [{ tone: 'good', title: '长途表现良好', detail: '高速巡航稳定,水温控制良好。' }],
    },
    {
      id: 't8', group: '更早', time: '上周五 08:03', title: '早高峰通勤', dur: 31, dist: 8.9,
      verdict: 'good', cold: true, maxCoolant: 92, avgRpm: 1170, ltft: 3.9, stft: 3.4,
      samples: 1490, route: '家 → 公司',
      summary: '正常。',
      findings: [{ tone: 'good', title: '各项指标正常', detail: '未发现异常。' }],
    },
  ] satisfies Trip[],
  trends: {
    ltft: { label: '长期燃油修正', unit: '%', now: 5.5, dir: 'up', tone: 'watch', note: '过去 6 个月缓慢上升,需留意', series: [3.1, 3.4, 3.8, 4.2, 4.9, 5.5], months: ['2月', '3月', '4月', '5月', '6月', '7月'] },
    warmup: { label: '水温达工作温度用时', unit: 'min', now: 8.0, dir: 'flat', tone: 'good', note: '始终稳定,冷却系统健康', series: [8.2, 8.0, 8.3, 7.9, 8.1, 8.0], months: ['2月', '3月', '4月', '5月', '6月', '7月'] },
    idle: { label: '怠速转速稳定性', unit: 'rpm', now: 742, dir: 'flat', tone: 'good', note: '怠速平稳,无异常抖动', series: [745, 742, 740, 743, 741, 742], months: ['2月', '3月', '4月', '5月', '6月', '7月'] },
    cold: { label: '每周冷启动次数', unit: '次', now: 15, dir: 'up', tone: 'good', note: '略有增加,属正常使用范围', series: [12, 14, 11, 13, 12, 15], months: ['2月', '3月', '4月', '5月', '6月', '7月'] },
  } satisfies Record<'ltft' | 'warmup' | 'idle' | 'cold', Trend>,
  outlook: {
    score: 82, verdictLabel: '总体良好', verdictTone: 'good',
    headline: '这台车目前发动机状态良好,有一项需要长期留意,暂时不用担心。',
    current: [
      { tone: 'watch', title: '长期燃油修正偏高', detail: '可能存在很轻微的进气泄漏。目前对动力和油耗几乎没有影响,属于「先记录、再观察」的情况。' },
    ],
    future: [
      { tone: 'watch', title: '进气泄漏可能缓慢加重', detail: '按目前趋势,长期燃油修正每月约上升 0.4%。若持续,预计 3–6 个月后会更明显,可能开始影响油耗。', action: '建议下次保养时检查进气侧真空管路与节气门。' },
      { tone: 'info', title: '无法监控机油温度', detail: '车型未提供机油温度数据,无法对机油过热提前预警。日常驾驶影响不大,如在意可咨询是否能通过 BMW 专用通道读取。' },
    ],
    normal: ['冷却系统 · 水温控制正常', '怠速转速 · 平稳无抖动', '冷启动升温 · 曲线正常'],
  } satisfies Outlook,
};
