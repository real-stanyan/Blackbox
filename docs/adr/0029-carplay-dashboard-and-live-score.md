# 0029 — CarPlay 仪表盘 + 5 分钟滚动 LLM 评分

日期:2026-07-24 · 状态:已接受(L1,stanyan 会话内同意)

## 背景

Sub-project D(spec:docs/superpowers/specs/2026-07-24-sub-project-D-carplay-live-score-design.md):
CarPlay 显示发动机评分与慢变量;行程期间每 5 分钟调 MiniMax M3 产出
{score 0-100, problem 5-20 英文词}。

## 决策

1. **库:@iternio/react-native-auto-play**。birkir 上游与 g4rb4g3 fork 均已归档
   (2026-02),本库是同一批维护者的官方后继(新架构 only,Nitro Modules,自带
   scene delegate)。备选「手写 Swift native module」在后继库死掉时启用。
2. **盲写**。Apple CarPlay Developer Guide(2026-06):模拟器也要 entitlement
   provisioning——批前无法运行任何 CarPlay 界面。验收降级为 tsc + 手机 build
   可启动;渲染验证挂起等 entitlement。前提失效(申请被拒)→ 转手机横屏仪表盘。
3. **10 秒刷新节流**。driving-task 类硬规则:「Do not periodically refresh data
   items in the CarPlay UI more than once every 10 seconds (for example, no
   real-time engine data)」。因此 CarPlay 不显示转速/车速(10 秒粒度无意义),
   显示分数/水温/LTFT/行程。
4. **跳过上游全部 patch-package 补丁**。react-native+0.83.5.patch 钉 0.83.5,对
   RN 0.86 不可应用(连带不需要 buildReactNativeFromSource);后果:锁屏且无
   CarPlay 时 JS 定时器可能暂停,5 分钟评分会顺延——BLE 事件实际维持调度,影响
   有限,RN 版本更近时重评。expo-splash-screen 场景补丁:本项目根本未安装
   expo-splash-screen(非直接依赖、非传递依赖),卡启动屏问题无从发生,补丁与
   patch-package 一并不引入;若日后引入该模块需重新评估。
5. **评分引擎独立于行程终局分析**(analyzeTrip 不动):独立 prompt、独立校验
   (clamp + 词数)、结果进 liveScoreStore,行程终结整线并入 TripRecord.scoreTimeline。

## 后果

- 新依赖 2 个(auto-play/nitro)+ 本地 config plugin,Tech stack L1 更新。
- app 变 UIScene 应用:手机侧启动路径经库的
  WindowApplicationSceneDelegate——手机 build 启动验证是本轮必做项。
- RN 0.86 × 库组合无人验证:任何 CarPlay 崩溃先查 nitro/scene 兼容性再查业务码。
