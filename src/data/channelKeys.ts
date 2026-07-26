// PID key ↔ UI key 的单一来源。
//
// 动机:BLE 层按 OBD 的 PID key 出样本(coolant_temp/stft_b1...),UI 层用短 key
// (coolant/stft...),而 bands.ts 的阈值挂在 PID key 上。CarPlay 仪表盘要拿 UI key
// 的实时值去查 PID key 的阈值,如果就地再抄一份映射,就成了第二套真相——正是
// ADR-0002 同源原则要避免的。所以这张表从 LiveSession 里抽出来放这儿,
// LiveSession 与 CarPlay 都 import 它。
//
// 纯数据、不 import react/react-native —— 保证能在 node 里离线跑。

/** OBD PID key → UI key。LiveSession 收到样本后用它做转换。 */
export const PID_TO_UI: Record<string, string> = {
  rpm: 'rpm',
  speed: 'speed',
  coolant_temp: 'coolant',
  oil_temp: 'oil',
  stft_b1: 'stft',
  ltft_b1: 'ltft',
};

/** UI key → OBD PID key。查 bands.ts 的阈值时用。 */
export const UI_TO_PID: Record<string, string> = Object.fromEntries(
  Object.entries(PID_TO_UI).map(([pid, ui]) => [ui, pid]),
);
