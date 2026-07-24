// 库 + RN 0.86 组合未经验证(ADR-0029)。动态 import:原生模块缺失/初始化炸掉时
// 降级为无 CarPlay,不拖垮手机 app。
export function tryRegisterCarPlay(): void {
  import('./registerCarPlay')
    .then((m) => m.registerCarPlay())
    .catch((e) => console.log(`[carplay] 初始化失败,降级无 CarPlay: ${e}`));
}
