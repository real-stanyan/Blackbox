// CarPlay 单屏仪表。10 秒节流是 Apple driving-task 硬规则(CarPlay Developer
// Guide 2026-06:「Do not periodically refresh data items … more than once every
// 10 seconds」)— 不许调快。模板只能在 didConnect 内构造/挂载(库无排队机制)。
import { HybridAutoPlay, InformationTemplate } from '@iternio/react-native-auto-play';
import { buildCarPlayItems } from './carPlayItems';

const REFRESH_MS = 10_000;

export function registerCarPlay(): void {
  let template: InformationTemplate | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  HybridAutoPlay.addListener('didConnect', () => {
    if (timer) clearInterval(timer);
    template = new InformationTemplate({ title: { text: 'Blackbox' }, items: buildCarPlayItems() });
    template.setRootTemplate();
    timer = setInterval(() => {
      template?.updateItems(buildCarPlayItems()).catch(() => {});
    }, REFRESH_MS);
  });

  HybridAutoPlay.addListener('didDisconnect', () => {
    if (timer) clearInterval(timer);
    timer = null;
    template = null;
  });
}
