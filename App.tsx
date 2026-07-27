import { RootNavigator } from './src/navigation/RootNavigator';
import { LiveSessionProvider } from './src/ble/LiveSession';
import { DemoSessionProvider } from './src/ble/DemoSession';
import { CarPlayHost } from './src/carplay/CarPlayHost';

// Demo 模式(EXPO_PUBLIC_DEMO_MODE=1):跳过 BLE,用模拟数据喂 context。
// babel 编译时内联 env var,无运行时开销。.env.local 已 gitignore,production 不带。
// 用法:echo "EXPO_PUBLIC_DEMO_MODE=1" > .env.local && npx expo run:ios --device
const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === '1';

// 消费者版 App(sub-project A + B)。
// 原 V0 调试 UI 备份在 App.debug.tsx(BLE 开发期看日志用)。
// V0 → 消费者版方向见 Protocol gap issue #6。
export default function App() {
  const SessionProvider = DEMO_MODE ? DemoSessionProvider : LiveSessionProvider;
  return (
    <SessionProvider>
      <RootNavigator />
      {/* CarPlay 仪表盘的驱动器。必须挂在 app 树里(要 LiveSession context,而且
          格子图靠 react-native-svg 的 toDataURL 光栅化 —— 得有真实挂载的视图)。
          自身只渲染屏幕外的 Svg,手机界面上看不见;CarPlay 不可用时是 no-op。 */}
      <CarPlayHost />
    </SessionProvider>
  );
}
