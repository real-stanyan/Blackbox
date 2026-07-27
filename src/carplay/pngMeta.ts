// 从 base64 PNG 里读出真实像素宽。纯函数、不 import react/react-native。
//
// 为什么需要:react-native-svg 的 toDataURL() 按屏幕倍率渲染 —— 一个 176pt 的 Svg
// 在 3x 设备上出的是 528px 的 PNG。传给原生时如果不带 scale,iOS 会当它是 528pt
// 的图,再压到 CPGridTemplate.maximumGridButtonImageSize(约 60-70pt),等于整张图
// 缩了近 8 倍,字全糊成一团(2026-07-27 CarPlay Simulator 实测)。
//
// 而 toDataURL 不告诉我们它用了什么倍率,库也没暴露格子上限。所以不猜:
// 直接读 PNG 头拿像素宽,除以我们想要的 pt 尺寸,反算出正确的 scale。
// 这样无论 toDataURL 用 1x/2x/3x,原生看到的 pt 尺寸都是我们设计时的那个。

/** base64 字母表,只解前几个字节用。 */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * PNG 结构:8 字节签名 + 4 字节长度 + 'IHDR' + 宽(4 字节大端)。
 * 宽度在字节 16..19,所以只需要解前 24 字节 = 前 32 个 base64 字符。
 *
 * 返回 null = 不是 PNG / 数据不完整。调用方应退回 scale 1 而不是崩。
 */
export function pngPixelWidth(base64: string): number | null {
  if (base64.length < 32) return null;
  const bytes: number[] = [];
  for (let i = 0; i < 32; i += 4) {
    const a = B64.indexOf(base64[i]);
    const b = B64.indexOf(base64[i + 1]);
    const c = B64.indexOf(base64[i + 2]);
    const d = B64.indexOf(base64[i + 3]);
    if (a < 0 || b < 0 || c < 0 || d < 0) return null;
    bytes.push(((a << 2) | (b >> 4)) & 0xff);
    bytes.push(((b << 4) | (c >> 2)) & 0xff);
    bytes.push(((c << 6) | d) & 0xff);
  }
  // PNG 签名前四字节:0x89 'P' 'N' 'G'
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
  const w = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  return w > 0 ? w : null;
}

/**
 * 反算 image source 该报的 scale,使原生看到的 pt 尺寸 == sizePt。
 * 读不出宽度时退回 1 —— 宁可显示得不对,也别崩。
 */
export function scaleForTile(base64: string, sizePt: number): number {
  const px = pngPixelWidth(base64);
  if (!px || sizePt <= 0) return 1;
  return px / sizePt;
}
