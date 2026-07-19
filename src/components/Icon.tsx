import { Svg, Path, Circle, Rect } from 'react-native-svg';

export type IconName =
  | 'gauge' | 'clock' | 'chart' | 'heart' | 'gear'
  | 'chevron' | 'back' | 'bluetooth' | 'check'
  | 'bell' | 'share' | 'sound' | 'route' | 'car'
  | 'sparkles' | 'chatbubble'
  // fill 图标
  | 'checkcircle' | 'warncircle' | 'infocircle' | 'send';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  fill?: boolean; // 仅 heart 用 — 描边 vs 填充
  stroke?: number;
}

// 对照 prototype/kit.jsx Icon 的 17 个 case 1:1。
// stroke 图标用 <Path stroke>;checkcircle/warncircle/infocircle/send 是 fill 形态。
export function Icon({ name, size = 24, color = 'currentColor', fill = false, stroke = 2 }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const fillCommon = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: color,
  };

  switch (name) {
    case 'gauge':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M12 12l4-3" />
          <Circle cx="12" cy="12" r="1.3" fill={color} stroke="none" />
          <Path d="M12 3v1.5M21 12h-1.5M4.5 12H3" />
        </Svg>
      );
    case 'clock':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M12 7.5V12l3 2" />
        </Svg>
      );
    case 'chart':
      return (
        <Svg {...common}>
          <Path d="M4 15l5-5 4 3 6-7" />
          <Path d="M4 20h16" opacity={0.4} />
        </Svg>
      );
    case 'heart':
      return fill ? (
        <Svg {...fillCommon}>
          <Path d="M12 20.5C6.5 16.5 3 13.4 3 9.6 3 7 5 5 7.5 5c1.6 0 3 .8 3.8 2 .8-1.2 2.2-2 3.8-2C20 5 21 7 21 9.6c0 3.8-3.5 6.9-9 10.9z" />
        </Svg>
      ) : (
        <Svg {...common}>
          <Path d="M12 20.5C6.5 16.5 3 13.4 3 9.6 3 7 5 5 7.5 5c1.6 0 3 .8 3.8 2 .8-1.2 2.2-2 3.8-2C20 5 21 7 21 9.6c0 3.8-3.5 6.9-9 10.9z" />
        </Svg>
      );
    case 'gear':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="3.2" />
          <Path d="M12 2.8v2.4M12 18.8v2.4M4.3 7.5l2 1.2M17.7 15.3l2 1.2M4.3 16.5l2-1.2M17.7 8.7l2-1.2M2.8 12h2.4M18.8 12h2.4" />
        </Svg>
      );
    case 'chevron':
      return (
        <Svg {...common} strokeWidth={2.4}>
          <Path d="M9 6l6 6-6 6" />
        </Svg>
      );
    case 'back':
      return (
        <Svg {...common} strokeWidth={2.6}>
          <Path d="M15 6l-6 6 6 6" />
        </Svg>
      );
    case 'bluetooth':
      return (
        <Svg {...common}>
          <Path d="M7 7l10 10-5 4V3l5 4L7 17" />
        </Svg>
      );
    case 'check':
      return (
        <Svg {...common} strokeWidth={2.6}>
          <Path d="M5 13l4 4L19 7" />
        </Svg>
      );
    case 'checkcircle':
      return (
        <Svg {...fillCommon}>
          <Circle cx="12" cy="12" r="10" />
          <Path d="M7 12.5l3.2 3.2L17 9" stroke="#fff" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'warncircle':
      return (
        <Svg {...fillCommon}>
          <Circle cx="12" cy="12" r="10" />
          <Path d="M12 7v6" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
          <Circle cx="12" cy="16.5" r="1.2" fill="#fff" />
        </Svg>
      );
    case 'infocircle':
      return (
        <Svg {...fillCommon}>
          <Circle cx="12" cy="12" r="10" />
          <Path d="M12 11v6" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
          <Circle cx="12" cy="7.6" r="1.2" fill="#fff" />
        </Svg>
      );
    case 'bell':
      return (
        <Svg {...common}>
          <Path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z" />
          <Path d="M10 20a2 2 0 004 0" />
        </Svg>
      );
    case 'share':
      return (
        <Svg {...common}>
          <Path d="M12 15V4M8.5 7.5L12 4l3.5 3.5" />
          <Path d="M6 12v6a1 1 0 001 1h10a1 1 0 001-1v-6" />
        </Svg>
      );
    case 'sound':
      return (
        <Svg {...common}>
          <Path d="M4 9v6h4l5 4V5L8 9H4z" />
          <Path d="M17 9a4 4 0 010 6" />
        </Svg>
      );
    case 'route':
      return (
        <Svg {...common}>
          <Circle cx="6" cy="6" r="2.2" />
          <Circle cx="18" cy="18" r="2.2" />
          <Path d="M8 6h6a3 3 0 013 3v0a3 3 0 01-3 3H10a3 3 0 00-3 3v0" />
        </Svg>
      );
    case 'car':
      return (
        <Svg {...common}>
          <Path d="M5 16l1.2-4.2A2 2 0 018.1 10h7.8a2 2 0 011.9 1.8L19 16" />
          <Rect x="3.5" y="16" width="17" height="3.2" rx="1" />
          <Circle cx="7.5" cy="19.5" r="1" fill={color} stroke="none" />
          <Circle cx="16.5" cy="19.5" r="1" fill={color} stroke="none" />
        </Svg>
      );
    case 'sparkles':
      return (
        <Svg {...common}>
          <Path d="M12 3l1.6 4.3L18 9l-4.4 1.7L12 15l-1.6-4.3L6 9l4.4-1.7L12 3z" />
          <Path d="M18.5 14.5l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9z" />
        </Svg>
      );
    case 'send':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <Path d="M3.4 12l16.5-8.2c.5-.2 1 .3.8.8L12.5 21c-.2.5-.9.5-1.1 0l-2.2-6.4a1 1 0 00-.6-.6L2.3 11.7c-.5-.2-.5-.9 0-1.1l1.1.4z" />
        </Svg>
      );
    case 'chatbubble':
      return (
        <Svg {...common}>
          <Path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H9l-4 4v-4H6a2 2 0 01-2-2V6z" />
        </Svg>
      );
    default:
      return null;
  }
}
