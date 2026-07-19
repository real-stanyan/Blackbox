import { View } from 'react-native';
import { Svg, Circle } from 'react-native-svg';
import { Animated } from 'react-native';
import { useEffect, useRef, type ReactNode } from 'react';
import { useTheme } from '../context/Theme';

export interface RingProps {
  value: number; // 0-100
  color: string;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}

// 对照 prototype/kit.jsx Ring。score 变化时用 Animated.timing 让 dashoffset
// 平滑过渡(spec §6 Ring 备注)。
export function Ring({ value, color, size = 128, stroke = 11, children }: RingProps) {
  const t = useTheme();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const target = circumference * (1 - Math.max(0, Math.min(100, value)) / 100);
  const anim = useRef(new Animated.Value(target)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: target, duration: 600, useNativeDriver: false }).start();
  }, [target, anim]);
  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.fill} strokeWidth={stroke} />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={anim as unknown as number}
          strokeLinecap="round"
        />
      </Svg>
      <View
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </View>
  );
}

// react-native-svg 的 Circle 接受 Animated.Value 通过 createAnimatedComponent。
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
