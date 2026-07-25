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
//
// ⚠️ 重要:Live Activity 组件函数在 widget extension 进程里以序列化字符串形式执行,
// 看不到模块作用域的其它函数/变量。所有逻辑必须内联在组件函数体内,不能抽辅助函数。
// (实测踩坑:把 fmtCoolant/phaseColor 抽到模块顶层 → ReferenceError: Can't find variable)

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

// Live Activity 组件——返回各插槽内容。
// banner = 锁屏 Notifications Center 主体;compact* / minimal / expanded* = 灵动岛。
// 所有辅助逻辑必须内联在此函数体内(见文件头注释的踩坑说明)。
function ObdLiveActivity(
  props: ObdActivityProps,
  _environment: LiveActivityEnvironment,
): LiveActivityLayout {
  'widget';

  // 数字格式化(内联,不能抽函数)
  const fmtCoolant = props.coolant == null ? '–' : String(Math.round(props.coolant));
  const fmtStft =
    props.stft == null ? '–' : `${props.stft >= 0 ? '+' : ''}${props.stft.toFixed(1)}`;

  // 阶段 → 颜色(对齐 tokens.ts dark mode)
  const color =
    props.phase === 'streaming' ? '#30D158' : props.phase === 'connecting' ? '#FF9F0A' : '#FF453A';
  const phaseLabel =
    props.phase === 'streaming' ? '记录中' : props.phase === 'connecting' ? '连接中' : '已断连';

  // 大数值单元(内联,不能抽组件)
  const statCell = (label: string, value: string, unit: string) => (
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={[font({ size: 11 }), foregroundStyle('gray')]}>{label}</Text>
      <HStack alignment="firstTextBaseline" spacing={2}>
        <Text modifiers={[font({ weight: 'bold', size: 28 }), monospacedDigit(), foregroundStyle('white')]}>
          {value}
        </Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle('gray')]}>{unit}</Text>
      </HStack>
    </VStack>
  );

  return {
    // 锁屏 widget 主体
    banner: (
      <HStack alignment="center" spacing={12} modifiers={[padding({ all: 14 })]}>
        <VStack alignment="leading" spacing={3}>
          <Text modifiers={[font({ weight: 'bold', size: 12 }), foregroundStyle(color)]}>
            {phaseLabel}
          </Text>
          <Text modifiers={[font({ size: 11 }), foregroundStyle('gray')]}>Blackbox</Text>
        </VStack>
        <HStack alignment="center" spacing={20} modifiers={[frame({ maxWidth: 9999 })]}>
          {statCell('水温', fmtCoolant, '°C')}
          {statCell('STFT', fmtStft, '%')}
        </HStack>
      </HStack>
    ),
    // 灵动岛折叠态:左水温,右 STFT
    compactLeading: (
      <Text modifiers={[font({ weight: 'bold', size: 11 }), monospacedDigit(), foregroundStyle('white')]}>
        {fmtCoolant}°
      </Text>
    ),
    compactTrailing: (
      <Text modifiers={[font({ weight: 'bold', size: 11 }), monospacedDigit(), foregroundStyle('white')]}>
        {fmtStft}%
      </Text>
    ),
    // 灵动岛被挤压到最小时(其它 app 占据了展开位)
    minimal: (
      <Text modifiers={[font({ weight: 'bold', size: 13 }), monospacedDigit(), foregroundStyle(color)]}>
        {fmtCoolant}°
      </Text>
    ),
    // 灵动岛展开态:长按或轻点
    expandedLeading: statCell('水温', fmtCoolant, '°C'),
    expandedTrailing: statCell('STFT', fmtStft, '%'),
    expandedCenter: (
      <Text modifiers={[font({ weight: 'bold', size: 12 }), foregroundStyle(color)]}>
        {phaseLabel}
      </Text>
    ),
  };
}

// 顶层注册——createLiveActivity 返回 LiveActivityFactory,
// 消费方调 factory.start(props) 拿 instance,instance.update/end 管生命周期。
export default createLiveActivity<ObdActivityProps>('ObdLiveActivity', ObdLiveActivity);
