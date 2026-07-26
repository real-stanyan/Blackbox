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
} from '@iternio/react-native-auto-play';
import type { TileLayout } from './tileGeom';

/** 每格一份:系统渲染的 title + 已光栅化的 PNG(base64,失败为 null)。 */
export interface GridTile {
  title: string;
  png: string | null;
}

interface AutoPlayLib {
  HybridAutoPlay: typeof HybridAutoPlayType;
  GridTemplate: typeof GridTemplateClass;
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
const toAutoImage = (png: string): AutoImage => ({
  type: 'asset',
  image: { uri: `data:image/png;base64,${png}` },
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
      image: toAutoImage(t.png),
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
