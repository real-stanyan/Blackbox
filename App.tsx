import { RootNavigator } from './src/navigation/RootNavigator';

// 消费者版 App(sub-project A)。
// 原 V0 调试 UI 备份在 App.debug.tsx(BLE 开发期看日志用)。
// V0 → 消费者版方向见 Protocol gap issue #6。
export default function App() {
  return <RootNavigator />;
}
