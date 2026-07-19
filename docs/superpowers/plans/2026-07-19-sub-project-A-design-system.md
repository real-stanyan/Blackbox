# Sub-project A — Design System Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把消费者版 App 的设计系统(tokens / Icon / 9 primitives / TabBar / Screen scaffold / RootNavigator / mock data / 5 screen)从 HTML+React 原型迁移到本 repo 的 RN 0.86 / Expo 57 环境,5 tab 能跑、深浅色跟随系统、数据全走 mock。

**Architecture:** Appearance API + 自建 ThemeContext 传 token,每个组件用 `useTheme()` + `createXxxStyles(t)` 工厂。react-navigation v7 的 BottomTabs + native-stack 管 5 tab / TripDetail push / Chat modal。react-native-svg 复刻 17 个 Icon、LineChart、Ring。expo-blur 给 tab bar 玻璃质感。5 个 hook(useVehicle/useLivePids/useTrips/useTrends/useOutlook)提前固定数据接口,后续 sub-project B/C/D 只换实现不改调用点。

**Tech Stack:** React Native 0.86 / Expo 57 / React 19.2 / TypeScript 6(已有);`@react-navigation/native` v7 + `@react-navigation/bottom-tabs` v7 + `@react-navigation/native-stack` v7、`react-native-screens`、`react-native-safe-area-context`、`react-native-svg`、`expo-blur`(新增)。

**Spec:** `docs/superpowers/specs/2026-07-19-sub-project-A-design-system-design.md`

## Global Constraints

- **门禁**:`npx tsc --noEmit` 必须绿(AGENTS.md 的 Gate)
- **全程在分支上做**:Task 1 Step 0 开 `feat/sub-project-A-design-system` 分支;所有 commit 都在这分支上;Task 14 开 PR(AGENTS.md「非 trivial 改动走分支 + PR」)
- **BLE 相关代码不动**:`src/ble/`、`src/obd/`、`src/analysis/`、`App.debug.tsx` 不许改
- **token 必须与 spec §4.1 的表 1:1 一致**(color hex / rgba 全部照抄)
- **fontVariant: ['tabular-nums']** 加在所有数字 readout(StatTile value、Ring 中心、TripDetail stats value、TrendCard now value、MetricChip value,如果用到)
- **commit message 写 why**,小步 commit
- **iOS 设计语言**:辐射 12-16 / tile 14 / pill 20 / bubble 18 + 5px tail corner(Spec §4.1 + handoff README §Fidelity)
- **iOS dev client**:本 repo 用 `expo-dev-client`(Expo Go 跑不了 BLE),验证用 `npx expo run:ios --device`
- **设计稿权威**:`~/Downloads/design_handoff_obd_consumer_app/prototype/` 是 1:1 参考,本 plan 的所有代码已对照原型实现
- **AGENTS.md 协议**:协议改动走 L1/L2 流程;A 不动 README/CONTEXT/ADR
- **Tone vs Verdict 是同义词**:原型用 `tone`,TS 类型在 tokens.ts 叫 `Verdict`(避免歧义)。两者指同一个 `'good'|'watch'|'inspect'|'info'` 联合。mock.ts 的 `Tone` 类型与 tokens.ts 的 `Verdict` 类型可互换,implementer 在 screen 里用 ToneIcon 时直接传 mock 的 `tone` 即可(TS 结构兼容)

---

## File Structure

**新建**:
- `src/styles/tokens.ts` — token 定义(light/dark 两个对象 + Mode/Token/Verdict 类型 + VERDICT 映射)
- `src/context/Theme.tsx` — ThemeProvider + useTheme
- `src/components/Icon.tsx` — 17 个 svg 图标(react-native-svg)
- `src/components/Group.tsx`、`Row.tsx`、`Card.tsx`、`Badge.tsx`、`Segmented.tsx`、`Toggle.tsx`、`ToneIcon.tsx`、`LineChart.tsx`、`Ring.tsx` — 9 primitives
- `src/components/TabBar.tsx`、`Screen.tsx` — chrome
- `src/components/AskButton.tsx` — 头部"问一问"按钮(被 Home/Health 用)
- `src/data/mock.ts` — mock 数据(对照 prototype/data.js)
- `src/hooks/useVehicle.ts`、`useLivePids.ts`、`useTrips.ts`、`useTrends.ts`、`useOutlook.ts` — 5 个数据 hook
- `src/navigation/RootNavigator.tsx` — RootStack + Tabs
- `src/screens/HomeScreen.tsx`、`HistoryScreen.tsx`、`TripDetailScreen.tsx`、`TrendsScreen.tsx`、`HealthScreen.tsx`、`SettingsScreen.tsx`、`ChatPlaceholderScreen.tsx` — 7 个 screen
- `src/screens/components/StatTile.tsx`(Home 用)、`TrendCard.tsx`(Trends 用)— screen 专用子组件

**修改**:
- `App.tsx` — 内容换成 `<RootNavigator />`
- `app.json` — `userInterfaceStyle: "dark"` → `"automatic"`
- `package.json` — 加 7 个依赖

**备份(新建)**:
- `App.debug.tsx` — 现 `App.tsx` 的内容 cp 过来

**不动**:`src/ble/`、`src/obd/`、`src/analysis/`、`index.ts`、`tsconfig.json`、`CONTEXT.md`、`README.md`、`AGENTS.md`、`docs/adr/`

---

## Task 1: 开分支 + 依赖安装 + app.json 切深浅色跟随

**Files:**
- Modify: `package.json`(加依赖)
- Modify: `app.json:8`(`userInterfaceStyle`)
- Create: `App.debug.tsx`(cp from App.tsx)
- Modify: `App.tsx`(临时占位,真替换在 Task 13)

**Interfaces:** 无(纯配置)

- [ ] **Step 0: 开分支(后续所有 commit 都在这分支上)**

Run:
```bash
git checkout main
git pull
git checkout -b feat/sub-project-A-design-system
```

> AGENTS.md「非 trivial 改动走分支 + PR」。sub-project A 是 Large 改动,全程在分支上做。Task 14 开 PR。

- [ ] **Step 1: 把现 App.tsx 备份到 App.debug.tsx**

Run:
```bash
cp App.tsx App.debug.tsx
```

在 `App.debug.tsx` 顶部加一行注释:
```typescript
// 备份:原 V0 调试 UI(Connect/Poll/Stop/Analyze/Export + 控制台)。
// 保留给 BLE 开发期看日志用;主 App.tsx 已切换为 RootNavigator(sub-project A)。
// V0 → 消费者版方向见 Protocol gap issue。
```

- [ ] **Step 2: 安装依赖**

Run:
```bash
npm install @react-navigation/native@^7 @react-navigation/bottom-tabs@^7 @react-navigation/native-stack@^7 react-native-screens react-native-safe-area-context react-native-svg expo-blur
```

预期:`package.json` 多 7 个 dependencies,`package-lock.json` 更新,`node_modules/` 安装完成。

- [ ] **Step 3: app.json 切深浅色跟随**

Modify `app.json:8`:
```json
    "userInterfaceStyle": "automatic",
```

(原来是 `"dark"`,Expo 接受 `"light"` / `"dark"` / `"automatic"`。`"automatic"` 让 `useColorScheme()` 跟随系统。)

- [ ] **Step 4: App.tsx 临时占位(让 app 能跑,真替换在 Task 13)**

Replace `App.tsx` 全文:
```typescript
import { Text } from 'react-native';

// 临时占位——RootNavigator 在 Task 11 写、Task 13 接入。在此之前 app 启动会显示这一行。
export default function App() {
  return <Text>sub-project A 进行中…</Text>;
}
```

- [ ] **Step 5: 跑门禁**

Run: `npx tsc --noEmit`
预期:无错误(空输出)。

- [ ] **Step 6: Commit**

```bash
git add App.tsx App.debug.tsx app.json package.json package-lock.json
git commit -m "chore(A): 装依赖 + app.json 切深浅色跟随 + 备份调试 UI

消费者版方向(设计 handoff)开工:为 sub-project A 设计系统层装依赖
(react-navigation v7 + screens + safe-area + svg + expo-blur);app.json
userInterfaceStyle 从 dark 改 automatic 让 useColorScheme 跟随系统;
现有 V0 调试 UI 备份到 App.debug.tsx 供 BLE 开发期看日志,App.tsx 留
临时占位等 Task 13 接入 RootNavigator。"
```

---

## Task 2: tokens.ts — 设计 token 与 VERDICT 映射

**Files:**
- Create: `src/styles/tokens.ts`

**Interfaces:**
- Produces: `TOKENS: Record<Mode, Token>`、`FONT`、`VERDICT: Record<Verdict, [label, colorKey]>`、`Mode` / `Token` / `Verdict` 类型。后续所有组件 import `{ TOKENS, FONT, VERDICT }` from `../styles/tokens`。

- [ ] **Step 1: 写 src/styles/tokens.ts**

```typescript
// Design tokens — light/dark 主题色 + 类型 + VERDICT 映射。
// 1:1 对照 prototype/kit.jsx TOKENS,字段名与 spec §4.1 一致。

export type Mode = 'light' | 'dark';

export interface Token {
  mode: Mode;
  bg: string;
  bgPlain: string;
  card: string;
  elevated: string;
  fill: string;
  fillStrong: string;
  label: string;
  label2: string;
  label3: string;
  sep: string;
  blue: string;
  green: string;
  orange: string;
  red: string;
  amber: string;
  barBg: string;
  barBorder: string;
}

export const TOKENS: Record<Mode, Token> = {
  light: {
    mode: 'light',
    bg: '#F2F2F7',
    bgPlain: '#FFFFFF',
    card: '#FFFFFF',
    elevated: '#FFFFFF',
    fill: 'rgba(120,120,128,0.12)',
    fillStrong: 'rgba(120,120,128,0.20)',
    label: '#000000',
    label2: 'rgba(60,60,67,0.60)',
    label3: 'rgba(60,60,67,0.30)',
    sep: 'rgba(60,60,67,0.20)',
    blue: '#007AFF',
    green: '#34C759',
    orange: '#EA5B2A',
    red: '#FF3B30',
    amber: '#FF9500',
    barBg: 'rgba(249,249,249,0.80)',
    barBorder: 'rgba(60,60,67,0.20)',
  },
  dark: {
    mode: 'dark',
    bg: '#000000',
    bgPlain: '#000000',
    card: '#1C1C1E',
    elevated: '#2C2C2E',
    fill: 'rgba(120,120,128,0.24)',
    fillStrong: 'rgba(120,120,128,0.36)',
    label: '#FFFFFF',
    label2: 'rgba(235,235,245,0.60)',
    label3: 'rgba(235,235,245,0.30)',
    sep: 'rgba(84,84,88,0.60)',
    blue: '#0A84FF',
    green: '#30D158',
    orange: '#FF6A3D',
    red: '#FF453A',
    amber: '#FF9F0A',
    barBg: 'rgba(28,28,30,0.80)',
    barBorder: 'rgba(84,84,88,0.55)',
  },
};

// RN 自动用系统字体(iOS = SF Pro / PingFang SC),fontFamily 不传即默认。
// 这里保留常量供需要显式指定的位置(如 SVG <Text> 用)。
export const FONT = '-apple-system, "PingFang SC", system-ui';

export type Verdict = 'good' | 'watch' | 'inspect' | 'info';

// VERDICT: [中文标签, 对应 Token 上的 colorKey]
export const VERDICT: Record<Verdict, [string, 'green' | 'amber' | 'red' | 'blue']> = {
  good: ['良好', 'green'],
  watch: ['留意', 'amber'],
  inspect: ['建议检查', 'red'],
  info: ['提示', 'blue'],
};
```

- [ ] **Step 2: 跑门禁**

Run: `npx tsc --noEmit`
预期:无错误。

- [ ] **Step 3: Commit**

```bash
git add src/styles/tokens.ts
git commit -m "feat(A): tokens.ts — 设计 token 与 VERDICT 映射

对照 prototype/kit.jsx TOKENS 1:1 抽出 light/dark 两套 token + 类型;
VERDICT 把 verdict tone 映射到中文标签 + Token 上的 colorKey,后续
Badge/ToneIcon/TrendCard 用它统一着色。"
```

---

## Task 3: Theme.tsx — ThemeProvider + useTheme

**Files:**
- Create: `src/context/Theme.tsx`

**Interfaces:**
- Consumes: `TOKENS`、`Mode`、`Token` from `../styles/tokens`
- Produces: `ThemeProvider` 组件、`useTheme()` 返回当前 `Token`。后续所有组件用 `useTheme()` 拿 token。

- [ ] **Step 1: 写 src/context/Theme.tsx**

```typescript
import { createContext, useContext, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { TOKENS, type Mode, type Token } from '../styles/tokens';

// A 阶段不暴露 override toggle(留给 sub-project E 的 Settings),接口先留好。
// override === null 表示跟随系统;设置后强制使用该 mode。
export interface ThemeContextValue {
  token: Token;
  mode: Mode;
  setOverride: (mode: Mode | null) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  token: TOKENS.light,
  mode: 'light',
  setOverride: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [override, setOverride] = useState<Mode | null>(null);
  const mode: Mode = override ?? (system === 'dark' ? 'dark' : 'light');
  const token = TOKENS[mode];
  return (
    <ThemeContext.Provider value={{ token, mode, setOverride }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext).token;
export const useThemeMode = () => {
  const { mode, setOverride } = useContext(ThemeContext);
  return { mode, setOverride };
};
```

- [ ] **Step 2: 跑门禁**

Run: `npx tsc --noEmit`
预期:无错误。

- [ ] **Step 3: Commit**

```bash
git add src/context/Theme.tsx
git commit -m "feat(A): Theme.tsx — ThemeProvider + useTheme

Appearance API useColorScheme 跟随系统;override 接口留好但 A 阶段不暴露
(留给 sub-project E 的 Settings 主题切换)。useTheme() 返回当前 Token,
useThemeMode() 返回当前 mode + setOverride 供 Settings 调用。"
```

---

## Task 4: Icon.tsx — 17 个 svg 图标

**Files:**
- Create: `src/components/Icon.tsx`

**Interfaces:**
- Produces: `<Icon name={...} size={24} color="#fff" fill={false} stroke={2} />`。name 是 `IconName` 类型(17 个字符串字面量联合)。后续 primitives、screen、TabBar 全部用 Icon。

- [ ] **Step 1: 写 src/components/Icon.tsx**

```typescript
import { Svg, Path, Circle, Rect } from 'react-native-svg';

export type IconName =
  | 'gauge' | 'clock' | 'chart' | 'heart' | 'gear'
  | 'chevron' | 'back' | 'bluetooth' | 'check'
  | 'bell' | 'share' | 'sound' | 'route' | 'car'
  | 'sparkles' | 'chatbubble'
  // fill 图标
  | 'checkcircle' | 'warncircle' | 'infocircle' | 'send';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  fill?: boolean; // 仅 heart 用 — 描边 vs 填充
  stroke?: number;
}

// 对照 prototype/kit.jsx Icon 的 17 个 case 1:1。
// stroke 图标用 <Path stroke>;checkcircle/warncircle/infocircle/send 是 fill 形态。
export function Icon({ name, size = 24, color = 'currentColor', fill = false, stroke = 2 }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const fillCommon = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: color,
  };

  switch (name) {
    case 'gauge':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M12 12l4-3" />
          <Circle cx="12" cy="12" r="1.3" fill={color} stroke="none" />
          <Path d="M12 3v1.5M21 12h-1.5M4.5 12H3" />
        </Svg>
      );
    case 'clock':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M12 7.5V12l3 2" />
        </Svg>
      );
    case 'chart':
      return (
        <Svg {...common}>
          <Path d="M4 15l5-5 4 3 6-7" />
          <Path d="M4 20h16" opacity={0.4} />
        </Svg>
      );
    case 'heart':
      return fill ? (
        <Svg {...fillCommon}>
          <Path d="M12 20.5C6.5 16.5 3 13.4 3 9.6 3 7 5 5 7.5 5c1.6 0 3 .8 3.8 2 .8-1.2 2.2-2 3.8-2C20 5 21 7 21 9.6c0 3.8-3.5 6.9-9 10.9z" />
        </Svg>
      ) : (
        <Svg {...common}>
          <Path d="M12 20.5C6.5 16.5 3 13.4 3 9.6 3 7 5 5 7.5 5c1.6 0 3 .8 3.8 2 .8-1.2 2.2-2 3.8-2C20 5 21 7 21 9.6c0 3.8-3.5 6.9-9 10.9z" />
        </Svg>
      );
    case 'gear':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="3.2" />
          <Path d="M12 2.8v2.4M12 18.8v2.4M4.3 7.5l2 1.2M17.7 15.3l2 1.2M4.3 16.5l2-1.2M17.7 8.7l2-1.2M2.8 12h2.4M18.8 12h2.4" />
        </Svg>
      );
    case 'chevron':
      return (
        <Svg {...common} strokeWidth={2.4}>
          <Path d="M9 6l6 6-6 6" />
        </Svg>
      );
    case 'back':
      return (
        <Svg {...common} strokeWidth={2.6}>
          <Path d="M15 6l-6 6 6 6" />
        </Svg>
      );
    case 'bluetooth':
      return (
        <Svg {...common}>
          <Path d="M7 7l10 10-5 4V3l5 4L7 17" />
        </Svg>
      );
    case 'check':
      return (
        <Svg {...common} strokeWidth={2.6}>
          <Path d="M5 13l4 4L19 7" />
        </Svg>
      );
    case 'checkcircle':
      return (
        <Svg {...fillCommon}>
          <Circle cx="12" cy="12" r="10" />
          <Path d="M7 12.5l3.2 3.2L17 9" stroke="#fff" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'warncircle':
      return (
        <Svg {...fillCommon}>
          <Circle cx="12" cy="12" r="10" />
          <Path d="M12 7v6" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
          <Circle cx="12" cy="16.5" r="1.2" fill="#fff" />
        </Svg>
      );
    case 'infocircle':
      return (
        <Svg {...fillCommon}>
          <Circle cx="12" cy="12" r="10" />
          <Path d="M12 11v6" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
          <Circle cx="12" cy="7.6" r="1.2" fill="#fff" />
        </Svg>
      );
    case 'bell':
      return (
        <Svg {...common}>
          <Path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z" />
          <Path d="M10 20a2 2 0 004 0" />
        </Svg>
      );
    case 'share':
      return (
        <Svg {...common}>
          <Path d="M12 15V4M8.5 7.5L12 4l3.5 3.5" />
          <Path d="M6 12v6a1 1 0 001 1h10a1 1 0 001-1v-6" />
        </Svg>
      );
    case 'sound':
      return (
        <Svg {...common}>
          <Path d="M4 9v6h4l5 4V5L8 9H4z" />
          <Path d="M17 9a4 4 0 010 6" />
        </Svg>
      );
    case 'route':
      return (
        <Svg {...common}>
          <Circle cx="6" cy="6" r="2.2" />
          <Circle cx="18" cy="18" r="2.2" />
          <Path d="M8 6h6a3 3 0 013 3v0a3 3 0 01-3 3H10a3 3 0 00-3 3v0" />
        </Svg>
      );
    case 'car':
      return (
        <Svg {...common}>
          <Path d="M5 16l1.2-4.2A2 2 0 018.1 10h7.8a2 2 0 011.9 1.8L19 16" />
          <Rect x="3.5" y="16" width="17" height="3.2" rx="1" />
          <Circle cx="7.5" cy="19.5" r="1" fill={color} stroke="none" />
          <Circle cx="16.5" cy="19.5" r="1" fill={color} stroke="none" />
        </Svg>
      );
    case 'sparkles':
      return (
        <Svg {...common}>
          <Path d="M12 3l1.6 4.3L18 9l-4.4 1.7L12 15l-1.6-4.3L6 9l4.4-1.7L12 3z" />
          <Path d="M18.5 14.5l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9z" />
        </Svg>
      );
    case 'send':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <Path d="M3.4 12l16.5-8.2c.5-.2 1 .3.8.8L12.5 21c-.2.5-.9.5-1.1 0l-2.2-6.4a1 1 0 00-.6-.6L2.3 11.7c-.5-.2-.5-.9 0-1.1l1.1.4z" />
        </Svg>
      );
    case 'chatbubble':
      return (
        <Svg {...common}>
          <Path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H9l-4 4v-4H6a2 2 0 01-2-2V6z" />
        </Svg>
      );
    default:
      return null;
  }
}
```

- [ ] **Step 2: 跑门禁**

Run: `npx tsc --noEmit`
预期:无错误。

- [ ] **Step 3: Commit**

```bash
git add src/components/Icon.tsx
git commit -m "feat(A): Icon.tsx — 17 个 svg 图标

对照 prototype/kit.jsx Icon 的 case 1:1,用 react-native-svg 重写。
接口 <Icon name size color fill stroke> 与原型一致。"
```

---

## Task 5: 基础 primitives — Card / Group / Badge / Segmented / ToneIcon

**Files:**
- Create: `src/components/Card.tsx`
- Create: `src/components/Group.tsx`
- Create: `src/components/Badge.tsx`
- Create: `src/components/Segmented.tsx`
- Create: `src/components/ToneIcon.tsx`

**Interfaces:**
- Consumes: `useTheme` from `../context/Theme`、`Icon`、`IconName` from `./Icon`、`VERDICT`、`Verdict` from `../styles/tokens`
- Produces: 这 5 个 primitive 的 props 接口(各自文件里 export)

- [ ] **Step 1: src/components/Card.tsx**

```typescript
import { Pressable, View, type ViewStyle, type StyleProp } from 'react-native';
import { useMemo, type ReactNode } from 'react';
import { useTheme } from '../context/Theme';

export interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  pad?: number;
  onClick?: () => void;
}

export function Card({ children, style, pad = 16, onClick }: CardProps) {
  const t = useTheme();
  const baseStyle = useMemo(
    () => ({
      card: {
        backgroundColor: t.card,
        borderRadius: 16,
        padding: pad,
        marginHorizontal: 16,
        marginBottom: 14,
      } as ViewStyle,
    }),
    [t, pad],
  );
  if (onClick) {
    return (
      <Pressable
        onPress={onClick}
        style={({ pressed }) => [baseStyle.card, pressed && { opacity: 0.7 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[baseStyle.card, style]}>{children}</View>;
}
```

- [ ] **Step 2: src/components/Group.tsx**

```typescript
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useMemo, type ReactNode } from 'react';
import { useTheme } from '../context/Theme';

export interface GroupProps {
  header?: string;
  footer?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

// iOS grouped list 容器。children 是一组 Row。
export function Group({ header, footer, children, style }: GroupProps) {
  const t = useTheme();
  const s = useMemo(
    () => ({
      wrap: { marginBottom: 22 } as ViewStyle,
      header: { color: t.label2, fontSize: 13, letterSpacing: 0.2, paddingHorizontal: 20, paddingBottom: 7 },
      inner: { backgroundColor: t.card, borderRadius: 12, marginHorizontal: 16, overflow: 'hidden' as const } as ViewStyle,
      footer: { color: t.label2, fontSize: 13, lineHeight: 18, paddingHorizontal: 20, paddingTop: 7 },
    }),
    [t],
  );
  return (
    <View style={[s.wrap, style]}>
      {header ? <Text style={s.header}>{header}</Text> : null}
      <View style={s.inner}>{children}</View>
      {footer ? <Text style={s.footer}>{footer}</Text> : null}
    </View>
  );
}
```

- [ ] **Step 3: src/components/Badge.tsx**

```typescript
import { View, Text } from 'react-native';
import { useMemo, type ReactNode } from 'react';
import { useTheme } from '../context/Theme';
import { VERDICT, type Verdict } from '../styles/tokens';

export interface BadgeProps {
  tone: Verdict;
  children: ReactNode;
}

export function Badge({ tone, children }: BadgeProps) {
  const t = useTheme();
  const colorKey = VERDICT[tone][1];
  const color = t[colorKey];
  const s = useMemo(
    () => ({
      wrap: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 5,
        backgroundColor: `${color}22`, // 13% alpha(hex 22 后缀)
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 20,
      },
      dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color },
      label: { color, fontSize: 12.5, fontWeight: '600' as const },
    }),
    [color],
  );
  return (
    <View style={s.wrap}>
      <View style={s.dot} />
      <Text style={s.label}>{children}</Text>
    </View>
  );
}
```

> **注意 `${color}22`**:hex color `#RRGGBB` + `22` 后缀 = 13% alpha,RN 的 backgroundColor 接受这种 8 位 hex。`#RRGGBBAA` 格式 RN 0.86 支持。

- [ ] **Step 4: src/components/Segmented.tsx**

```typescript
import { View, Pressable, Text } from 'react-native';
import { useMemo } from 'react';
import { useTheme } from '../context/Theme';

export interface SegmentedProps {
  options: string[];
  value: number;
  onChange: (i: number) => void;
}

// iOS segmented control。对照 prototype/kit.jsx Segmented。
export function Segmented({ options, value, onChange }: SegmentedProps) {
  const t = useTheme();
  const s = useMemo(
    () => ({
      wrap: {
        flexDirection: 'row' as const,
        backgroundColor: t.fill,
        borderRadius: 9,
        padding: 2,
        gap: 2,
        marginHorizontal: 16,
        marginBottom: 16,
      },
      item: {
        flex: 1,
        alignItems: 'center' as const,
        paddingVertical: 6,
        paddingHorizontal: 4,
        borderRadius: 7,
      },
      labelSel: { fontSize: 13, fontWeight: '600' as const, color: t.label },
      labelUnsel: { fontSize: 13, fontWeight: '400' as const, color: t.label },
    }),
    [t],
  );
  return (
    <View style={s.wrap}>
      {options.map((o, i) => {
        const sel = value === i;
        return (
          <Pressable
            key={i}
            onPress={() => onChange(i)}
            style={({ pressed }) => [
              s.item,
              sel && { backgroundColor: t.elevated },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={sel ? s.labelSel : s.labelUnsel}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 5: src/components/ToneIcon.tsx**

```typescript
import { Icon, type IconName } from './Icon';
import { useTheme } from '../context/Theme';
import { type Verdict } from '../styles/tokens';

export interface ToneIconProps {
  tone: Verdict;
  size?: number;
}

// tone → (iconName, color)。对照 prototype/kit.jsx ToneIcon map。
export function ToneIcon({ tone, size = 22 }: ToneIconProps) {
  const t = useTheme();
  const map: Record<Verdict, [IconName, string]> = {
    good: ['checkcircle', t.green],
    watch: ['warncircle', t.amber],
    inspect: ['warncircle', t.red],
    info: ['infocircle', t.blue],
  };
  const [name, color] = map[tone];
  return <Icon name={name} size={size} color={color} />;
}
```

- [ ] **Step 6: 跑门禁**

Run: `npx tsc --noEmit`
预期:无错误。

- [ ] **Step 7: Commit**

```bash
git add src/components/Card.tsx src/components/Group.tsx src/components/Badge.tsx src/components/Segmented.tsx src/components/ToneIcon.tsx
git commit -m "feat(A): 5 个基础 primitives — Card/Group/Badge/Segmented/ToneIcon

对照 prototype/kit.jsx。每个 primitive 用 useTheme + useMemo 工厂,
token 切换时重新生成 StyleSheet。Card 的 onClick 决定 Pressable vs
View;Badge 用 8 位 hex(#+alpha 后缀)做 13% 底色。"
```

---

## Task 6: Row + Toggle

**Files:**
- Create: `src/components/Row.tsx`
- Create: `src/components/Toggle.tsx`

**Interfaces:**
- Consumes: `Icon`、`useTheme`、`ReactNode`
- Produces: `<Row icon iconBg title sub value valueColor accessory right last onClick />`、`<Toggle on onChange />`

- [ ] **Step 1: src/components/Row.tsx**

```typescript
import { Pressable, View, Text, type ViewStyle } from 'react-native';
import { useMemo, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { useTheme } from '../context/Theme';

export interface RowProps {
  icon?: IconName;
  iconBg?: string;
  title: string;
  sub?: string;
  value?: string;
  valueColor?: string;
  // 'chevron'(默认)/ 'check' / null(无 accessory)
  accessory?: 'chevron' | 'check' | null;
  // 自定义右侧(优先于 value/accessory)
  right?: ReactNode;
  last?: boolean;
  onClick?: () => void;
}

// iOS grouped list 的行。对照 prototype/kit.jsx Row。
export function Row({
  icon, iconBg, title, sub, value, valueColor,
  accessory = 'chevron', right, last = false, onClick,
}: RowProps) {
  const t = useTheme();
  const s = useMemo(
    () => ({
      row: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 11,
        minHeight: 44,
      } as ViewStyle,
      iconWrap: {
        width: 29,
        height: 29,
        borderRadius: 7,
        backgroundColor: iconBg ?? t.blue,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
      },
      main: { flex: 1 } as ViewStyle,
      title: { color: t.label, fontSize: 17, lineHeight: 20 },
      sub: { color: t.label2, fontSize: 13, marginTop: 2 },
      sep: { height: 0.5, backgroundColor: t.sep, marginLeft: 12 + (icon ? 29 : 0) },
      valueText: {
        color: valueColor ?? t.label2,
        fontSize: 17,
        fontVariant: ['tabular-nums' as const],
      },
    }),
    [t, iconBg],
  );
  return (
    <Pressable
      onPress={onClick}
      disabled={!onClick}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: t.fill }]}
    >
      {icon ? (
        <View style={s.iconWrap}>
          <Icon name={icon} size={18} color="#fff" />
        </View>
      ) : null}
      <View style={s.main}>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={s.sub}>{sub}</Text> : null}
      </View>
      {right ? (
        right
      ) : (
        <>
          {value != null ? <Text style={s.valueText}>{value}</Text> : null}
          {accessory === 'chevron' && onClick ? <Icon name="chevron" size={17} color={t.label3} /> : null}
          {accessory === 'check' ? <Icon name="check" size={20} color={t.blue} /> : null}
        </>
      )}
      {!last ? <View style={[{ position: 'absolute' as const, left: 0, right: 0, bottom: 0 }, s.sep]} /> : null}
    </Pressable>
  );
}
```

> **Separator 实现**:原型用 CSS border,且对齐到 title 左侧(避开 icon)。RN 用 absolute 定位的 0.5px View,marginLeft 算出 icon 区 + gap。

- [ ] **Step 2: src/components/Toggle.tsx**

```typescript
import { Pressable, View, Animated, Platform } from 'react-native';
import { useRef, useEffect } from 'react';
import { useTheme } from '../context/Theme';

export interface ToggleProps {
  on: boolean;
  onChange: (on: boolean) => void;
}

// iOS switch。对照 prototype/kit.jsx Toggle;CSS transition .2s 改用
// Animated.timing 150ms ease(对照 spec §6)。
export function Toggle({ on, onChange }: ToggleProps) {
  const t = useTheme();
  const trans = useRef(new Animated.Value(on ? 20 : 0)).current;
  useEffect(() => {
    Animated.timing(trans, { toValue: on ? 20 : 0, duration: 150, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [on, trans]);
  const trackBg = on ? t.green : (t.mode === 'dark' ? '#39393D' : '#E9E9EA');
  return (
    <Pressable onPress={() => onChange(!on)} style={{ width: 51, height: 31, borderRadius: 16, backgroundColor: trackBg, padding: 2 }}>
      <Animated.View
        style={{
          width: 27,
          height: 27,
          borderRadius: 14,
          backgroundColor: '#fff',
          transform: [{ translateX: trans }],
          // iOS 阴影
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 1.5,
          shadowOffset: { width: 0, height: 1 },
          elevation: 2,
        }}
      />
    </Pressable>
  );
}
```

- [ ] **Step 3: 跑门禁**

Run: `npx tsc --noEmit`
预期:无错误。

- [ ] **Step 4: Commit**

```bash
git add src/components/Row.tsx src/components/Toggle.tsx
git commit -m "feat(A): Row + Toggle — iOS 列表行与开关

Row 用 absolute 定位 separator 对齐 title 左侧(避开 icon 区)。
Toggle 用 Animated.timing 150ms 替代 CSS transition .2s,滑块带
iOS 阴影。"
```

---

## Task 7: LineChart + Ring

**Files:**
- Create: `src/components/LineChart.tsx`
- Create: `src/components/Ring.tsx`

**Interfaces:**
- Consumes: `react-native-svg`、`useTheme`
- Produces: `<LineChart series months color unit />`、`<Ring value color size stroke children />`

- [ ] **Step 1: src/components/LineChart.tsx**

```typescript
import { Svg, Polygon, Polyline, Circle, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../context/Theme';

export interface LineChartProps {
  series: number[];
  months: string[];
  color: string;
  unit?: string;
  h?: number;
}

// 对照 prototype/kit.jsx LineChart。固定 viewBox 300×96,外层用 aspectRatio
// 自适应宽度(spec §6 LineChart 备注)。
export function LineChart({ series, months, color, h = 96 }: LineChartProps) {
  const t = useTheme();
  const w = 300, pad = 10;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (series.length - 1);
  const y = (v: number) => pad + (1 - (v - min) / span) * (h - 2 * pad - 16);
  const pts = series.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const area = `${pad},${h - 16} ${pts} ${w - pad},${h - 16}`;
  const gradId = `g${color.replace('#', '')}`;
  return (
    <Svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.22} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Polygon points={area} fill={`url(#${gradId})`} />
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      {series.map((v, i) => (
        <Circle key={i} cx={x(i)} cy={y(v)} r={i === series.length - 1 ? 3.4 : 0} fill={color} />
      ))}
      {months.map((m, i) => (
        <SvgText key={i} x={x(i)} y={h - 3} fontSize={9} fill={t.label3} textAnchor="middle">
          {m}
        </SvgText>
      ))}
    </Svg>
  );
}
```

- [ ] **Step 2: src/components/Ring.tsx**

```typescript
import { View } from 'react-native';
import { Svg, Circle } from 'react-native-svg';
import { Animated } from 'react-native';
import { useEffect, useRef, type ReactNode } from 'react';
import { useTheme } from '../context/Theme';

export interface RingProps {
  value: number; // 0-100
  color: string;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}

// 对照 prototype/kit.jsx Ring。score 变化时用 Animated.timing 让 dashoffset
// 平滑过渡(spec §6 Ring 备注)。
export function Ring({ value, color, size = 128, stroke = 11, children }: RingProps) {
  const t = useTheme();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const target = circumference * (1 - Math.max(0, Math.min(100, value)) / 100);
  const anim = useRef(new Animated.Value(target)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: target, duration: 600, useNativeDriver: false }).start();
  }, [target, anim]);
  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.fill} strokeWidth={stroke} />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={(anim as unknown) as number}
          strokeLinecap="round"
        />
      </Svg>
      <View
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </View>
  );
}

// react-native-svg 的 Circle 接受 Animated.Value 通过 createAnimatedComponent。
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
```

> **注意 `strokeDashoffset={(anim as unknown) as number}`**:Animated.createAnimatedComponent 包出来的组件接受 Animated.Value,但 TS 类型仍要求 number。用 `as unknown as number` 绕,运行时 Animated 系统接管。这是 RN + react-native-svg 的常见 workaround。

- [ ] **Step 3: 跑门禁**

Run: `npx tsc --noEmit`
预期:无错误。

- [ ] **Step 4: Commit**

```bash
git add src/components/LineChart.tsx src/components/Ring.tsx
git commit -m "feat(A): LineChart + Ring — svg 数据可视化

LineChart 固定 viewBox 300×96,LinearGradient 做面积渐变填充,最后
一点高亮 dot。Ring 用 Animated.createAnimatedComponent(Circle) 让
strokeDashoffset 600ms 平滑过渡。"
```

---

## Task 8: AskButton + mock 数据

**Files:**
- Create: `src/components/AskButton.tsx`
- Create: `src/data/mock.ts`

**Interfaces:**
- Consumes: `Icon`、`useTheme`、navigation(`useNavigation` from react-navigation)
- Produces: `<AskButton />`、`MOCK`(类型化)

- [ ] **Step 1: src/components/AskButton.tsx**

```typescript
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMemo } from 'react';
import { Icon } from './Icon';
import { useTheme } from '../context/Theme';

// 头部「问一问」按钮,点击跳 Chat placeholder。对照 prototype/chat.jsx AskButton。
export function AskButton() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const s = useMemo(
    () => ({
      wrap: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 5,
        backgroundColor: t.orange,
        paddingHorizontal: 13,
        paddingVertical: 7,
        borderRadius: 20,
      },
      label: { color: '#fff', fontSize: 14, fontWeight: '600' as const },
    }),
    [t],
  );
  return (
    <Pressable onPress={() => navigation.navigate('Chat')} style={({ pressed }) => [s.wrap, pressed && { opacity: 0.8 }]}>
      <Icon name="sparkles" size={16} color="#fff" stroke={1.8} />
      <Text style={s.label}>问一问</Text>
    </Pressable>
  );
}
```

- [ ] **Step 2: src/data/mock.ts**

```typescript
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
```

- [ ] **Step 3: 跑门禁**

Run: `npx tsc --noEmit`
预期:无错误。

- [ ] **Step 4: Commit**

```bash
git add src/components/AskButton.tsx src/data/mock.ts
git commit -m "feat(A): AskButton + mock.ts

AskButton 跳 Chat placeholder(用 useNavigation,navigate('Chat'))。
mock.ts 1:1 抽 prototype/data.js,所有数据 satisfies 类型,后续
sub-project B/C/D 接入真实数据时接口字段不变。"
```

---

## Task 9: 5 个数据 hook + useHomeMode dev override

**Files:**
- Create: `src/hooks/useVehicle.ts`
- Create: `src/hooks/useLivePids.ts`
- Create: `src/hooks/useTrips.ts`
- Create: `src/hooks/useTrends.ts`
- Create: `src/hooks/useOutlook.ts`
- Create: `src/hooks/useHomeMode.ts`

**Interfaces:**
- Consumes: `MOCK`、`Vehicle`、`LivePid`、`Trip`、`Trend`、`Outlook` from `../data/mock`
- Produces: 5 个数据 hook + 1 个 home mode 切换 hook(A 阶段 dev override,后续 B/C/D 接真实数据)

- [ ] **Step 1: src/hooks/useVehicle.ts**

```typescript
import { MOCK } from '../data/mock';
import type { Vehicle } from '../data/mock';

export function useVehicle(): Vehicle {
  return MOCK.vehicle;
}
```

- [ ] **Step 2: src/hooks/useLivePids.ts**

```typescript
import { MOCK } from '../data/mock';
import type { LivePid } from '../data/mock';

export function useLivePids(): LivePid[] {
  return MOCK.livePids;
}
```

- [ ] **Step 3: src/hooks/useTrips.ts**

```typescript
import { MOCK } from '../data/mock';
import type { Trip } from '../data/mock';

export function useTrips(): Trip[] {
  return MOCK.trips;
}
```

- [ ] **Step 4: src/hooks/useTrends.ts**

```typescript
import { MOCK } from '../data/mock';
import type { Trend } from '../data/mock';

export type TrendKey = 'ltft' | 'warmup' | 'idle' | 'cold';

export function useTrends(): Record<TrendKey, Trend> {
  return MOCK.trends;
}
```

- [ ] **Step 5: src/hooks/useOutlook.ts**

```typescript
import { MOCK } from '../data/mock';
import type { Outlook } from '../data/mock';

export function useOutlook(): Outlook {
  return MOCK.outlook;
}
```

- [ ] **Step 6: src/hooks/useHomeMode.ts**

```typescript
// A 阶段:dev override。Settings 底部 __DEV__ toggle 切 idle/driving。
// B 阶段接入真 BLE 后,这里换成「BLE 连接状态」的 derived 值。
import { useState, useCallback } from 'react';

export type HomeMode = 'idle' | 'driving';

export function useHomeMode() {
  // A 阶段默认 driving(展示有数据的样子)
  const [mode, setMode] = useState<HomeMode>('driving');
  const toggle = useCallback(() => {
    setMode((m) => (m === 'driving' ? 'idle' : 'driving'));
  }, []);
  return { mode, setMode, toggle };
}
```

- [ ] **Step 7: 跑门禁**

Run: `npx tsc --noEmit`
预期:无错误。

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useVehicle.ts src/hooks/useLivePids.ts src/hooks/useTrips.ts src/hooks/useTrends.ts src/hooks/useOutlook.ts src/hooks/useHomeMode.ts
git commit -m "feat(A): 5 个数据 hook + useHomeMode dev override

数据 hook 契约提前固定:后续 B/C/D 只换实现不改调用点(screen 仍用
useTrips()/useTrends()/useOutlook())。useHomeMode 是 A 阶段 dev
override,B 接入真 BLE 后改成 BLE 连接状态派生值。"
```

---

## Task 10: TabBar + Screen scaffold

**Files:**
- Create: `src/components/TabBar.tsx`
- Create: `src/components/Screen.tsx`

**Interfaces:**
- Consumes: `BottomTabBarProps` from `@react-navigation/bottom-tabs`、`BlurView` from `expo-blur`、`useSafeAreaInsets` from `react-native-safe-area-context`、`Icon`、`useTheme`
- Produces: `TabBar`(react-navigation 的 `tabBar` prop 用)、`Screen`(各 screen 用,带 large title + 可选 right + 可选 below + 可选 onBack)

- [ ] **Step 1: src/components/TabBar.tsx**

```typescript
import { View, Pressable, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useMemo } from 'react';
import { Icon, type IconName } from './Icon';
import { useTheme } from '../context/Theme';

// 对照 prototype/chrome.jsx TabBar。expo-blur BlurView 做 barBg 玻璃质感,
// active tint = orange。每个 tab 配 iconName + 中文 label,在 route.name
// 上以 params.icon / params.label 传(见 RootNavigator TabsScreen)。
const TAB_META: Record<string, { icon: IconName; label: string }> = {
  Home:     { icon: 'gauge', label: '实时' },
  History:  { icon: 'clock', label: '历史' },
  Trends:   { icon: 'chart', label: '趋势' },
  Health:   { icon: 'heart', label: '健康' },
  Settings: { icon: 'gear',  label: '设置' },
};

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(
    () => ({
      wrap: {
        position: 'absolute' as const,
        left: 0, right: 0, bottom: 0,
        borderTopWidth: 0.5,
        borderTopColor: t.barBorder,
        paddingBottom: insets.bottom,
      },
      row: { flexDirection: 'row' as const, height: 50 },
      tab: {
        flex: 1,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        gap: 3,
      },
      labelActive: { fontSize: 10, fontWeight: '600' as const, color: t.orange },
      labelInactive: { fontSize: 10, fontWeight: '500' as const, color: t.label3 },
    }),
    [t, insets.bottom],
  );
  return (
    <View style={s.wrap}>
      <BlurView intensity={80} tint={t.mode === 'dark' ? 'dark' : 'light'} style={s.row}>
        {state.routes.map((route, i) => {
          const active = state.index === i;
          const meta = TAB_META[route.name];
          if (!meta) return null;
          const col = active ? t.orange : t.label3;
          const { options } = descriptors[route.key];
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!active && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };
          return (
            <Pressable key={route.key} onPress={onPress} style={s.tab} accessibilityRole="button" accessibilityState={active ? { selected: true } : {}} accessibilityLabel={options.tabBarAccessibilityLabel}>
              <Icon name={meta.icon} size={26} color={col} fill={active && meta.icon === 'heart'} stroke={active ? 2.2 : 1.9} />
              <Text style={active ? s.labelActive : s.labelInactive}>{meta.label}</Text>
            </Pressable>
          );
        })}
      </BlurView>
    </View>
  );
}
```

- [ ] **Step 2: src/components/Screen.tsx**

```typescript
import { View, Text, ScrollView, Pressable, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useMemo, type ReactNode } from 'react';
import { Icon } from './Icon';
import { useTheme } from '../context/Theme';

export interface ScreenProps {
  title: string;
  children: ReactNode;
  right?: ReactNode;
  below?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  // 是否占满高度(非滚动场景)。默认 false(走 ScrollView)。
  noScroll?: boolean;
}

// Screen scaffold:large title + 可选 right + 可选 below + 可选 onBack
// (栈 push 的子页用)。对照 prototype/chrome.jsx Screen。
export function Screen({ title, children, right, below, onBack, backLabel = '返回', noScroll = false }: ScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(
    () => ({
      root: {
        flex: 1,
        backgroundColor: t.bg,
        paddingTop: insets.top,
      } as ViewStyle,
      navBar: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        height: 44,
        paddingHorizontal: 8,
        borderBottomWidth: 0.5,
        borderBottomColor: t.barBorder,
      },
      back: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
      },
      backLabel: { color: t.orange, fontSize: 17 },
      titleRow: {
        flexDirection: 'row' as const,
        alignItems: 'flex-end' as const,
        justifyContent: 'space-between' as const,
        paddingHorizontal: 16,
        paddingVertical: 8,
      },
      title: {
        fontSize: 34,
        fontWeight: '700' as const,
        letterSpacing: 0.4,
        color: t.label,
      },
      body: { paddingTop: 6, paddingBottom: 110 }, // 110 = tab bar 高度 + safe area 余量
    }),
    [t, insets.top],
  );
  return (
    <View style={s.root}>
      {onBack ? (
        <BlurView intensity={80} tint={t.mode === 'dark' ? 'dark' : 'light'} style={s.navBar}>
          <Pressable onPress={onBack} style={({ pressed }) => [s.back, pressed && { opacity: 0.5 }]}>
            <Icon name="back" size={22} color={t.orange} />
            <Text style={s.backLabel}>{backLabel}</Text>
          </Pressable>
        </BlurView>
      ) : null}
      <ScrollView scrollEnabled={!noScroll} contentContainerStyle={noScroll ? { flex: 1 } : undefined}>
        <View style={s.titleRow}>
          <Text style={s.title}>{title}</Text>
          {right}
        </View>
        {below}
        <View style={s.body}>{children}</View>
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 3: 跑门禁**

Run: `npx tsc --noEmit`
预期:无错误。

- [ ] **Step 4: Commit**

```bash
git add src/components/TabBar.tsx src/components/Screen.tsx
git commit -m "feat(A): TabBar + Screen — chrome 复刻

TabBar 用 expo-blur BlurView 复刻 chrome.jsx 的 backdrop-filter: blur,
active tint = orange,label 中文(实时/历史/趋势/健康/设置)。
Screen scaffold 支持 large title + 可选 right + below + onBack,
onBack 模式下顶部 BlurView nav bar 带 backLabel。"
```

---

## Task 11: RootNavigator + 7 个 Screen(合并 task — 一起写一起 commit)

**Files:**
- Create: `src/navigation/RootNavigator.tsx`
- Create: `src/screens/components/StatTile.tsx`(Home 用)
- Create: `src/screens/components/TrendCard.tsx`(Trends 用)
- Create: `src/screens/HomeScreen.tsx`
- Create: `src/screens/HistoryScreen.tsx`
- Create: `src/screens/TripDetailScreen.tsx`
- Create: `src/screens/TrendsScreen.tsx`
- Create: `src/screens/HealthScreen.tsx`
- Create: `src/screens/SettingsScreen.tsx`
- Create: `src/screens/ChatPlaceholderScreen.tsx`

**Interfaces:**
- Consumes: `ThemeProvider`、`useThemeMode`、`SafeAreaProvider`、`NavigationContainer`、`StatusBar`、`TabBar`、5 个 hook + useHomeMode + mock types + 全部 primitives
- Produces: `<RootNavigator />`(被 App.tsx 用)+ 7 个 screen

> **为什么合并**:RootNavigator import 7 个 screen,screen 又依赖 RootNavigator 提供的 navigation context(用 `useNavigation()`)。两者必须同时存在 tsc 才绿,合并成一个 task 一起 commit 是最干净的边界。

- [ ] **Step 1: src/navigation/RootNavigator.tsx**

```typescript
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useThemeMode } from '../context/Theme';
import { TabBar } from '../components/TabBar';
import { HomeScreen } from '../screens/HomeScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { TripDetailScreen } from '../screens/TripDetailScreen';
import { TrendsScreen } from '../screens/TrendsScreen';
import { HealthScreen } from '../screens/HealthScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ChatPlaceholderScreen } from '../screens/ChatPlaceholderScreen';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

export function RootNavigator() {
  return (
    <ThemeProvider>
      <NavigatorInner />
    </ThemeProvider>
  );
}

function NavigatorInner() {
  const { mode } = useThemeMode();
  return (
    <SafeAreaProvider>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Tabs" component={TabsScreen} />
          <Stack.Screen name="TripDetail" component={TripDetailScreen} />
          <Stack.Screen
            name="Chat"
            component={ChatPlaceholderScreen}
            options={{ presentation: 'modal' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

function TabsScreen() {
  return (
    <Tabs.Navigator
      tabBar={(p) => <TabBar {...p} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="History" component={HistoryScreen} />
      <Tabs.Screen name="Trends" component={TrendsScreen} />
      <Tabs.Screen name="Health" component={HealthScreen} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}
```

> **注意**:TripDetail/Chat 用 push/modal — `Stack.Screen` 默认 push。Chat 用 `presentation: 'modal'`。TripDetail 的 tripId 由 navigation 的 `route.params` 传(见 Step 6 TripDetailScreen 用 `useRoute`)。

> **TabBar 的 route.name**:Step 3 TabBar 用 `route.name`(`'Home'/'History'/...`)查 TAB_META,与 RootNavigator 这里 Tabs.Screen 的 name 严格一致。

- [ ] **Step 2: src/screens/components/StatTile.tsx**

```typescript
import { View, Text } from 'react-native';
import { useMemo } from 'react';
import { useTheme } from '../../context/Theme';

export interface StatTileProps {
  label: string;
  value: string | number; // '—' 或数字
  unit?: string;
  note?: string;
  color?: string;
}

// Home 的实时 tile。对照 prototype/screensA.jsx StatTile。
export function StatTile({ label, value, unit, note, color }: StatTileProps) {
  const t = useTheme();
  const isDash = value === '—';
  const s = useMemo(
    () => ({
      tile: {
        backgroundColor: t.card,
        borderRadius: 14,
        padding: 13,
        paddingHorizontal: 14,
        flex: 1,
        flexBasis: '40%' as unknown as number,
        minWidth: 0,
      },
      label: { color: t.label2, fontSize: 13, marginBottom: 6 },
      row: { flexDirection: 'row' as const, alignItems: 'baseline' as const, gap: 4 },
      value: {
        color: isDash ? t.label3 : (color ?? t.label),
        fontSize: 30,
        fontWeight: '600' as const,
        letterSpacing: -0.5,
        fontVariant: ['tabular-nums' as const],
        lineHeight: 30,
      },
      unit: { color: t.label2, fontSize: 13 },
      note: { color: t.label3, fontSize: 11, marginTop: 5 },
    }),
    [t, isDash, color],
  );
  return (
    <View style={s.tile}>
      <Text style={s.label}>{label}</Text>
      <View style={s.row}>
        <Text style={s.value}>{value}</Text>
        {unit && !isDash ? <Text style={s.unit}>{unit}</Text> : null}
      </View>
      {note ? <Text style={s.note}>{note}</Text> : null}
    </View>
  );
}
```

> **`flexBasis: '40%' as unknown as number`**:RN 的 flexBasis 接受百分比字符串,但 TS 类型签名是 number。这是 RN 类型定义的已知缺陷,用 `as unknown as number` 绕。

- [ ] **Step 3: src/screens/components/TrendCard.tsx**

```typescript
import { View, Text } from 'react-native';
import { useMemo } from 'react';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { LineChart } from '../../components/LineChart';
import { useTheme } from '../../context/Theme';
import type { Trend } from '../../data/mock';

export interface TrendCardProps {
  tr: Trend;
}

// Trends 的卡片。对照 prototype/screensB.jsx TrendCard。
export function TrendCard({ tr }: TrendCardProps) {
  const t = useTheme();
  const color = tr.tone === 'watch' ? t.amber : (tr.tone === 'inspect' ? t.red : t.green);
  const arrow = tr.dir === 'up' ? '↑' : (tr.dir === 'down' ? '↓' : '→');
  const s = useMemo(
    () => ({
      head: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'flex-start' as const,
        marginBottom: 4,
      },
      label: { color: t.label, fontSize: 16, fontWeight: '600' as const },
      valRow: {
        flexDirection: 'row' as const,
        alignItems: 'baseline' as const,
        gap: 5,
        marginTop: 4,
      },
      now: {
        color: t.label,
        fontSize: 26,
        fontWeight: '700' as const,
        letterSpacing: -0.5,
        fontVariant: ['tabular-nums' as const],
      },
      unit: { color: t.label2, fontSize: 13 },
      arrow: { color, fontSize: 15, fontWeight: '700' as const, marginLeft: 2 },
      chartWrap: { marginHorizontal: -4, marginTop: 8 },
      note: { color: t.label2, fontSize: 13.5, lineHeight: 20, marginTop: 6 },
    }),
    [t, color],
  );
  return (
    <Card>
      <View style={s.head}>
        <View>
          <Text style={s.label}>{tr.label}</Text>
          <View style={s.valRow}>
            <Text style={s.now}>{tr.now}</Text>
            <Text style={s.unit}>{tr.unit}</Text>
            <Text style={s.arrow}>{arrow}</Text>
          </View>
        </View>
        <Badge tone={tr.tone === 'watch' ? 'watch' : 'good'}>{tr.tone === 'watch' ? '需留意' : '正常'}</Badge>
      </View>
      <View style={s.chartWrap}>
        <LineChart series={tr.series} months={tr.months} color={color} unit={tr.unit} />
      </View>
      <Text style={s.note}>{tr.note}</Text>
    </Card>
  );
}
```

- [ ] **Step 4: src/screens/HomeScreen.tsx**

```typescript
import { View, Text, Pressable } from 'react-native';
import { useEffect, useState, useMemo } from 'react';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { AskButton } from '../components/AskButton';
import { StatTile } from './components/StatTile';
import { useTheme } from '../context/Theme';
import { useLivePids } from '../hooks/useLivePids';
import { useVehicle } from '../hooks/useVehicle';
import { useHomeMode } from '../hooks/useHomeMode';

// Home — 实时。对照 prototype/screensA.jsx HomeScreen。
export function HomeScreen() {
  const t = useTheme();
  const pids = useLivePids();
  const vehicle = useVehicle();
  const { mode } = useHomeMode();
  const driving = mode === 'driving';
  const [live, setLive] = useState<Record<string, number>>({});
  const [secs, setSecs] = useState(driving ? 754 : 0);

  useEffect(() => {
    if (!driving) {
      setLive({});
      return;
    }
    const roll = () => {
      const next: Record<string, number> = {};
      for (const p of pids) {
        if (p.drive == null) continue;
        const jittered = p.drive + (Math.random() - 0.5) * 2 * p.jitter;
        const isInt = p.key === 'rpm' || p.key === 'speed';
        next[p.key] = isInt ? Math.round(jittered) : Math.round(jittered * 100) / 100;
      }
      setLive(next);
    };
    roll();
    const iv = setInterval(roll, 900);
    const tv = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => {
      clearInterval(iv);
      clearInterval(tv);
    };
  }, [driving, pids]);

  const mmss = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

  const s = useMemo(
    () => ({
      heroRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14, padding: 18 },
      heroIconWrap: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: driving ? `${t.green}22` : t.fill,
        alignItems: 'center' as const, justifyContent: 'center' as const,
      },
      heroTitle: { color: t.label, fontSize: 19, fontWeight: '600' as const },
      heroSub: { color: t.label2, fontSize: 14, marginTop: 2 },
      heroFooterRow: { flexDirection: 'row' as const, borderTopWidth: 0.5, borderTopColor: t.sep },
      heroCell: { flex: 1, paddingHorizontal: 16, paddingVertical: 12 },
      heroCellRight: { borderLeftWidth: 0.5, borderLeftColor: t.sep },
      heroCellLabel: { color: t.label2, fontSize: 12 },
      heroCellValue: {
        color: t.label, fontSize: 22, fontWeight: '600' as const,
        fontVariant: ['tabular-nums' as const], marginTop: 2,
      },
      manualConn: {
        paddingVertical: 13, paddingHorizontal: 16,
        borderTopWidth: 0.5, borderTopColor: t.sep,
        color: t.orange, fontSize: 16, fontWeight: '500' as const, textAlign: 'center' as const,
      },
      sectionLabel: { color: t.label2, fontSize: 13, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },
      tilesWrap: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
      idleHint: { color: t.label3, fontSize: 13, textAlign: 'center' as const, paddingHorizontal: 40, paddingTop: 10, lineHeight: 18 },
    }),
    [t, driving],
  );

  return (
    <Screen title="实时" right={<AskButton />}>
      {/* Connection hero */}
      <Card pad={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
        <View style={s.heroRow}>
          <View style={s.heroIconWrap}>
            {driving ? (
              <Icon name="checkcircle" size={34} color={t.green} />
            ) : (
              <Icon name="bluetooth" size={26} color={t.label2} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.heroTitle}>{driving ? '已连接' : '等待连接'}</Text>
            <Text style={s.heroSub}>
              {driving
                ? `${vehicle.adapter} · ${vehicle.name} ${vehicle.model.split(' · ')[1]}`
                : '上车后自动连接,无需操作'}
            </Text>
          </View>
        </View>
        {driving ? (
          <View style={s.heroFooterRow}>
            <View style={s.heroCell}>
              <Text style={s.heroCellLabel}>本次行程</Text>
              <Text style={s.heroCellValue}>{mmss}</Text>
            </View>
            <View style={[s.heroCell, s.heroCellRight]}>
              <Text style={s.heroCellLabel}>里程</Text>
              <Text style={s.heroCellValue}>8.6 km</Text>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => {}} style={({ pressed }) => [s.manualConn, pressed && { opacity: 0.6 }]}>
            手动连接
          </Pressable>
        )}
      </Card>

      <Text style={s.sectionLabel}>{driving ? '实时数据 · 每秒更新' : '连接后显示实时数据'}</Text>
      <View style={s.tilesWrap}>
        {pids.map((p) => {
          const v: string | number = driving && live[p.key] != null
            ? live[p.key]
            : (driving && p.drive != null ? p.drive : '—');
          const col = p.key === 'coolant'
            ? t.blue
            : (p.key === 'ltft' && driving ? t.amber : t.label);
          const note = p.key === 'oil'
            ? p.note
            : (driving && p.key === 'ltft' ? '略偏高' : undefined);
          return (
            <StatTile
              key={p.key}
              label={p.label}
              value={v}
              unit={p.unit}
              note={note}
              color={col}
            />
          );
        })}
      </View>
      {!driving ? (
        <Text style={s.idleHint}>
          连接成功与断开时都会推送通知并响铃,你无需一直盯着这个页面。
        </Text>
      ) : null}
    </Screen>
  );
}
```

- [ ] **Step 5: src/screens/HistoryScreen.tsx**

```typescript
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { Group } from '../components/Group';
import { Row } from '../components/Row';
import { Badge } from '../components/Badge';
import { Icon } from '../components/Icon';
import { VERDICT } from '../styles/tokens';
import { useTheme } from '../context/Theme';
import { useTrips } from '../hooks/useTrips';
import { Text, View } from 'react-native';
import { useMemo } from 'react';

// History — 行程历史 list。对照 prototype/screensA.jsx HistoryScreen。
export function HistoryScreen() {
  const t = useTheme();
  const trips = useTrips();
  const navigation = useNavigation<any>();

  const groups = useMemo(() => {
    const out: { name: string; items: typeof trips }[] = [];
    for (const tr of trips) {
      let g = out.find((x) => x.name === tr.group);
      if (!g) {
        g = { name: tr.group, items: [] };
        out.push(g);
      }
      g.items.push(tr);
    }
    return out;
  }, [trips]);

  const iconBg = (v: string) => (v === 'watch' ? t.amber : (v === 'inspect' ? t.red : t.green));

  const below = (
    <Text style={{ color: t.label2, fontSize: 14, paddingHorizontal: 16, paddingBottom: 6 }}>
      每次断开连接后,自动记录并生成一份健康报告。
    </Text>
  );

  return (
    <Screen title="行程历史" below={below}>
      {groups.map((g) => (
        <Group key={g.name} header={g.name}>
          {g.items.map((tr, i) => (
            <Row
              key={tr.id}
              icon="car"
              iconBg={iconBg(tr.verdict)}
              title={tr.title}
              sub={`${tr.time} · ${tr.dist} km · ${tr.dur} 分钟`}
              last={i === g.items.length - 1}
              onClick={() => navigation.navigate('TripDetail', { tripId: tr.id })}
              right={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Badge tone={tr.verdict}>{VERDICT[tr.verdict][0]}</Badge>
                  <Icon name="chevron" size={17} color={t.label3} />
                </View>
              }
            />
          ))}
        </Group>
      ))}
    </Screen>
  );
}
```

- [ ] **Step 6: src/screens/TripDetailScreen.tsx**

```typescript
import { View, Text, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { ToneIcon } from '../components/ToneIcon';
import { Group } from '../components/Group';
import { Row } from '../components/Row';
import { useTheme } from '../context/Theme';
import { useTrips } from '../hooks/useTrips';

// TripDetail — 单次 AI 报告。对照 prototype/screensA.jsx TripDetail。
// navigation.goBack() 回 History;tripId 从 route.params 拿。
export function TripDetailScreen() {
  const t = useTheme();
  const trips = useTrips();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const tripId: string = route.params?.tripId;
  const tr = trips.find((x) => x.id === tripId) ?? trips[0];

  const stats: [string, string][] = [
    ['时长', `${tr.dur} 分钟`],
    ['里程', `${tr.dist} km`],
    ['最高水温', `${tr.maxCoolant} °C`],
    ['平均转速', `${tr.avgRpm} rpm`],
    ['冷启动', tr.cold ? '是' : '否'],
    ['采样点', tr.samples.toLocaleString()],
  ];

  const s = {
    belowSub: { color: t.label2, fontSize: 14, paddingHorizontal: 16, paddingBottom: 4 },
    heroRow: { flexDirection: 'row' as const, gap: 14, alignItems: 'flex-start' as const },
    heroTitle: { color: t.label, fontSize: 20, fontWeight: '700' as const },
    heroSummary: { color: t.label2, fontSize: 15, lineHeight: 22, marginTop: 6 },
    sectionLabel: { color: t.label2, fontSize: 13, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
    grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const },
    cell: {
      width: '50%' as unknown as number,
      paddingHorizontal: 16, paddingVertical: 13,
    },
    cellLabel: { color: t.label2, fontSize: 13 },
    cellValue: {
      color: t.label, fontSize: 20, fontWeight: '600' as const,
      fontVariant: ['tabular-nums' as const], marginTop: 3,
    },
    findingRow: { flexDirection: 'row' as const, gap: 12, alignItems: 'flex-start' as const },
    findingTitle: { color: t.label, fontSize: 16, fontWeight: '600' as const },
    findingDetail: { color: t.label2, fontSize: 14.5, lineHeight: 22, marginTop: 4 },
    actionBox: {
      flexDirection: 'row' as const, gap: 7, marginTop: 10,
      backgroundColor: t.fill, borderRadius: 10, padding: 9,
    },
    actionLabel: { color: t.orange, fontWeight: '700' as const },
    actionText: { color: t.label, fontSize: 14, lineHeight: 20 },
    disclaimer: { color: t.label3, fontSize: 12.5, lineHeight: 18, paddingHorizontal: 20, paddingBottom: 8, textAlign: 'center' as const },
  };

  return (
    <Screen
      title="行程报告"
      backLabel="行程历史"
      onBack={() => navigation.goBack()}
      below={<Text style={s.belowSub}>{tr.group} {tr.time} · {tr.route}</Text>}
    >
      <Card style={s.heroRow}>
        <ToneIcon tone={tr.verdict} size={30} />
        <View style={{ flex: 1 }}>
          <Text style={s.heroTitle}>
            {tr.verdict === 'good' ? '本次行程发动机状态良好' : '整体良好,有 1 项需要留意'}
          </Text>
          <Text style={s.heroSummary}>{tr.summary}</Text>
        </View>
      </Card>

      <Text style={s.sectionLabel}>本次行程概要</Text>
      <Card pad={0}>
        <View style={s.grid}>
          {stats.map(([k, v], i) => (
            <View
              key={k}
              style={[
                s.cell,
                i < 4 ? { borderBottomWidth: 0.5, borderBottomColor: t.sep } : null,
                i % 2 === 0 ? { borderRightWidth: 0.5, borderRightColor: t.sep } : null,
              ]}
            >
              <Text style={s.cellLabel}>{k}</Text>
              <Text style={s.cellValue}>{v}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Text style={s.sectionLabel}>AI 分析</Text>
      {tr.findings.map((f, i) => (
        <Card key={i} style={s.findingRow}>
          <ToneIcon tone={f.tone} size={24} />
          <View style={{ flex: 1 }}>
            <Text style={s.findingTitle}>{f.title}</Text>
            <Text style={s.findingDetail}>{f.detail}</Text>
            {f.action ? (
              <View style={s.actionBox}>
                <Text style={s.actionLabel}>建议</Text>
                <Text style={s.actionText}>{f.action}</Text>
              </View>
            ) : null}
          </View>
        </Card>
      ))}

      <Group style={{ marginTop: 8 }}>
        <Row icon="share" iconBg={t.blue} title="分享报告" accessory={null} onClick={() => {}} />
        <Row
          icon="route"
          iconBg={t.label2}
          title="导出行程数据 (JSON)"
          accessory={null}
          last
          onClick={() => Alert.alert('sub-project C', '导出功能将在持久化层接入后实现')}
        />
      </Group>
      <Text style={s.disclaimer}>
        报告由 AI 依据本次行程数据生成,仅供参考。发动机检修请咨询专业技师。
      </Text>
    </Screen>
  );
}
```

- [ ] **Step 7: src/screens/TrendsScreen.tsx**

```typescript
import { useState } from 'react';
import { Text } from 'react-native';
import { Screen } from '../components/Screen';
import { Segmented } from '../components/Segmented';
import { TrendCard } from './components/TrendCard';
import { useTheme } from '../context/Theme';
import { useTrends } from '../hooks/useTrends';
import { useTrips } from '../hooks/useTrips';

// Trends — 趋势。对照 prototype/screensB.jsx TrendsScreen。
export function TrendsScreen() {
  const t = useTheme();
  const [range, setRange] = useState(1);
  const trends = useTrends();
  const trips = useTrips();

  return (
    <Screen
      title="趋势"
      below={<Segmented options={['近 30 天', '近 3 个月', '近 1 年']} value={range} onChange={setRange} />}
    >
      <Text style={{ color: t.label2, fontSize: 14, paddingHorizontal: 16, paddingBottom: 10, lineHeight: 20 }}>
        把每一次行程累积起来,观察这台发动机随时间的变化。
      </Text>
      <TrendCard tr={trends.ltft} />
      <TrendCard tr={trends.warmup} />
      <TrendCard tr={trends.idle} />
      <TrendCard tr={trends.cold} />
      <Text style={{ color: t.label3, fontSize: 12.5, textAlign: 'center', paddingHorizontal: 40, paddingBottom: 8, lineHeight: 18 }}>
        共记录 {trips.length}+ 次行程。趋势基于历史行程的统计,个别行程的波动属于正常。
      </Text>
    </Screen>
  );
}
```

- [ ] **Step 8: src/screens/HealthScreen.tsx**

```typescript
import { View, Text } from 'react-native';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { Ring } from '../components/Ring';
import { Badge } from '../components/Badge';
import { ToneIcon } from '../components/ToneIcon';
import { AskButton } from '../components/AskButton';
import { Icon } from '../components/Icon';
import { useTheme } from '../context/Theme';
import { useOutlook } from '../hooks/useOutlook';
import type { Finding } from '../data/mock';

// Health — 健康展望。对照 prototype/screensB.jsx HealthScreen。
export function HealthScreen() {
  const t = useTheme();
  const O = useOutlook();
  const scoreCol = O.score >= 80 ? t.green : (O.score >= 60 ? t.amber : t.red);

  const Section = ({ title, items }: { title: string; items: Finding[] }) => (
    <>
      <Text style={{ color: t.label2, fontSize: 13, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 }}>{title}</Text>
      {items.map((it, i) => (
        <Card key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <ToneIcon tone={it.tone} size={24} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.label, fontSize: 16, fontWeight: '600' }}>{it.title}</Text>
            <Text style={{ color: t.label2, fontSize: 14.5, lineHeight: 22, marginTop: 4 }}>{it.detail}</Text>
            {it.action ? (
              <View style={{ flexDirection: 'row', gap: 7, marginTop: 10, backgroundColor: t.fill, borderRadius: 10, padding: 9 }}>
                <Text style={{ color: t.orange, fontWeight: '700' }}>建议</Text>
                <Text style={{ color: t.label, fontSize: 14, lineHeight: 20 }}>{it.action}</Text>
              </View>
            ) : null}
          </View>
        </Card>
      ))}
    </>
  );

  return (
    <Screen title="健康展望" right={<AskButton />}>
      <Card style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
        <Ring value={O.score} color={scoreCol} size={104} stroke={10}>
          <Text style={{ color: t.label, fontSize: 30, fontWeight: '700', fontVariant: ['tabular-nums'], lineHeight: 30 }}>{O.score}</Text>
          <Text style={{ color: t.label2, fontSize: 11, marginTop: 2 }}>健康分</Text>
        </Ring>
        <View style={{ flex: 1 }}>
          <Badge tone={O.verdictTone}>{O.verdictLabel}</Badge>
          <Text style={{ color: t.label, fontSize: 15.5, lineHeight: 23, marginTop: 8 }}>{O.headline}</Text>
        </View>
      </Card>
      <Section title="当前需要关注" items={O.current} />
      <Section title="未来可能出现的问题" items={O.future} />
      <Text style={{ color: t.label2, fontSize: 13, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 }}>目前一切正常</Text>
      <Card pad={0}>
        {O.normal.map((n, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              paddingHorizontal: 16, paddingVertical: 12,
              borderBottomWidth: i < O.normal.length - 1 ? 0.5 : 0,
              borderBottomColor: t.sep,
            }}
          >
            <Icon name="checkcircle" size={20} color={t.green} />
            <Text style={{ color: t.label, fontSize: 15 }}>{n}</Text>
          </View>
        ))}
      </Card>
      <Text style={{ color: t.label3, fontSize: 12.5, lineHeight: 18, paddingHorizontal: 20, paddingBottom: 8, textAlign: 'center' }}>
        展望由 AI 依据长期趋势推测,仅供参考,不构成维修结论。
      </Text>
    </Screen>
  );
}
```

- [ ] **Step 9: src/screens/SettingsScreen.tsx**

```typescript
import { useState } from 'react';
import { __DEV__ } from 'react-native';
import { Screen } from '../components/Screen';
import { Group } from '../components/Group';
import { Row } from '../components/Row';
import { Toggle } from '../components/Toggle';
import { useTheme } from '../context/Theme';
import { useVehicle } from '../hooks/useVehicle';
import { useHomeMode } from '../hooks/useHomeMode';

// Settings — 设置。对照 prototype/screensB.jsx SettingsScreen。
export function SettingsScreen() {
  const t = useTheme();
  const D = useVehicle();
  const { mode: homeMode, toggle: toggleHomeMode } = useHomeMode();
  const [autoConn, setAuto] = useState(true);
  const [chime, setChime] = useState(true);
  const [nConn, setNConn] = useState(true);
  const [nDis, setNDis] = useState(true);
  const [nRep, setNRep] = useState(true);

  return (
    <Screen title="设置">
      <Group header="设备">
        <Row icon="bluetooth" iconBg={t.blue} title={D.adapter} sub="已配对 · 蓝牙" value="已连接" valueColor={t.green} accessory="chevron" onClick={() => {}} />
        <Row icon="car" iconBg={t.orange} title="自动连接" sub="上车后自动连接并记录" right={<Toggle on={autoConn} onChange={setAuto} />} last />
      </Group>
      <Group header="通知与提示音" footer="连接与断开时推送通知并响铃,无需一直查看 App。">
        <Row icon="sound" iconBg={t.orange} title="连接提示音" right={<Toggle on={chime} onChange={setChime} />} />
        <Row icon="bell" iconBg={t.green} title="连接成功推送" right={<Toggle on={nConn} onChange={setNConn} />} />
        <Row icon="bell" iconBg={t.amber} title="连接中断推送" right={<Toggle on={nDis} onChange={setNDis} />} />
        <Row icon="bell" iconBg={t.blue} title="行程报告就绪推送" right={<Toggle on={nRep} onChange={setNRep} />} last />
      </Group>
      <Group header="车辆">
        <Row title="车型" value={`${D.name} · ${D.model.split(' · ')[1]}`} accessory={null} />
        <Row title="发动机" value={D.engine} accessory={null} />
        <Row title="车牌" value={D.plate} accessory={null} />
        <Row title="总里程" value={`${D.odo.toLocaleString()} km`} accessory={null} last />
      </Group>
      <Group header="AI 分析">
        <Row title="MiniMax API Key" value="已设置 ••••" accessory="chevron" onClick={() => {}} />
        <Row title="报告语言" value="简体中文" accessory="chevron" onClick={() => {}} last />
      </Group>
      <Group header="数据">
        <Row title="导出全部行程数据" valueColor={t.blue} accessory="chevron" onClick={() => {}} />
        <Row title="清除本地数据" valueColor={t.red} accessory={null} onClick={() => {}} last />
      </Group>
      {__DEV__ ? (
        <Group header="开发选项(DEV)" footer="A 阶段:切换 Home 的 idle/driving 模式。B 接入真 BLE 后此 toggle 移除。">
          <Row
            icon="gauge"
            iconBg={t.label2}
            title="Home 模式"
            sub={homeMode === 'driving' ? '行驶中' : '未连接'}
            right={<Toggle on={homeMode === 'driving'} onChange={toggleHomeMode} />}
            last
          />
        </Group>
      ) : null}
      <Group footer="OBD 健康记录 · 个人工具,数据仅存本机。">
        <Row title="版本" value="1.0.0 (V1)" accessory={null} last />
      </Group>
    </Screen>
  );
}
```

> **`__DEV__`**:RN 全局常量,dev 模式为 true,production build 为 false。Settings 底部的 dev toggle 只在 dev 时显示。

- [ ] **Step 10: src/screens/ChatPlaceholderScreen.tsx**

```typescript
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '../components/Icon';
import { useTheme } from '../context/Theme';

// Chat placeholder — sub-project D 接入真 AI chat。
export function ChatPlaceholderScreen() {
  const t = useTheme();
  const navigation = useNavigation();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', height: 46,
          paddingHorizontal: 6,
          backgroundColor: t.barBg,
          borderBottomWidth: 0.5, borderBottomColor: t.barBorder,
        }}
      >
        <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center' }, pressed && { opacity: 0.5 }]}>
          <Icon name="back" size={22} color={t.orange} />
          <Text style={{ color: t.orange, fontSize: 17 }}>返回</Text>
        </Pressable>
        <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }}>
          <Text style={{ color: t.label, fontSize: 16, fontWeight: '600' }}>问车况</Text>
          <Text style={{ color: t.label2, fontSize: 11 }}>基于你的行驶数据</Text>
        </View>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
        <Icon name="sparkles" size={48} color={t.label3} />
        <Text style={{ color: t.label2, fontSize: 15, textAlign: 'center', marginTop: 16, lineHeight: 22 }}>
          问车况将在 sub-project D 接入{'\n'}基于真实行程数据的 AI 对话。
        </Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 11: 跑门禁**

Run: `npx tsc --noEmit`
预期:无错误。

- [ ] **Step 12: Commit**

```bash
git add src/navigation/RootNavigator.tsx src/screens/HomeScreen.tsx src/screens/HistoryScreen.tsx src/screens/TripDetailScreen.tsx src/screens/TrendsScreen.tsx src/screens/HealthScreen.tsx src/screens/SettingsScreen.tsx src/screens/ChatPlaceholderScreen.tsx src/screens/components/StatTile.tsx src/screens/components/TrendCard.tsx
git commit -m "feat(A): RootNavigator + 7 个 screen

RootNavigator:ThemeProvider → SafeAreaProvider → NavigationContainer →
Stack(Tabs + TripDetail push + Chat modal)。TabBar 用自定义,StatusBar
跟随主题。Home 默认 driving(mock + 900ms 滚动);History 行点击 push
TripDetail;Trends Segmented + 4 TrendCard;Health Ring + current/future
+ normal;Settings 仅 toggle local state + __DEV__ Home 模式切换;
Chat placeholder 在 D 接入。"
```

- [ ] **Step 1: src/screens/components/StatTile.tsx**

```typescript
import { View, Text } from 'react-native';
import { useMemo } from 'react';
import { useTheme } from '../../context/Theme';

export interface StatTileProps {
  label: string;
  value: string | number; // '—' 或数字
  unit?: string;
  note?: string;
  color?: string;
}

// Home 的实时 tile。对照 prototype/screensA.jsx StatTile。
export function StatTile({ label, value, unit, note, color }: StatTileProps) {
  const t = useTheme();
  const isDash = value === '—';
  const s = useMemo(
    () => ({
      tile: {
        backgroundColor: t.card,
        borderRadius: 14,
        padding: 13,
        paddingHorizontal: 14,
        flex: 1,
        flexBasis: '40%' as unknown as number,
        minWidth: 0,
      },
      label: { color: t.label2, fontSize: 13, marginBottom: 6 },
      row: { flexDirection: 'row' as const, alignItems: 'baseline' as const, gap: 4 },
      value: {
        color: isDash ? t.label3 : (color ?? t.label),
        fontSize: 30,
        fontWeight: '600' as const,
        letterSpacing: -0.5,
        fontVariant: ['tabular-nums' as const],
        lineHeight: 30,
      },
      unit: { color: t.label2, fontSize: 13 },
      note: { color: t.label3, fontSize: 11, marginTop: 5 },
    }),
    [t, isDash, color],
  );
  return (
    <View style={s.tile}>
      <Text style={s.label}>{label}</Text>
      <View style={s.row}>
        <Text style={s.value}>{value}</Text>
        {unit && !isDash ? <Text style={s.unit}>{unit}</Text> : null}
      </View>
      {note ? <Text style={s.note}>{note}</Text> : null}
    </View>
  );
}
```

> **`flexBasis: '40%' as unknown as number`**:RN 的 flexBasis 接受百分比字符串,但 TS 类型签名是 number。这是 RN 类型定义的已知缺陷,用 `as unknown as number` 绕。

- [ ] **Step 2: src/screens/components/TrendCard.tsx**

```typescript
import { View, Text } from 'react-native';
import { useMemo } from 'react';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { LineChart } from '../../components/LineChart';
import { useTheme } from '../../context/Theme';
import type { Trend } from '../../data/mock';

export interface TrendCardProps {
  tr: Trend;
}

// Trends 的卡片。对照 prototype/screensB.jsx TrendCard。
export function TrendCard({ tr }: TrendCardProps) {
  const t = useTheme();
  const color = tr.tone === 'watch' ? t.amber : (tr.tone === 'inspect' ? t.red : t.green);
  const arrow = tr.dir === 'up' ? '↑' : (tr.dir === 'down' ? '↓' : '→');
  const s = useMemo(
    () => ({
      head: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'flex-start' as const,
        marginBottom: 4,
      },
      label: { color: t.label, fontSize: 16, fontWeight: '600' as const },
      valRow: {
        flexDirection: 'row' as const,
        alignItems: 'baseline' as const,
        gap: 5,
        marginTop: 4,
      },
      now: {
        color: t.label,
        fontSize: 26,
        fontWeight: '700' as const,
        letterSpacing: -0.5,
        fontVariant: ['tabular-nums' as const],
      },
      unit: { color: t.label2, fontSize: 13 },
      arrow: { color, fontSize: 15, fontWeight: '700' as const, marginLeft: 2 },
      chartWrap: { marginHorizontal: -4, marginTop: 8 },
      note: { color: t.label2, fontSize: 13.5, lineHeight: 20, marginTop: 6 },
    }),
    [t, color],
  );
  return (
    <Card>
      <View style={s.head}>
        <View>
          <Text style={s.label}>{tr.label}</Text>
          <View style={s.valRow}>
            <Text style={s.now}>{tr.now}</Text>
            <Text style={s.unit}>{tr.unit}</Text>
            <Text style={s.arrow}>{arrow}</Text>
          </View>
        </View>
        <Badge tone={tr.tone === 'watch' ? 'watch' : 'good'}>{tr.tone === 'watch' ? '需留意' : '正常'}</Badge>
      </View>
      <View style={s.chartWrap}>
        <LineChart series={tr.series} months={tr.months} color={color} unit={tr.unit} />
      </View>
      <Text style={s.note}>{tr.note}</Text>
    </Card>
  );
}
```

- [ ] **Step 3: src/screens/HomeScreen.tsx**

```typescript
import { View, Text, Pressable } from 'react-native';
import { useEffect, useState, useMemo } from 'react';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { AskButton } from '../components/AskButton';
import { StatTile } from './components/StatTile';
import { useTheme } from '../context/Theme';
import { useLivePids } from '../hooks/useLivePids';
import { useVehicle } from '../hooks/useVehicle';
import { useHomeMode } from '../hooks/useHomeMode';

// Home — 实时。对照 prototype/screensA.jsx HomeScreen。
export function HomeScreen() {
  const t = useTheme();
  const pids = useLivePids();
  const vehicle = useVehicle();
  const { mode } = useHomeMode();
  const driving = mode === 'driving';
  const [live, setLive] = useState<Record<string, number>>({});
  const [secs, setSecs] = useState(driving ? 754 : 0);

  useEffect(() => {
    if (!driving) {
      setLive({});
      return;
    }
    const roll = () => {
      const next: Record<string, number> = {};
      for (const p of pids) {
        if (p.drive == null) continue;
        const jittered = p.drive + (Math.random() - 0.5) * 2 * p.jitter;
        const isInt = p.key === 'rpm' || p.key === 'speed';
        next[p.key] = isInt ? Math.round(jittered) : Math.round(jittered * 100) / 100;
      }
      setLive(next);
    };
    roll();
    const iv = setInterval(roll, 900);
    const tv = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => {
      clearInterval(iv);
      clearInterval(tv);
    };
  }, [driving, pids]);

  const mmss = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

  const s = useMemo(
    () => ({
      heroRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14, padding: 18 },
      heroIconWrap: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: driving ? `${t.green}22` : t.fill,
        alignItems: 'center' as const, justifyContent: 'center' as const,
      },
      heroTitle: { color: t.label, fontSize: 19, fontWeight: '600' as const },
      heroSub: { color: t.label2, fontSize: 14, marginTop: 2 },
      heroFooterRow: { flexDirection: 'row' as const, borderTopWidth: 0.5, borderTopColor: t.sep },
      heroCell: { flex: 1, paddingHorizontal: 16, paddingVertical: 12 },
      heroCellRight: { borderLeftWidth: 0.5, borderLeftColor: t.sep },
      heroCellLabel: { color: t.label2, fontSize: 12 },
      heroCellValue: {
        color: t.label, fontSize: 22, fontWeight: '600' as const,
        fontVariant: ['tabular-nums' as const], marginTop: 2,
      },
      manualConn: {
        paddingVertical: 13, paddingHorizontal: 16,
        borderTopWidth: 0.5, borderTopColor: t.sep,
        color: t.orange, fontSize: 16, fontWeight: '500' as const, textAlign: 'center' as const,
      },
      sectionLabel: { color: t.label2, fontSize: 13, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },
      tilesWrap: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
      idleHint: { color: t.label3, fontSize: 13, textAlign: 'center' as const, paddingHorizontal: 40, paddingTop: 10, lineHeight: 18 },
    }),
    [t, driving],
  );

  return (
    <Screen title="实时" right={<AskButton />}>
      {/* Connection hero */}
      <Card pad={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
        <View style={s.heroRow}>
          <View style={s.heroIconWrap}>
            {driving ? (
              <Icon name="checkcircle" size={34} color={t.green} />
            ) : (
              <Icon name="bluetooth" size={26} color={t.label2} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.heroTitle}>{driving ? '已连接' : '等待连接'}</Text>
            <Text style={s.heroSub}>
              {driving
                ? `${vehicle.adapter} · ${vehicle.name} ${vehicle.model.split(' · ')[1]}`
                : '上车后自动连接,无需操作'}
            </Text>
          </View>
        </View>
        {driving ? (
          <View style={s.heroFooterRow}>
            <View style={s.heroCell}>
              <Text style={s.heroCellLabel}>本次行程</Text>
              <Text style={s.heroCellValue}>{mmss}</Text>
            </View>
            <View style={[s.heroCell, s.heroCellRight]}>
              <Text style={s.heroCellLabel}>里程</Text>
              <Text style={s.heroCellValue}>8.6 km</Text>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => {}} style={({ pressed }) => [s.manualConn, pressed && { opacity: 0.6 }]}>
            手动连接
          </Pressable>
        )}
      </Card>

      <Text style={s.sectionLabel}>{driving ? '实时数据 · 每秒更新' : '连接后显示实时数据'}</Text>
      <View style={s.tilesWrap}>
        {pids.map((p) => {
          const v: string | number = driving && live[p.key] != null
            ? live[p.key]
            : (driving && p.drive != null ? p.drive : '—');
          const col = p.key === 'coolant'
            ? t.blue
            : (p.key === 'ltft' && driving ? t.amber : t.label);
          const note = p.key === 'oil'
            ? p.note
            : (driving && p.key === 'ltft' ? '略偏高' : undefined);
          return (
            <StatTile
              key={p.key}
              label={p.label}
              value={v}
              unit={p.unit}
              note={note}
              color={col}
            />
          );
        })}
      </View>
      {!driving ? (
        <Text style={s.idleHint}>
          连接成功与断开时都会推送通知并响铃,你无需一直盯着这个页面。
        </Text>
      ) : null}
    </Screen>
  );
}
```

- [ ] **Step 4: src/screens/HistoryScreen.tsx**

```typescript
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { Group } from '../components/Group';
import { Row } from '../components/Row';
import { Badge } from '../components/Badge';
import { Icon } from '../components/Icon';
import { VERDICT } from '../styles/tokens';
import { useTheme } from '../context/Theme';
import { useTrips } from '../hooks/useTrips';
import { Text, View } from 'react-native';
import { useMemo } from 'react';

// History — 行程历史 list。对照 prototype/screensA.jsx HistoryScreen。
export function HistoryScreen() {
  const t = useTheme();
  const trips = useTrips();
  const navigation = useNavigation<any>();

  const groups = useMemo(() => {
    const out: { name: string; items: typeof trips }[] = [];
    for (const tr of trips) {
      let g = out.find((x) => x.name === tr.group);
      if (!g) {
        g = { name: tr.group, items: [] };
        out.push(g);
      }
      g.items.push(tr);
    }
    return out;
  }, [trips]);

  const iconBg = (v: string) => (v === 'watch' ? t.amber : (v === 'inspect' ? t.red : t.green));

  const below = (
    <Text style={{ color: t.label2, fontSize: 14, paddingHorizontal: 16, paddingBottom: 6 }}>
      每次断开连接后,自动记录并生成一份健康报告。
    </Text>
  );

  return (
    <Screen title="行程历史" below={below}>
      {groups.map((g) => (
        <Group key={g.name} header={g.name}>
          {g.items.map((tr, i) => (
            <Row
              key={tr.id}
              icon="car"
              iconBg={iconBg(tr.verdict)}
              title={tr.title}
              sub={`${tr.time} · ${tr.dist} km · ${tr.dur} 分钟`}
              last={i === g.items.length - 1}
              onClick={() => navigation.navigate('TripDetail', { tripId: tr.id })}
              right={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Badge tone={tr.verdict}>{VERDICT[tr.verdict][0]}</Badge>
                  <Icon name="chevron" size={17} color={t.label3} />
                </View>
              }
            />
          ))}
        </Group>
      ))}
    </Screen>
  );
}
```

- [ ] **Step 5: src/screens/TripDetailScreen.tsx**

```typescript
import { View, Text, Pressable, Alert } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { ToneIcon } from '../components/ToneIcon';
import { Group } from '../components/Group';
import { Row } from '../components/Row';
import { useTheme } from '../context/Theme';
import { useTrips } from '../hooks/useTrips';

// TripDetail — 单次 AI 报告。对照 prototype/screensA.jsx TripDetail。
// navigation 走 goBack();tripId 从 route.params 拿。
export function TripDetailScreen() {
  const t = useTheme();
  const trips = useTrips();
  const route = useRoute<any>();
  const tripId: string = route.params?.tripId;
  const tr = trips.find((x) => x.id === tripId) ?? trips[0];

  const stats: [string, string][] = [
    ['时长', `${tr.dur} 分钟`],
    ['里程', `${tr.dist} km`],
    ['最高水温', `${tr.maxCoolant} °C`],
    ['平均转速', `${tr.avgRpm} rpm`],
    ['冷启动', tr.cold ? '是' : '否'],
    ['采样点', tr.samples.toLocaleString()],
  ];

  const s = {
    belowSub: { color: t.label2, fontSize: 14, paddingHorizontal: 16, paddingBottom: 4 },
    heroRow: { flexDirection: 'row' as const, gap: 14, alignItems: 'flex-start' as const },
    heroTitle: { color: t.label, fontSize: 20, fontWeight: '700' as const },
    heroSummary: { color: t.label2, fontSize: 15, lineHeight: 22, marginTop: 6 },
    sectionLabel: { color: t.label2, fontSize: 13, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
    grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const },
    cell: {
      width: '50%' as unknown as number,
      paddingHorizontal: 16, paddingVertical: 13,
    },
    cellLabel: { color: t.label2, fontSize: 13 },
    cellValue: {
      color: t.label, fontSize: 20, fontWeight: '600' as const,
      fontVariant: ['tabular-nums' as const], marginTop: 3,
    },
    findingRow: { flexDirection: 'row' as const, gap: 12, alignItems: 'flex-start' as const },
    findingTitle: { color: t.label, fontSize: 16, fontWeight: '600' as const },
    findingDetail: { color: t.label2, fontSize: 14.5, lineHeight: 22, marginTop: 4 },
    actionBox: {
      flexDirection: 'row' as const, gap: 7, marginTop: 10,
      backgroundColor: t.fill, borderRadius: 10, padding: 9,
    },
    actionLabel: { color: t.orange, fontWeight: '700' as const },
    actionText: { color: t.label, fontSize: 14, lineHeight: 20 },
    disclaimer: { color: t.label3, fontSize: 12.5, lineHeight: 18, paddingHorizontal: 20, paddingBottom: 8, textAlign: 'center' as const },
  };

  return (
    <Screen
      title="行程报告"
      backLabel="行程历史"
      // react-navigation native-stack 自带默认 back,这里用 Screen 的 onBack 自定义文案
      // 不设 onBack —— native-stack 的 headerShown:false 时用 NavigationContainer 默认行为
      below={<Text style={s.belowSub}>{tr.group} {tr.time} · {tr.route}</Text>}
    >
      <Card style={s.heroRow}>
        <ToneIcon tone={tr.verdict} size={30} />
        <View style={{ flex: 1 }}>
          <Text style={s.heroTitle}>
            {tr.verdict === 'good' ? '本次行程发动机状态良好' : '整体良好,有 1 项需要留意'}
          </Text>
          <Text style={s.heroSummary}>{tr.summary}</Text>
        </View>
      </Card>

      <Text style={s.sectionLabel}>本次行程概要</Text>
      <Card pad={0}>
        <View style={s.grid}>
          {stats.map(([k, v], i) => (
            <View
              key={k}
              style={[
                s.cell,
                i < 4 ? { borderBottomWidth: 0.5, borderBottomColor: t.sep } : null,
                i % 2 === 0 ? { borderRightWidth: 0.5, borderRightColor: t.sep } : null,
              ]}
            >
              <Text style={s.cellLabel}>{k}</Text>
              <Text style={s.cellValue}>{v}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Text style={s.sectionLabel}>AI 分析</Text>
      {tr.findings.map((f, i) => (
        <Card key={i} style={s.findingRow}>
          <ToneIcon tone={f.tone} size={24} />
          <View style={{ flex: 1 }}>
            <Text style={s.findingTitle}>{f.title}</Text>
            <Text style={s.findingDetail}>{f.detail}</Text>
            {f.action ? (
              <View style={s.actionBox}>
                <Text style={s.actionLabel}>建议</Text>
                <Text style={s.actionText}>{f.action}</Text>
              </View>
            ) : null}
          </View>
        </Card>
      ))}

      <Group style={{ marginTop: 8 }}>
        <Row icon="share" iconBg={t.blue} title="分享报告" accessory={null} onClick={() => {}} />
        <Row
          icon="route"
          iconBg={t.label2}
          title="导出行程数据 (JSON)"
          accessory={null}
          last
          onClick={() => Alert.alert('sub-project C', '导出功能将在持久化层接入后实现')}
        />
      </Group>
      <Text style={s.disclaimer}>
        报告由 AI 依据本次行程数据生成,仅供参考。发动机检修请咨询专业技师。
      </Text>
    </Screen>
  );
}
```

> **TripDetail 的 back**:native-stack 默认 headerShown:false 时无 back 按钮。Screen 组件传 `onBack` 才显示 back nav。implementer 应在 RootNavigator 给 TripDetail screen 配 `options={{ headerShown: false }}`(默认),并让 TripDetailScreen 用 `useNavigation().goBack()` 触发回退——**Screen 的 onBack prop 在这里设为 `() => useNavigation().goBack()`**。修正版见下面 Step 6。

- [ ] **Step 6: 修正 TripDetailScreen — 把 onBack 接上**

替换 Step 5 文件中 `<Screen ...>` 部分:

```typescript
import { useNavigation, useRoute } from '@react-navigation/native';
// ... (其余 import 不变)

export function TripDetailScreen() {
  // ... (其余不变)
  const navigation = useNavigation();
  const onBack = () => navigation.goBack();

  return (
    <Screen
      title="行程报告"
      backLabel="行程历史"
      onBack={onBack}
      below={<Text style={s.belowSub}>{tr.group} {tr.time} · {tr.route}</Text>}
    >
      {/* ... 内容同 Step 5 */}
    </Screen>
  );
}
```

implementer 写文件时直接用这个版本。

- [ ] **Step 7: src/screens/TrendsScreen.tsx**

```typescript
import { useState } from 'react';
import { Text } from 'react-native';
import { Screen } from '../components/Screen';
import { Segmented } from '../components/Segmented';
import { TrendCard } from './components/TrendCard';
import { useTheme } from '../context/Theme';
import { useTrends } from '../hooks/useTrends';
import { useTrips } from '../hooks/useTrips';

// Trends — 趋势。对照 prototype/screensB.jsx TrendsScreen。
export function TrendsScreen() {
  const t = useTheme();
  const [range, setRange] = useState(1);
  const trends = useTrends();
  const trips = useTrips();

  return (
    <Screen
      title="趋势"
      below={<Segmented options={['近 30 天', '近 3 个月', '近 1 年']} value={range} onChange={setRange} />}
    >
      <Text style={{ color: t.label2, fontSize: 14, paddingHorizontal: 16, paddingBottom: 10, lineHeight: 20 }}>
        把每一次行程累积起来,观察这台发动机随时间的变化。
      </Text>
      <TrendCard tr={trends.ltft} />
      <TrendCard tr={trends.warmup} />
      <TrendCard tr={trends.idle} />
      <TrendCard tr={trends.cold} />
      <Text style={{ color: t.label3, fontSize: 12.5, textAlign: 'center', paddingHorizontal: 40, paddingBottom: 8, lineHeight: 18 }}>
        共记录 {trips.length}+ 次行程。趋势基于历史行程的统计,个别行程的波动属于正常。
      </Text>
    </Screen>
  );
}
```

- [ ] **Step 8: src/screens/HealthScreen.tsx**

```typescript
import { View, Text } from 'react-native';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { Ring } from '../components/Ring';
import { Badge } from '../components/Badge';
import { ToneIcon } from '../components/ToneIcon';
import { AskButton } from '../components/AskButton';
import { Icon } from '../components/Icon';
import { useTheme } from '../context/Theme';
import { useOutlook } from '../hooks/useOutlook';
import type { Finding } from '../data/mock';

// Health — 健康展望。对照 prototype/screensB.jsx HealthScreen。
export function HealthScreen() {
  const t = useTheme();
  const O = useOutlook();
  const scoreCol = O.score >= 80 ? t.green : (O.score >= 60 ? t.amber : t.red);

  const Section = ({ title, items }: { title: string; items: Finding[] }) => (
    <>
      <Text style={{ color: t.label2, fontSize: 13, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 }}>{title}</Text>
      {items.map((it, i) => (
        <Card key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <ToneIcon tone={it.tone} size={24} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.label, fontSize: 16, fontWeight: '600' }}>{it.title}</Text>
            <Text style={{ color: t.label2, fontSize: 14.5, lineHeight: 22, marginTop: 4 }}>{it.detail}</Text>
            {it.action ? (
              <View style={{ flexDirection: 'row', gap: 7, marginTop: 10, backgroundColor: t.fill, borderRadius: 10, padding: 9 }}>
                <Text style={{ color: t.orange, fontWeight: '700' }}>建议</Text>
                <Text style={{ color: t.label, fontSize: 14, lineHeight: 20 }}>{it.action}</Text>
              </View>
            ) : null}
          </View>
        </Card>
      ))}
    </>
  );

  return (
    <Screen title="健康展望" right={<AskButton />}>
      <Card style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
        <Ring value={O.score} color={scoreCol} size={104} stroke={10}>
          <Text style={{ color: t.label, fontSize: 30, fontWeight: '700', fontVariant: ['tabular-nums'], lineHeight: 30 }}>{O.score}</Text>
          <Text style={{ color: t.label2, fontSize: 11, marginTop: 2 }}>健康分</Text>
        </Ring>
        <View style={{ flex: 1 }}>
          <Badge tone={O.verdictTone}>{O.verdictLabel}</Badge>
          <Text style={{ color: t.label, fontSize: 15.5, lineHeight: 23, marginTop: 8 }}>{O.headline}</Text>
        </View>
      </Card>
      <Section title="当前需要关注" items={O.current} />
      <Section title="未来可能出现的问题" items={O.future} />
      <Text style={{ color: t.label2, fontSize: 13, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 }}>目前一切正常</Text>
      <Card pad={0}>
        {O.normal.map((n, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              paddingHorizontal: 16, paddingVertical: 12,
              borderBottomWidth: i < O.normal.length - 1 ? 0.5 : 0,
              borderBottomColor: t.sep,
            }}
          >
            <Icon name="checkcircle" size={20} color={t.green} />
            <Text style={{ color: t.label, fontSize: 15 }}>{n}</Text>
          </View>
        ))}
      </Card>
      <Text style={{ color: t.label3, fontSize: 12.5, lineHeight: 18, paddingHorizontal: 20, paddingBottom: 8, textAlign: 'center' }}>
        展望由 AI 依据长期趋势推测,仅供参考,不构成维修结论。
      </Text>
    </Screen>
  );
}
```

- [ ] **Step 9: src/screens/SettingsScreen.tsx**

```typescript
import { useState } from 'react';
import { __DEV__ } from 'react-native';
import { Screen } from '../components/Screen';
import { Group } from '../components/Group';
import { Row } from '../components/Row';
import { Toggle } from '../components/Toggle';
import { useTheme } from '../context/Theme';
import { useVehicle } from '../hooks/useVehicle';
import { useHomeMode } from '../hooks/useHomeMode';

// Settings — 设置。对照 prototype/screensB.jsx SettingsScreen。
export function SettingsScreen() {
  const t = useTheme();
  const D = useVehicle();
  const { mode: homeMode, toggle: toggleHomeMode } = useHomeMode();
  const [autoConn, setAuto] = useState(true);
  const [chime, setChime] = useState(true);
  const [nConn, setNConn] = useState(true);
  const [nDis, setNDis] = useState(true);
  const [nRep, setNRep] = useState(true);

  return (
    <Screen title="设置">
      <Group header="设备">
        <Row icon="bluetooth" iconBg={t.blue} title={D.adapter} sub="已配对 · 蓝牙" value="已连接" valueColor={t.green} accessory="chevron" onClick={() => {}} />
        <Row icon="car" iconBg={t.orange} title="自动连接" sub="上车后自动连接并记录" right={<Toggle on={autoConn} onChange={setAuto} />} last />
      </Group>
      <Group header="通知与提示音" footer="连接与断开时推送通知并响铃,无需一直查看 App。">
        <Row icon="sound" iconBg={t.orange} title="连接提示音" right={<Toggle on={chime} onChange={setChime} />} />
        <Row icon="bell" iconBg={t.green} title="连接成功推送" right={<Toggle on={nConn} onChange={setNConn} />} />
        <Row icon="bell" iconBg={t.amber} title="连接中断推送" right={<Toggle on={nDis} onChange={setNDis} />} />
        <Row icon="bell" iconBg={t.blue} title="行程报告就绪推送" right={<Toggle on={nRep} onChange={setNRep} />} last />
      </Group>
      <Group header="车辆">
        <Row title="车型" value={`${D.name} · ${D.model.split(' · ')[1]}`} accessory={null} />
        <Row title="发动机" value={D.engine} accessory={null} />
        <Row title="车牌" value={D.plate} accessory={null} />
        <Row title="总里程" value={`${D.odo.toLocaleString()} km`} accessory={null} last />
      </Group>
      <Group header="AI 分析">
        <Row title="MiniMax API Key" value="已设置 ••••" accessory="chevron" onClick={() => {}} />
        <Row title="报告语言" value="简体中文" accessory="chevron" onClick={() => {}} last />
      </Group>
      <Group header="数据">
        <Row title="导出全部行程数据" valueColor={t.blue} accessory="chevron" onClick={() => {}} />
        <Row title="清除本地数据" valueColor={t.red} accessory={null} onClick={() => {}} last />
      </Group>
      {__DEV__ ? (
        <Group header="开发选项(DEV)" footer="A 阶段:切换 Home 的 idle/driving 模式。B 接入真 BLE 后此 toggle 移除。">
          <Row
            icon="gauge"
            iconBg={t.label2}
            title="Home 模式"
            sub={homeMode === 'driving' ? '行驶中' : '未连接'}
            right={<Toggle on={homeMode === 'driving'} onChange={toggleHomeMode} />}
            last
          />
        </Group>
      ) : null}
      <Group footer="OBD 健康记录 · 个人工具,数据仅存本机。">
        <Row title="版本" value="1.0.0 (V1)" accessory={null} last />
      </Group>
    </Screen>
  );
}
```

> **`__DEV__`**:RN 全局常量,dev 模式为 true,production build 为 false。Settings 底部的 dev toggle 只在 dev 时显示。

- [ ] **Step 10: src/screens/ChatPlaceholderScreen.tsx**

```typescript
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '../components/Icon';
import { useTheme } from '../context/Theme';

// Chat placeholder — sub-project D 接入真 AI chat。
export function ChatPlaceholderScreen() {
  const t = useTheme();
  const navigation = useNavigation();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', height: 46,
          paddingHorizontal: 6,
          backgroundColor: t.barBg,
          borderBottomWidth: 0.5, borderBottomColor: t.barBorder,
        }}
      >
        <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center' }, pressed && { opacity: 0.5 }]}>
          <Icon name="back" size={22} color={t.orange} />
          <Text style={{ color: t.orange, fontSize: 17 }}>返回</Text>
        </Pressable>
        <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }}>
          <Text style={{ color: t.label, fontSize: 16, fontWeight: '600' }}>问车况</Text>
          <Text style={{ color: t.label2, fontSize: 11 }}>基于你的行驶数据</Text>
        </View>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
        <Icon name="sparkles" size={48} color={t.label3} />
        <Text style={{ color: t.label2, fontSize: 15, textAlign: 'center', marginTop: 16, lineHeight: 22 }}>
          问车况将在 sub-project D 接入{'\n'}基于真实行程数据的 AI 对话。
        </Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 11: 跑门禁**

Run: `npx tsc --noEmit`
预期:无错误(此时 RootNavigator 也 import 这些,合 Task 11 一起 commit)。

- [ ] **Step 12: Commit(与 Task 11 合并)**

见 Task 11 Step 3 的合并 commit。

---

## Task 13: App.tsx 切换 + 协议 issue

**Files:**
- Modify: `App.tsx`(从临时占位换成 RootNavigator)
- (commit message 引用 Protocol gap issue)

**Interfaces:** 无

- [ ] **Step 1: App.tsx 切到 RootNavigator**

替换 `App.tsx` 全文:

```typescript
import { RootNavigator } from './src/navigation/RootNavigator';

// 消费者版 App(sub-project A)。
// 原 V0 调试 UI 备份在 App.debug.tsx(BLE 开发期看日志用)。
// V0 → 消费者版方向见 Protocol gap issue。
export default function App() {
  return <RootNavigator />;
}
```

- [ ] **Step 2: 开 Protocol gap issue**

Run:
```bash
gh issue create \
  --title "Protocol gap:V0 验证已完成 → 消费者版方向(README 重写)" \
  --body "## 背景

设计 handoff(\`~/Downloads/design_handoff_obd_consumer_app/\`)定义了消费者版 App(5 tab + AI chat + lock-screen),sub-project A 已开始实现(\`docs/superpowers/specs/2026-07-19-sub-project-A-design-system-design.md\`)。

## 协议缺口

README.md 当前是 V0 验证版定位(\`Out of scope: trip storage, LLM, background\`),消费者版方向与之冲突。

按 AGENTS.md 协议变更分级:README 在 L1 邻近,需要:
1. 对应 Protocol gap issue(本 issue)
2. ADR 记录「V0 → 消费者版方向」决策与理由
3. 分支 PR,改 README + 写 ADR

## 待 stanyan 拍板

- README 重写方向:V0 → 消费者版是「V0 作废」还是「V0 = 已完成验证里程碑,V1 = 消费者版」?
- README 的 Roadmap 是否相应调整?
- CONTEXT.md 是否需要新增消费者版相关术语(如「行程 / 趋势 / outlook / 健康分」)?

stanyan 决定后,本 issue 转 Task,写 ADR + PR。

## 当前进展

sub-project A(设计系统层)实现中;A 不动 README,代码先行。"
```

记下返回的 issue 编号(后续 commit message 引用)。

- [ ] **Step 3: 跑门禁**

Run: `npx tsc --noEmit`
预期:无错误。

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat(A): App.tsx 切到 RootNavigator

原 V0 调试 UI 备份在 App.debug.tsx(Task 1)。消费者版方向协议缺口
见 Protocol gap issue(README L1 邻近,待 stanyan 拍板)。"
```

---

## Task 14: 真机验证清单 + 收工

**Files:** 无(验证 + push + 收工)

- [ ] **Step 1: 在 main 之外开 sub-project A 的分支**

如果还没开分支(前面 task 一直 commit 在 main 上的话),implementer 应该在 Task 1 之前就开分支。如果忘了,补救:从 main 当前位置开新分支,push,后续 PR。

```bash
git checkout -b feat/sub-project-A-design-system
git push -u origin feat/sub-project-A-design-system
```

> **AGENTS.md「非 trivial 改动走分支 + PR」**:sub-project A 是 Large 改动,应该全程在分支上做。如果 implementer 已经 commit 在 main 上,补救措施是把这些 commit cherry-pick 到新分支。**这个 plan 默认 implementer 在 Task 1 之前先开分支**。

- [ ] **Step 2: 跑完整门禁**

Run: `npx tsc --noEmit`
预期:无错误。

- [ ] **Step 3: 真机验证(implementer 跑不通就让 stanyan 验)**

Run: `npx expo run:ios --device`

清单(implementer 走一遍,有问题 debug;stanyan 在 PR review 时复验):
1. App 启动不崩,显示 Home tab(实时)
2. 5 tab 能切换,tab bar active tint = orange,有玻璃质感
3. 系统切深色 → app 自动跟随(useColorScheme)
4. Home tile 数字 900ms 滚动
5. History 行点击 → TripDetailScreen push,back 返回
6. Trends Segmented 切换 + 4 个 LineChart 渲染
7. Health Ring 显示 82 分,绿色
8. Settings Toggle 切换 local state,底部 __DEV__ toggle 切 Home 模式
9. Home/Health "问一问" pill → ChatPlaceholderScreen(modal),back 返回

**真机不验的**(不在 A 范围):BLE 连接、AI 回答、通知、deep-link、提示音。

- [ ] **Step 4: 开 sub-project A 的 Task issue + PR**

Run:
```bash
gh issue create \
  --title "Task:sub-project A — 设计系统层实现" \
  --body "实现 spec(\`docs/superpowers/specs/2026-07-19-sub-project-A-design-system-design.md\`)的 A 阶段。

Plan: \`docs/superpowers/plans/2026-07-19-sub-project-A-design-system.md\`

验收:
- tsc 绿
- 真机点动清单(plan §Task 14 Step 3)全过

合并时关本 issue。"

# 记下 issue 编号 ISS
gh pr create \
  --base main \
  --head feat/sub-project-A-design-system \
  --title "feat(A):sub-project A 设计系统层" \
  --body "Closes #ISS

实现 plan: \`docs/superpowers/plans/2026-07-19-sub-project-A-design-system.md\`
设计 spec: \`docs/superpowers/specs/2026-07-19-sub-project-A-design-system-design.md\`

## 范围
- tokens + Theme + 9 primitives + TabBar + Screen
- RootNavigator(5 tab + TripDetail push + Chat modal)
- 5 个数据 hook(useVehicle/useLivePids/useTrips/useTrends/useOutlook)
- mock.ts 数据
- 7 个 screen(含 ChatPlaceholder)
- App.tsx 切 RootNavigator,原调试 UI 备份到 App.debug.tsx
- app.json userInterfaceStyle: dark → automatic

## 不在范围(后续 sub-project)
- B:实时 tab 从 mock 切真 BLE PID stream
- C:持久化(SQLite trip 记录 + trends 聚合)
- D:AI 三屏真模型
- E:lock-screen 通知 + chime + deep-link

## 真机验证清单
见 plan §Task 14 Step 3。BLE/AI/通知/deep-link 不在 A 验证范围。

## 协议
- 不动 README/CONTEXT/ADR
- Protocol gap issue(README V0 → 消费者版方向)另行开,L1 邻近,待 stanyan 拍板

## merge 方式
merge commit(AGENTS.md ADR-0007)。"
```

- [ ] **Step 5: 等 CI 绿**

`.github/workflows/ci.yml` 跑 `npx tsc --noEmit`,必须绿。

- [ ] **Step 6: merge(implementer agent 自行 merge)**

按 AGENTS.md ADR-0007:CI 绿后作者 agent 自行 merge(merge commit,不 squash)。

- [ ] **Step 7: 收工**

按 AGENTS.md「On ending a shift」:
- 门禁绿 ✅
- push ✅(merge 后 origin 已更新)
- Task issue 关闭 ✅(merge 时 PR closes)
- **开下一棒交接 issue**(保持 open):

```bash
gh issue create \
  --title "Task:sub-project B — 实时 tab 接真 BLE PID stream" \
  --body "## 现状

sub-project A 已合入 main(commit 见 git log)。5 tab + 设计系统 + mock 数据 + Chat placeholder 全跑通。

## 下一棒要做的

B = 实时 tab 从 mock 切到真 BLE PID stream:
- Home tile 数据从 \`useLivePids()\` 改为读取 \`BleTransport + ElmSession\` 的 live PID stream
- 连接状态 idle/driving 由 BLE 真实状态决定(useHomeMode 改成 BLE 派生值)
- 保留 \`useLivePids()\` 接口契约,实现换底层
- App.debug.tsx 的 BLE 连接逻辑(scan/connect/init/poll)可作参考

## 真机验证

B 必须 BLE 真机验证(AGENTS.md Hard rule)。

## 协议

Protocol gap issue(README V0 → 消费者版方向)等 stanyan 拍板,与 B 并行。"
```

- [ ] **Step 8: 留 Memory comment(五项格式,ADR-0004)**

在交接 issue 上 comment:

```
## 本棒做到哪
sub-project A(spec → plan → 实现 → merge)全跑通。5 tab + 设计系统 + mock 数据 + Chat placeholder 已合入 main。

## 卡在哪
无技术阻塞。

## 下一步
B(实时 tab 接真 BLE)。开 brainstorm → spec → plan → 实现。

## 任务完成则关 issue
A 的 Task issue 已通过 PR merge 关闭。本 issue 是下一棒交接(Task:sub-project B)。

## 判断依据 / 权衡
- 5 个 sub-project 拆分依据:全套消费者 App 是 5 个独立子系统(brainstorming skill 范围过大时拆解原则)
- A 阶段默认 driving mode(展示有数据样子):dev toggle 在 Settings 可切;若 stanyan 觉得应该默认 idle,在 PR comment 反馈
- App.debug.tsx 保留 V0 调试 UI:BLE 开发期还要看日志,不删;若 stanyan 觉得碍眼可后续删
- 默认主题跟随系统(useColorScheme),override 接口留好但不暴露(A 阶段):给 E 的 Settings 主题切换用
```

---

## Self-Review Checklist(implementer 完成后跑一遍)

- [ ] **spec 覆盖**:对照 spec §1-13,每个章节都有对应 task 实现
  - §2 技术栈 → Task 1
  - §3 目录结构 → Task 1-11(所有文件)
  - §4 token + Theme → Task 2-3
  - §5 Icon → Task 4
  - §6 primitives → Task 5-7
  - §7 导航 + TabBar + Screen → Task 10-11
  - §8 mock + hook → Task 8-9
  - §9 5 screen → Task 11(含 7 个 screen + 2 个 screen 专用子组件)
  - §10 App.tsx → Task 13
  - §11 验证 → Task 14
- [ ] **placeholder 扫描**:无 TBD / TODO / "类似 Task N"
- [ ] **类型一致性**:`useVehicle/useLivePids/useTrips/useTrends/useOutlook`、`IconName`、`Verdict`、`Tone`、`Finding`、`Trip`、`Trend`、`Outlook` 在所有 task 中一致
- [ ] **AGENTS.md 合规**:
  - 每步小 commit ✅
  - 非 trivial 走分支 + PR ✅(Task 14 Step 1)
  - merge commit,不 squash ✅(Task 14 Step 6)
  - 不动 README/CONTEXT/ADR(协议另开 issue)✅(Task 13 Step 2)
  - Gate 绿 ✅(每个 task + Task 14 Step 2)

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-19-sub-project-A-design-system.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — 我每个 task 派一个 fresh subagent,task 之间我做 review,快速迭代。适合 14 个 task 这种规模。

**2. Inline Execution** — 在本会话里逐 task 执行,checkpoint 处给你 review。适合你想紧跟每一步的情况。

**Which approach?**
