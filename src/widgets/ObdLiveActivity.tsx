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

import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
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

  // 越界着色 —— 阈值抄自 src/analysis/bands.ts(coolantMaxC=115, stftAbsP95=±12)。
  // 不能 import:组件在 widget extension 里以字符串执行,模块作用域不可见(见文件头)。
  // 颜色只在越界时出现:驾驶时任何一抹红都必须代表信息,不能是装饰。
  const coolantOver = props.coolant != null && props.coolant > 115;
  const stftOver = props.stft != null && Math.abs(props.stft) > 12;

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
    // CarPlay Dashboard / watchOS Smart Stack 的小卡(activity family .small)。
    // iOS 26 起,活动中的 Live Activity 自动出现在 CarPlay Dashboard —— 这是本 app
    // 唯一能在车机屏上完全自绘的界面(模板类 CarPlay 只给文字+图片+tint)。
    // 设计约束:开车时的一瞥。一个主值(水温——超温是唯一会毁发动机的读数)占视觉重心,
    // STFT 退到副位;不放 app 名、不放图标、不做动画。数字一律 monospacedDigit,
    // 否则每次刷新宽度跳变,余光看着像在抖。
    bannerSmall:
      props.phase === 'streaming' ? (
        <HStack alignment="center" spacing={10} modifiers={[padding({ horizontal: 14, vertical: 10 })]}>
          <VStack alignment="leading" spacing={1}>
            <Text modifiers={[font({ size: 10 }), foregroundStyle('gray')]}>水温</Text>
            <HStack alignment="firstTextBaseline" spacing={2}>
              <Text
                modifiers={[
                  font({ weight: 'bold', size: 30 }),
                  monospacedDigit(),
                  foregroundStyle(coolantOver ? '#FF453A' : 'white'),
                ]}
              >
                {fmtCoolant}
              </Text>
              <Text modifiers={[font({ size: 12 }), foregroundStyle('gray')]}>°C</Text>
            </HStack>
          </VStack>
          <Spacer />
          <VStack alignment="trailing" spacing={1}>
            <Text modifiers={[font({ size: 10 }), foregroundStyle('gray')]}>STFT</Text>
            <HStack alignment="firstTextBaseline" spacing={2}>
              <Text
                modifiers={[
                  font({ weight: 'semibold', size: 17 }),
                  monospacedDigit(),
                  foregroundStyle(stftOver ? '#FF9F0A' : 'white'),
                ]}
              >
                {fmtStft}
              </Text>
              <Text modifiers={[font({ size: 11 }), foregroundStyle('gray')]}>%</Text>
            </HStack>
          </VStack>
        </HStack>
      ) : (
        // 非 streaming:数字是陈旧的,不给。只说状态 —— 开车时看到旧数比看不到更糟。
        <HStack alignment="center" spacing={6} modifiers={[padding({ horizontal: 14, vertical: 10 })]}>
          <Text modifiers={[font({ weight: 'bold', size: 15 }), foregroundStyle(color)]}>
            {phaseLabel}
          </Text>
          <Spacer />
          <Text modifiers={[font({ size: 12 }), foregroundStyle('gray')]}>Blackbox</Text>
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
