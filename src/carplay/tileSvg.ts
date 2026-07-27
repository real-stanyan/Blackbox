// 图元 → SVG 字符串。纯函数、不 import react/react-native。
//
// 两个用途:
//   1. scripts/test-carplay-tile.ts 离线出图肉眼验收(真机之外唯一能看到格子长什么样的手段)
//   2. 真机上喂 react-native-svg 的 SvgXml —— 与 TileSvgView 是两条可选路径,
//      共用同一份几何,画出来必须一致
import { FONT } from '../styles/tokens';
import type { TileLayout, TilePrim } from './tileGeom';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// tokens.FONT 里含双引号(`"PingFang SC"`),原样塞进 font-family="…" 会截断属性,
// 整张 SVG 从第一个 <text> 起解析失败。换成单引号。
const FONT_ATTR = FONT.replace(/"/g, "'");

export function primToSvg(p: TilePrim): string {
  switch (p.k) {
    case 'rect':
      return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"${
        p.r ? ` rx="${p.r}"` : ''
      } fill="${p.fill}"/>`;
    case 'poly':
      return `<polyline points="${p.points}" fill="none" stroke="${p.stroke}" stroke-width="${p.sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'circle':
      return `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${p.fill}"${
        p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.sw ?? 1}"` : ''
      }/>`;
    case 'text':
      return `<text x="${p.x}" y="${p.y}" fill="${p.fill}" font-size="${p.size}" font-weight="${p.weight}" text-anchor="${p.anchor}" font-family="${FONT_ATTR}">${esc(p.text)}</text>`;
  }
}

/** 单个格子的完整 SVG。背景透明 —— CarPlay 自己有底色。 */
export function tileToSvg(layout: TileLayout): string {
  const S = layout.size;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${layout.prims
    .map(primToSvg)
    .join('')}</svg>`;
}
