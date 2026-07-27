# patches/

给 `node_modules` 打的补丁。**目前是手动应用的**，还没接 patch-package。

## 为什么会有这个目录

CarPlay 的卡片布局（`CPListImageRowItem` + `CPListImageRowItemCardElement`，iOS 26）
需要原生代码，而 `@iternio/react-native-auto-play@0.5.11` **完全没暴露这套 API**。

不能绕开库自己写原生模块：`CPInterfaceController` 握在库自己的
`HeadUnitSceneDelegate` 手里（`ios/scenes/SceneStore.swift`），外部模块拿不到。

所以补丁改的就是库本身。pod 是 `:path:` 指向 `node_modules`，改了直接进编译。

## `@iternio+react-native-auto-play+0.5.11.patch`

两处改动：

1. **新增 `ios/BlackboxProbe.swift`** —— 把 `section.title === '__CARDS__'` 的
   section 转成一行卡片（`CPListImageRowItemCardElement`），并追加一张诊断卡，
   把三个尺寸上限（card / grid / list）和车机屏倍率写进卡片的 title/subtitle。
2. **`ios/templates/ListTemplate.swift`** —— 在 `_invalidate()` 里插入调用。

JS 侧的对应入口是 `src/carplay/gridBridge.ts` 的 `CARD_SECTION_MARKER`。

## 怎么应用

```bash
git apply patches/@iternio+react-native-auto-play+0.5.11.patch
```

改完必须 **重跑 `pod install`**：CocoaPods 在 install 时把源文件列表定死，
新增的 `.swift` 不重跑就不会被编译（症状是 `cannot find 'BlackboxProbe' in scope`）。

```bash
cd ios && LANG=en_US.UTF-8 pod install
```

`LANG` 不能省 —— 非交互 shell 里 CocoaPods 会崩在 `unicode_normalize`
（`Unicode Normalization not appropriate for ASCII-8BIT`）。

## 状态：可行性已验证，尚未正式化

2026-07-27 在 CarPlay Simulator（iOS 26.5, 720×480）上确认：
**Driving Task entitlement 下卡片能正常渲染。** 这套 API 历史上是给音频类 app 的，
此前无人验证过 —— 这是本补丁存在的全部理由。

诊断卡是一次性的，正式化时删掉。

正式化的两条路（未决）：

- 接 `patch-package` + `postinstall`，让 `npm install` 自动恢复 —— 但要新增
  devDependency，按 AGENTS.md 属 Tech stack 改动（L1，需 stanyan 同意）
- 给上游提 PR，把卡片支持并进库本体 —— 更干净，但要等上游
