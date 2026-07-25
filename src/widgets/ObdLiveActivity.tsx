// iOS Live Activity:灵动岛 + 锁屏 widget
// 验证「最险的一环」——OBD 数据能流到 widget(ADR-0029)。
// MVP 只显示水温 + STFT + phase 状态;timer/里程/颜色阈值留后续迭代。
//
// 文件名 / createLiveActivity 的 name 必须是合法 Swift identifier,
// 且要匹配 app.json plugins 里 ['expo-widgets', { widgets: ['ObdLiveActivity'] }] 的字符串。
// prebuild 时 config plugin 扫描这个文件(靠 'widget' 指令字面量识别),生成 Widget Extension Swift struct。
//
// 消费方(LiveSession)直接 `import obdActivity from './ObdLiveActivity'` 拿到 factory,
// 调 obdActivity.start(props) / instance.update(props) / instance.end()。

import { HStack, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, monospacedDigit, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';
import type { LiveActivityEnvironment, LiveActivityLayout } from 'expo-widgets';

// 活动状态——比 LivePhase 窄:MVP 只在 streaming 时有意义地展示数据。
// connecting/scanning 不映射(apple 要求 activity start 在前台,过渡态也 <5s)。
export type ActivityPhase = 'streaming' | 'connecting' | 'error';

export interface ObdActivityProps {
  phase: ActivityPhase;
  /** 水温 °C。null = 还没读数。 */
  coolant: number | null;
  /** 短期燃油修正 %。null = 还没读数,可负。 */
  stft: number | null;
}

// 数字格式化——widget 是 SwiftUI 渲染,不能用 RN 的 toLocaleString。
const fmtCoolant = (v: number | null) => (v == null ? '–' : String(Math.round(v)));
const fmtStft = (v: number | null) =>
  v == null ? '–' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}`;

// 阶段 → 颜色(对齐 src/styles/tokens.ts dark mode:Live Activity 默认在锁屏/灵动岛深色环境)。
const phaseColor = (p: ActivityPhase) =>
  p === 'streaming' ? '#30D158' : p === 'connecting' ? '#FF9F0A' : '#FF453A';
const phaseLabel = (p: ActivityPhase) =>
  p === 'streaming' ? '记录中' : p === 'connecting' ? '连接中' : '已断连';

// 大数值单元——banner/expanded 用,带 label 上标 + 大号 value + unit。
function StatCell({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={[font({ size: 11 }), foregroundStyle('gray')]}>{label}</Text>
      <HStack alignment="firstTextBaseline" spacing={2}>
        <Text modifiers={[font({ weight: 'bold', size: 28 }), monospacedDigit(), foregroundStyle(color)]}>
          {value}
        </Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle('gray')]}>{unit}</Text>
      </HStack>
    </VStack>
  );
}

// Live Activity 组件——返回各插槽内容。
// banner = 锁屏 Notifications Center 主体;compact* / minimal / expanded* = 灵动岛。
function ObdLiveActivity(
  props: ObdActivityProps,
  _environment: LiveActivityEnvironment,
): LiveActivityLayout {
  'widget';
  const color = phaseColor(props.phase);
  return {
    // 锁屏 widget 主体
    banner: (
      <HStack alignment="center" spacing={12} modifiers={[padding({ all: 14 })]}>
        <VStack alignment="leading" spacing={3}>
          <Text modifiers={[font({ weight: 'bold', size: 12 }), foregroundStyle(color)]}>
            {phaseLabel(props.phase)}
          </Text>
          <Text modifiers={[font({ size: 11 }), foregroundStyle('gray')]}>Blackbox</Text>
        </VStack>
        <HStack alignment="center" spacing={20} modifiers={[frame({ maxWidth: 9999 })]}>
          <StatCell label="水温" value={fmtCoolant(props.coolant)} unit="°C" color="white" />
          <StatCell label="STFT" value={fmtStft(props.stft)} unit="%" color="white" />
        </HStack>
      </HStack>
    ),
    // 灵动岛折叠态:左水温,右 STFT
    compactLeading: (
      <Text modifiers={[font({ weight: 'bold', size: 11 }), monospacedDigit(), foregroundStyle('white')]}>
        {fmtCoolant(props.coolant)}°
      </Text>
    ),
    compactTrailing: (
      <Text modifiers={[font({ weight: 'bold', size: 11 }), monospacedDigit(), foregroundStyle('white')]}>
        {fmtStft(props.stft)}%
      </Text>
    ),
    // 灵动岛被挤压到最小时(其它 app 占据了展开位)
    minimal: (
      <Text modifiers={[font({ weight: 'bold', size: 13 }), monospacedDigit(), foregroundStyle(color)]}>
        {fmtCoolant(props.coolant)}°
      </Text>
    ),
    // 灵动岛展开态:长按或轻点
    expandedLeading: (
      <StatCell label="水温" value={fmtCoolant(props.coolant)} unit="°C" color="white" />
    ),
    expandedTrailing: (
      <StatCell label="STFT" value={fmtStft(props.stft)} unit="%" color="white" />
    ),
    expandedCenter: (
      <Text modifiers={[font({ weight: 'bold', size: 12 }), foregroundStyle(color)]}>
        {phaseLabel(props.phase)}
      </Text>
    ),
  };
}

// 顶层注册——createLiveActivity 返回 LiveActivityFactory,
// 消费方调 factory.start(props) 拿 instance,instance.update/end 管生命周期。
export default createLiveActivity<ObdActivityProps>('ObdLiveActivity', ObdLiveActivity);
