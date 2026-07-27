// @iternio/react-native-auto-play 的薄封装。
//
// 为什么不直接 import:库在模块顶层就调 NitroModules.createHybridObject(),原生模块
// 没链接时(prebuild 之前、或非 dev-client 的环境)一 import 就抛,会连带打挂整个 app。
// 所以走惰性 require + try/catch —— CarPlay 不可用时 app 照常跑,只是没有车机界面。
//
// ⚠️ 未经真机验证(AGENTS.md Hard rule)。
// import type 只在类型层引用,编译后完全消失 —— 既拿到库的真实类型让 tsc 校验
// API,又不会在运行时触发模块顶层的 createHybridObject。
import type {
  AutoImage,
  GridButton,
  GridTemplate as GridTemplateClass,
  HybridAutoPlay as HybridAutoPlayType,
  ListTemplate as ListTemplateClass,
} from '@iternio/react-native-auto-play';
import { scaleForTile } from './pngMeta';
import type { TileLayout } from './tileGeom';

/** 每格一份:系统渲染的 title + 已光栅化的 PNG(base64,失败为 null)。 */
export interface GridTile {
  title: string;
  png: string | null;
  /** 这张图设计时的 pt 边长。用来反算 image source 的 scale,见 pngMeta。 */
  sizePt: number;
}

interface AutoPlayLib {
  HybridAutoPlay: typeof HybridAutoPlayType;
  GridTemplate: typeof GridTemplateClass;
  ListTemplate: typeof ListTemplateClass;
}

let lib: AutoPlayLib | null = null;
let loadError: string | null = null;

function load(): AutoPlayLib | null {
  if (lib || loadError) return lib;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    lib = require('@iternio/react-native-auto-play') as AutoPlayLib;
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }
  return lib;
}

export const carPlayAvailable = () => load() !== null;
export const carPlayLoadError = () => loadError;

/**
 * base64 PNG → 库的 AutoImage。
 *
 * 三种形态里只有 asset 能收动态图:remote 只接 HTTPS(本地起不了 https),
 * glyph 是图标字体。asset 的 uri 最终进 RCTConvert 的 uiImage —— data: 应该支持,
 * 但没实测(见 TileSvgView 的风险清单)。
 */
const toAutoImage = (png: string, sizePt: number): AutoImage => ({
  type: 'asset',
  // scale 必须给。toDataURL 按屏幕倍率出图(176pt 的 Svg 在 3x 上是 528px),
  // 不带 scale 时 iOS 当它是 528pt 的图,再压到格子上限 ≈60-70pt —— 整张缩近 8 倍,
  // 字全糊(2026-07-27 CarPlay Simulator 实测)。从 PNG 头读真实像素宽反算,
  // 不依赖「toDataURL 用了几倍」这个我们问不到的信息。
  image: { uri: `data:image/png;base64,${png}`, scale: scaleForTile(png, sizePt) },
});

/** 已建立的根模板。null = 车没连 / 还没建。 */
let template: GridTemplateClass | null = null;

const buildButtons = (tiles: GridTile[]): Array<GridButton<GridTemplateClass>> =>
  tiles
    // 没图的格子直接丢:库的 parseButtons 对 image 为 nil 的按钮会 compactMap 掉,
    // 与其让它静默消失,不如这边显式过滤,数量对不上时好排查。
    .filter((t): t is GridTile & { png: string } => t.png !== null)
    .map((t) => ({
      // AutoText 是 { text } 对象,不是裸字符串(库支持 {distance}/{duration} 占位符)
      title: { text: t.title },
      image: toAutoImage(t.png, t.sizePt),
      // CPGridButton 必须给 handler。Driving Task 要求界面浅,点了不跳层级 —— no-op。
      onPress: () => {},
    }));

/** 车机连上时建根模板。重复调用是幂等的。 */
export function mountDashboard(tiles: GridTile[]): boolean {
  const l = load();
  if (!l) return false;
  if (!template) {
    template = new l.GridTemplate({
      title: { text: 'Blackbox · 实时' },
      buttons: buildButtons(tiles),
    });
    template.setRootTemplate();
    return true;
  }
  return updateDashboard(tiles);
}

/** 刷新 8 个格子。模板还没建时返回 false。 */
export function updateDashboard(tiles: GridTile[]): boolean {
  if (!template) return false;
  template.updateGrid(buildButtons(tiles));
  return true;
}

export function unmountDashboard() {
  template = null;
  listTemplate = null;
}

// ---------------------------------------------------------------- 卡片版
//
// iOS 26 的 CPListImageRowItem + CPListImageRowItemCardElement:一行放多张卡片,
// 每张卡 = 图 + 系统渲染的 title/subtitle,还支持多行排列。比 Grid 的八宫格自由
// 一个量级 —— Grid 的格间留白是系统排的,app 改不了。
//
// ⚠️ 库完全没暴露这套 API。当前靠 node_modules 里的一次性探针
// (ios/BlackboxProbe.swift)把 section.title === '__CARDS__' 的 section 转成卡片行。
// 探针会被 prebuild/pod install 冲掉 —— 验证通过后要 fork 库或走 patch-package。
export const CARD_SECTION_MARKER = '__CARDS__';

export interface CardTile {
  title: string;
  subtitle: string;
  png: string | null;
  widthPt: number;
}

let listTemplate: ListTemplateClass | null = null;

const cardSections = (cards: CardTile[]) => [
  {
    type: 'default' as const,
    title: CARD_SECTION_MARKER,
    items: cards
      .filter((c): c is CardTile & { png: string } => c.png !== null)
      .map((c) => ({
        type: 'text' as const,
        title: { text: c.title },
        detailedText: { text: c.subtitle },
        image: toAutoImage(c.png, c.widthPt),
      })),
  },
];

/** 建卡片版根模板。已建则改为刷新。 */
export function mountCards(cards: CardTile[]): boolean {
  const l = load();
  if (!l) return false;
  if (!listTemplate) {
    listTemplate = new l.ListTemplate({
      title: { text: 'Blackbox · 实时' },
      sections: cardSections(cards),
    });
    listTemplate.setRootTemplate();
    return true;
  }
  return updateCards(cards);
}

export function updateCards(cards: CardTile[]): boolean {
  if (!listTemplate) return false;
  listTemplate.updateSections(cardSections(cards));
  return true;
}

/**
 * 当前车机是否已连接。
 *
 * 必须有这个:didConnect 只在「连接这件事发生的那一刻」触发。如果 app 启动时
 * 车机早就连着了(先插车后开 app,或 CarPlay 屏先开着),监听器注册时事件已经
 * 过去了,光靠事件会永远认为没连、从不绘制 —— 2026-07-27 模拟器上实际撞到。
 */
export function isCarConnected(): boolean {
  const l = load();
  if (!l) return false;
  try {
    return l.HybridAutoPlay.isConnected();
  } catch {
    return false;
  }
}

/** 订阅车机连接状态。返回取消订阅函数;CarPlay 不可用时返回 no-op。 */
export function onCarConnection(onConnect: () => void, onDisconnect: () => void): () => void {
  const l = load();
  if (!l) return () => {};
  const a = l.HybridAutoPlay.addListener('didConnect', onConnect);
  const b = l.HybridAutoPlay.addListener('didDisconnect', onDisconnect);
  return () => {
    a?.();
    b?.();
  };
}

export type { TileLayout };
