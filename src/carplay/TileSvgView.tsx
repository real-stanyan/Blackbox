// 图元 → react-native-svg 组件树,并把它光栅化成 base64 PNG。
//
// 为什么要光栅化:CarPlay 的 CPGridButton 只接受 UIImage。库的 AutoImage 有三种形态
// (glyph / asset / remote),remote 只收 HTTPS,glyph 要注册图标字体 —— 动态图表只能走
// asset,即把图渲染成 PNG 再以 uri 传进去。react-native-svg 的 Svg.toDataURL() 在
// Fabric 下也有(NativeSvgViewModule.toDataURL),所以不用新增光栅化依赖。
//
// ⚠️ 未经真机验证(AGENTS.md Hard rule):以下三点必须上车/连 CarPlay 模拟器才能确认
//   1. RCTConvert 的 uiImage 是否吃 `data:image/png;base64,…`(理论上支持,没实测)
//   2. app 在后台(CarPlay 显示、手机锁屏)时 offscreen Svg 还能不能绘制 → toDataURL
//      失败的话得改成原生 Swift 画,或退回纯文字模板
//   3. 每秒重推 8 张 PNG 的实际开销
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { FONT } from '../styles/tokens';
import type { TileLayout, TilePrim } from './tileGeom';

/** Svg 实例上 toDataURL 的最小签名 —— 只用到这一个方法,不引入整个类型。 */
interface Rasterizable {
  toDataURL: (cb: (base64: string) => void, options?: object) => void;
}

export function TilePrims({ prims }: { prims: TilePrim[] }) {
  return (
    <>
      {prims.map((p, i) => {
        switch (p.k) {
          case 'rect':
            return (
              <Rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.r} fill={p.fill} />
            );
          case 'poly':
            return (
              <Polyline
                key={i}
                points={p.points}
                fill="none"
                stroke={p.stroke}
                strokeWidth={p.sw}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          case 'circle':
            return (
              <Circle
                key={i}
                cx={p.cx}
                cy={p.cy}
                r={p.r}
                fill={p.fill}
                stroke={p.stroke}
                strokeWidth={p.sw}
              />
            );
          case 'text':
            return (
              <SvgText
                key={i}
                x={p.x}
                y={p.y}
                fill={p.fill}
                fontSize={p.size}
                fontWeight={p.weight}
                textAnchor={p.anchor}
                fontFamily={FONT}
              >
                {p.text}
              </SvgText>
            );
        }
      })}
    </>
  );
}

export interface TileRasterizerProps {
  layouts: TileLayout[];
  /** 全部光栅化完成时回调,顺序与 layouts 一致。失败的那张给 null。 */
  onPngs: (base64: (string | null)[]) => void;
  /** layouts 的版本号 —— 变了才重画。避免每次 render 都重跑光栅化。 */
  revision: number;
}

/**
 * 把 layouts 渲染在屏幕外并逐个 toDataURL。
 *
 * 必须真的挂载在 RN 视图树里(不能纯内存渲染)—— toDataURL 读的是原生视图的位图。
 * 所以挪到屏幕外而不是 display:none:后者不绘制。
 */
export function TileRasterizer({ layouts, onPngs, revision }: TileRasterizerProps) {
  const refs = useRef<(Rasterizable | null)[]>([]);

  useEffect(() => {
    if (layouts.length === 0) return;
    let cancelled = false;
    // 等一帧:刚 setState 的 Svg 这一刻还没上屏,立刻 toDataURL 会拿到空位图。
    const raf = requestAnimationFrame(() => {
      const out: (string | null)[] = new Array(layouts.length).fill(null);
      let done = 0;
      const finish = () => {
        if (++done === layouts.length && !cancelled) onPngs(out);
      };
      layouts.forEach((_, i) => {
        const svg = refs.current[i];
        if (!svg) return finish();
        try {
          svg.toDataURL((b64) => {
            out[i] = b64;
            finish();
          });
        } catch {
          // 单张失败不能拖垮整屏 —— 该格子退化成没有图,其余照常
          finish();
        }
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
    // revision 是显式的重画信号;layouts 每帧都是新数组,不能进依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);

  return (
    <View style={styles.offscreen} pointerEvents="none" accessibilityElementsHidden>
      {layouts.map((l, i) => (
        <Svg
          key={i}
          ref={(r: unknown) => {
            refs.current[i] = r as Rasterizable | null;
          }}
          width={l.w}
          height={l.h}
        >
          <TilePrims prims={l.prims} />
        </Svg>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // 挪到屏幕外而不是隐藏:隐藏的视图不绘制,toDataURL 会拿到空图
  offscreen: { position: 'absolute', left: -10000, top: 0, opacity: 0 },
});
