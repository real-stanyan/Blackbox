# Sub-project A — Design System Layer (设计系统层)

**Status:** Approved design (pending spec review)
**Date:** 2026-07-19
**Parent initiative:** Blackbox 消费者版 App（来自 `~/Downloads/design_handoff_obd_consumer_app/`）
**Position in roadmap:** Sub-project A of 5（A 设计系统 → B 实时 → C 持久化 → D AI → E 系统集成）

## 1. Context & Scope

### 1.1 Why this exists

设计 handoff（`~/Downloads/design_handoff_obd_consumer_app/`）定义了一个完整的消费者 App：5 tab（实时 / 历史 / 趋势 / 健康 / 设置）+ 全屏 AI chat（问车况）+ lock-screen 通知，Apple/iOS 设计语言，深浅色。当前 repo 是 V0 验证版（BLE/OBD/分析逻辑完整，UI 是 GitHub-dark 调试版），消费者版将取代 V0 的定位。

全套消费者 App 是 **5 个独立子系统**，brainstorming 阶段决定拆为 5 个 sub-project 顺序做。**A 是设计系统层**，其它 4 个都依赖它。

### 1.2 In scope（A 做什么）

- 把 `prototype/kit.jsx` 的 tokens / Icon / 全部 primitives（`Group` / `Row` / `Card` / `Badge` / `Segmented` / `Toggle` / `ToneIcon` / `LineChart` / `Ring`）复刻到 RN
- 把 `prototype/chrome.jsx` 的 tab bar + Screen scaffold 复刻到 RN（**不含** LockScreen / NotifCard — 留 E）
- 把 `prototype/screensA.jsx` / `screensB.jsx` 的 5 个 screen 复刻到 RN，数据从 `src/data/mock.ts` 读（对照 `prototype/data.js` 全量抽取）
- 把 `prototype/app.jsx` 的导航 + 主题 + Appearance 跟随复刻到 RN（**不含** debug rail — 那是原型展示用的）
- Home driving 状态的 live data 900ms 滚动（mock jitter）
- 把现有 `App.tsx`（调试 UI）备份到 `App.debug.tsx`，新 `App.tsx` 切到 navigator

### 1.3 Out of scope（后续 sub-project 做）

- **B 实时**:BLE 接入 — Home tab 从 mock 切到真 PID stream
- **C 持久化**:SQLite trip 记录 + trends 聚合
- **D AI**:单次报告真模型 / outlook 聚合 / chat 真模型（当前 chat 是 placeholder）
- **E 系统集成**:lock-screen 通知 / WebAudio→expo-av chime / deep-link / Settings 主题覆盖 toggle

### 1.4 协议流程

- **A 不动 README / CONTEXT / ADR** — A 的 PR 纯代码
- **另开 Protocol gap issue** 记录「V0 验证已完成 → 消费者版方向」（README 是 V0 定位，A 提交后方向变了，需要 stanyan 后续拍板调整 README，按 L1 走 issue + ADR + PR 流程）

## 2. Tech Stack Increment

现有依赖：Expo 57 / RN 0.86 / React 19.2 / TypeScript 6 / react-native-ble-plx。**A 新增**：

| 包 | 用途 |
|---|---|
| `@react-navigation/native` | 导航核心 |
| `@react-navigation/bottom-tabs` | 5 tab |
| `@react-navigation/native-stack` | TripDetail push + Chat modal |
| `react-native-screens` | react-navigation 依赖（Expo 自动 link） |
| `react-native-safe-area-context` | SafeAreaView（状态栏 / home indicator 安全区） |
| `react-native-svg` | 17 个 Icon + LineChart + Ring |
| `expo-blur` | tab bar 玻璃质感（chrome.jsx `backdrop-filter: blur(20px)` 的 RN 对应） |

**不加**（刻意延后）：expo-av / expo-haptics（E）、expo-notifications（E）、SQLite（C）、react-native-reanimated（原型用 Animated.API 够）。

**TypeScript 配置**：现有 tsconfig 不动（验证 JSX 配置已对，若实际报错再调）。

## 3. Directory Structure

按类型分层（classic RN）。底层 `src/ble/ src/obd/ src/analysis/` 不动。

```
App.tsx                     ← 新:RootNavigator(主题 + tab nav)
App.debug.tsx               ← 老 App.tsx 备份(BLE 调试 UI,保留给 BLE 开发期看日志)
src/
├── ble/ obd/ analysis/     ← 不动
├── styles/
│   └── tokens.ts           ← light/dark token 对象 + 类型 Token + FONT + VERDICT
├── context/
│   └── Theme.tsx           ← ThemeProvider + useTheme() + Appearance 跟随 + override 接口
├── components/             ← primitives + chrome
│   ├── Icon.tsx            ← 17 个图标(react-native-svg)
│   ├── Group.tsx
│   ├── Row.tsx
│   ├── Card.tsx
│   ├── Badge.tsx
│   ├── Segmented.tsx
│   ├── Toggle.tsx
│   ├── ToneIcon.tsx
│   ├── LineChart.tsx
│   ├── Ring.tsx
│   ├── TabBar.tsx          ← chrome.jsx 复刻(自定义 tab bar,orange active tint + BlurView)
│   └── Screen.tsx          ← Screen scaffold(SafeAreaView + ScrollView container)
├── screens/
│   ├── HomeScreen.tsx
│   ├── HistoryScreen.tsx
│   ├── TripDetailScreen.tsx
│   ├── TrendsScreen.tsx
│   ├── HealthScreen.tsx
│   ├── SettingsScreen.tsx
│   └── ChatPlaceholderScreen.tsx  ← "问车况将在 sub-project D 接入"（modal 入口）
├── navigation/
│   └── RootNavigator.tsx   ← BottomTabs(5 tab) + Stack(detail push) + Modal(chat)
├── hooks/
│   ├── useVehicle.ts
│   ├── useLivePids.ts
│   ├── useTrips.ts
│   ├── useTrends.ts
│   └── useOutlook.ts
└── data/
    └── mock.ts             ← 抽自 prototype/data.js,带 TS 类型
```

**文件粒度**：每个 primitive 一个文件、每个 screen 一个文件、每个 hook 一个文件（codebase-design deep-module 原则；后续 SDD 拆 task 易）。Icon 不拆 17 个 — 集中在一个 `Icon.tsx` + switch 返回（与原型一致，共享 stroke 默认）。

## 4. Design System 主题层

### 4.1 Tokens（对照 `kit.jsx` TOKENS，1:1 抄）

`src/styles/tokens.ts`：

```typescript
export type Mode = 'light' | 'dark';
export interface Token {
  mode: Mode;
  bg: string; bgPlain: string; card: string; elevated: string;
  fill: string; fillStrong: string;
  label: string; label2: string; label3: string;
  sep: string;
  blue: string; green: string; orange: string; red: string; amber: string;
  barBg: string; barBorder: string;
}
export const TOKENS: Record<Mode, Token> = { light: {...}, dark: {...} };  // 1:1 抄 kit.jsx
export const FONT = '-apple-system, "PingFang SC", system-ui';
export type Verdict = 'good' | 'watch' | 'inspect' | 'info';
export const VERDICT: Record<Verdict, [label: string, colorKey: 'green'|'amber'|'red'|'blue']> = {
  good:    ['良好',     'green'],
  watch:   ['留意',     'amber'],
  inspect: ['建议检查', 'red'],
  info:    ['提示',     'blue'],
};
```

token 字段表（对照 README.md 的 design tokens 表）：

| Token | Light | Dark |
|---|---|---|
| bg | `#F2F2F7` | `#000000` |
| card | `#FFFFFF` | `#1C1C1E` |
| elevated | `#FFFFFF` | `#2C2C2E` |
| fill | `rgba(120,120,128,0.12)` | `rgba(120,120,128,0.24)` |
| fillStrong | `rgba(120,120,128,0.20)` | `rgba(120,120,128,0.36)` |
| label | `#000000` | `#FFFFFF` |
| label2 | `rgba(60,60,67,0.60)` | `rgba(235,235,245,0.60)` |
| label3 | `rgba(60,60,67,0.30)` | `rgba(235,235,245,0.30)` |
| sep | `rgba(60,60,67,0.20)` | `rgba(84,84,88,0.60)` |
| blue | `#007AFF` | `#0A84FF` |
| green | `#34C759` | `#30D158` |
| **orange** (brand accent) | `#EA5B2A` | `#FF6A3D` |
| red | `#FF3B30` | `#FF453A` |
| amber | `#FF9500` | `#FF9F0A` |
| barBg | `rgba(249,249,249,0.80)` | `rgba(28,28,30,0.80)` |
| barBorder | `rgba(60,60,67,0.20)` | `rgba(84,84,88,0.55)` |

### 4.2 ThemeProvider（对照 `ThemeCtx`）

```typescript
// src/context/Theme.tsx
const ThemeContext = createContext<Token>(TOKENS.light);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [override, setOverride] = useState<Mode | null>(null);  // null = 跟随系统
  const mode: Mode = override ?? (system === 'dark' ? 'dark' : 'light');
  return (
    <ThemeContext.Provider value={TOKENS[mode]}>
      {children}
    </ThemeContext.Provider>
  );
}
export const useTheme = () => useContext(ThemeContext);
```

**A 阶段不暴露 override toggle**（留给 E），但接口留好。`StatusBar` 在 RootNavigator 里设 `<StatusBar style={mode === 'dark' ? 'light' : 'dark'} />`（用 expo-status-bar）。

### 4.3 主题传入组件的方式（已选方案 1）

每个组件用 `useTheme()` + 自带 `createXxxStyles(t)` 工厂：

```typescript
function Card({ children }: Props) {
  const t = useTheme();
  const styles = useMemo(() => createCardStyles(t), [t]);
  return <View style={styles.card}>{children}</View>;
}
```

跟原型 `useT()` 范式一致；token 变（切深浅色）→ 自动 re-render；类型安全。

## 5. Icon（对照 `kit.jsx` Icon）

`react-native-svg`。17 个图标：

- **Stroke 图标**（`<Svg><Path stroke={color} /></Svg>`）：gauge / clock / chart / heart / gear / chevron / back / bluetooth / check / bell / share / sound / route / car / sparkles / chatbubble
- **Fill 图标**（`<Path fill={color} />`）：checkcircle / warncircle / infocircle / send

接口与原型一致：`<Icon name="gauge" size={24} color="#fff" fill={false} stroke={2} />`。stroke 默认 2，strokeLinecap/Linejoin = round。

## 6. Primitives 详细映射

| 原型 | RN 实现 | 关键差异 |
|---|---|---|
| `Group({header,footer,children})` | `<View>` + header Text + 圆角 12 inner View + footer Text | margin → style |
| `Row({icon,iconBg,title,sub,value,accessory,...})` | `<Pressable>` + 圆角 icon wrap + title/sub + value + chevron | pressed 用 Pressable `({pressed}) =>` |
| `Card({children,onClick})` | `<Pressable>` 或 `<View>`（onClick 决定） | — |
| `Badge({tone,children})` | `<View row>` + dot + Text | dot 圆角 View |
| `Segmented({options,value,onChange})` | `<View row>` + Pressable × n | iOS 风格 |
| `Toggle({on,onChange})` | `<Pressable>` 51×31 + 滑块 27×27 | **Animated.timing** 150ms ease（对应原型 CSS transition .2s） |
| `ToneIcon({tone})` | 转发到 `<Icon>`，按 tone 选 name+color | — |
| `LineChart({series,months,color})` | react-native-svg `<Svg>` + polygon area + polyline + last-point circle + text labels | **固定宽高比** aspectRatio（替代 CSS width 100% height auto） |
| `Ring({value,color,size,stroke})` | react-native-svg + stroke-dasharray | **Animated.timing** 让 dashoffset 平滑变化 |

**fontVariant: ['tabular-nums']**：所有数字 tile / Ring 中央分 / LineChart 轴标签都加（避免数字滚动时宽度跳变）。

## 7. Navigation & Chrome

### 7.1 RootNavigator 结构

```typescript
RootStack (native-stack)
├── Tabs (screen, headerShown: false)
│   └── BottomTabs (custom TabBar)
│       ├── Home    → HomeScreen    (icon: gauge)
│       ├── History → HistoryScreen (icon: clock)
│       ├── Trends  → TrendsScreen  (icon: chart)
│       ├── Health  → HealthScreen  (icon: heart)
│       └── Settings→ SettingsScreen(icon: gear)
├── TripDetail (push) → TripDetailScreen
└── Chat (modal, presentation: 'modal', headerShown: false) → ChatPlaceholderScreen
```

Chat 在 A 是 placeholder — 一个空屏「问车况将在 sub-project D 接入」。

### 7.2 自定义 TabBar（对照 chrome.jsx）

react-navigation 的 `tabBar` prop 自定义。视觉：

- 5 个 icon + 中文 label（实时 / 历史 / 趋势 / 健康 / 设置）
- active tint = orange（`t.orange`），inactive = `t.label3`
- 背景：**expo-blur `BlurView`**（chrome.jsx `backdrop-filter: blur(20px)` 的 RN 对应）+ 上边 `t.barBorder` 0.5px 分隔线
- 紧贴底部 home indicator（用 `useSafeAreaInsets()` 处理 bottom padding）

### 7.3 Screen scaffold

`Screen.tsx` — 包 SafeAreaView（top：状态栏；bottom：tab bar 上方）+ ScrollView 容器（home/history/trends/health/settings 内容都可滚动）+ 大标题样式。

## 8. Data Model & Mock

`src/data/mock.ts` 1:1 抽 `prototype/data.js`，带 TS 类型：

```typescript
export interface Vehicle {
  name: string; model: string; engine: string;
  plate: string; odo: number; adapter: string;
}
export interface LivePid {
  key: string; label: string; unit: string;
  idle: number | null; drive: number | null;
  jitter: number; note?: string;
}
export type Tone = 'good' | 'watch' | 'inspect' | 'info';
export interface Finding {
  tone: Tone; title: string; detail: string; action?: string;
}
export interface Trip {
  id: string; group: string; time: string; title: string;
  dur: number; dist: number; verdict: Tone;
  cold: boolean; maxCoolant: number; avgRpm: number;
  ltft: number; stft: number; samples: number;
  route: string; summary: string; findings: Finding[];
  featured?: boolean;
}
export interface Trend {
  label: string; unit: string; now: number;
  dir: 'up' | 'down' | 'flat'; tone: Tone; note: string;
  series: number[]; months: string[];
}
export interface Outlook {
  score: number; verdictLabel: string; verdictTone: Tone;
  headline: string;
  current: Finding[]; future: Finding[]; normal: string[];
}
```

5 个 hook（**A 阶段就拆**，契约提前固定，B/C/D 只改 hook 实现不改调用点）：

```typescript
// src/hooks/useVehicle.ts
export function useVehicle(): Vehicle { return MOCK.vehicle; }
// src/hooks/useLivePids.ts
export function useLivePids(): LivePid[] { return MOCK.livePids; }
// src/hooks/useTrips.ts
export function useTrips(): Trip[] { return MOCK.trips; }
// src/hooks/useTrends.ts
export function useTrends(): Record<'ltft'|'warmup'|'idle'|'cold', Trend> { return MOCK.trends; }
// src/hooks/useOutlook.ts
export function useOutlook(): Outlook { return MOCK.outlook; }
```

## 9. 5 Screen 的实现范围

每个 screen 用 mock + 新 primitives 复刻原型，**只做视觉，不接真实逻辑**。

| Screen | 来源 | 数据 | 状态 | 关键交互 |
|---|---|---|---|---|
| `HomeScreen` | screensA.jsx | `useLivePids()` + `useVehicle()` | **默认 driving**（idle 也实现，Settings 底部 `__DEV__` toggle 可切） | 头部"问一问" pill → 跳 Chat placeholder |
| `HistoryScreen` | screensA.jsx | `useTrips()` | group by 今天/昨天/本周/更早，verdict Badge | 行点击 → push TripDetail |
| `TripDetailScreen` | screensA.jsx | `useTrips()` 按 id 查 | verdict hero + 6-cell grid + findings + footer | "导出行程数据(JSON)" → 暂时 alert「sub-project C」 |
| `TrendsScreen` | screensB.jsx | `useTrends()` | Segmented + 4 TrendCard（每个 LineChart） | Segmented 切换仅 UI（数据不变） |
| `HealthScreen` | screensB.jsx | `useOutlook()` | Score Ring + current/future + normal list | 头部"问一问" pill → Chat placeholder |
| `SettingsScreen` | screensB.jsx | `useVehicle()` | grouped list + Toggle（仅 UI，state local） | toggle 仅切 state，不接通知/提示音 |
| `ChatPlaceholderScreen` | — | — | 空屏 + 「问车况将在 sub-project D 接入」 | 返回按钮 |

**Live data 滚动**：Home **driving 状态**用 `setInterval` + mock 数据 jitter 实现 900ms 滚动（与原型一致，验证设计的核心交互）。idle 状态不滚动，tile 显示 "—"（与原型 idle 一致）。卸载时 `clearInterval`。

**SettingsScreen 车辆分组**：原型车辆分组（车型/发动机/车牌/总里程）是 read-only 的 Row，无 toggle；A 沿用，不引入编辑能力。

## 10. App.tsx 切换

- **现有 `App.tsx` 内容 cp 到 `App.debug.tsx`**（cp 不是 git mv，保留 App.tsx 的 git 历史不被切断；App.debug.tsx 是新文件，文件头注释说明"原 V0 调试 UI 备份"）。保留所有 BLE/OBD/分析逻辑，BLE 开发期还要看日志
- **新 `App.tsx`** 内容 = `<RootNavigator />`（覆盖原文件，git 视为修改）
- `index.ts`（registerComponent 入口）不动，仍指向 `App`

## 11. Verification Strategy & Gate

### 11.1 Gate（CI 跑 + 收工前必须全绿）

```bash
npx tsc --noEmit
```

与 AGENTS.md 一致，A 必须绿。

### 11.2 真机验证清单（stanyan 跑，结果反馈到 PR/issue）

1. `npx expo run:ios --device` 能起，不崩
2. 5 tab 能切换，tab bar 视觉对（active tint = orange，玻璃质感）
3. 系统切深色 → app 自动跟随
4. Home tab driving 状态，tile 数字 900ms 滚动
5. History 行点击 → TripDetail push，back 返回
6. Trends Segmented 切换 + LineChart 渲染
7. Health Ring 显示 82 分，绿色
8. Settings Toggle 切换 state
9. Home/Health "问一问" pill → Chat placeholder

**真机不验的**（不在 A 范围）：BLE 连接、AI 回答、通知、deep-link。

### 11.3 stanyan 否决权

如果真机视觉与原型差距大，提 PR comment 或 revert + 重开 issue。

## 12. Open Questions / Defaults

无未决项。下列实现细节用合理默认，spec review 时若需改再改：

- **tsconfig**：不动；若 JSX 报错则加 `"jsx": "react-jsx"`
- **Toggle 动画**：`Animated.timing` 150ms ease
- **LineChart 宽高**：固定 aspectRatio 而非 onLayout 测量
- **Home `homeMode`**：默认 driving，Settings 底部 `__DEV__` 开关可切
- **SettingsScreen toggle**：纯 local state，不接通知/提示音逻辑
- **TripDetail "导出 JSON"**：alert 提示「sub-project C」

## 13. Hand-off & 后续

- **A 完成后 → 开 sub-project B 的 brainstorm**（实时 tab 从 mock 切到真 BLE PID stream）
- **同时打开 Protocol gap issue**（README V0 定位 → 消费者版方向）— stanyan 拍板后走 L1 流程更新 README
- A 的 PR 引用本 spec，merge 时关 A 的 Task issue（按 AGENTS.md）
