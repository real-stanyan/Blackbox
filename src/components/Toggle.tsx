import { Pressable, View, Animated, Platform } from 'react-native';
import { useRef, useEffect } from 'react';
import { useTheme } from '../context/Theme';

export interface ToggleProps {
  on: boolean;
  onChange: (on: boolean) => void;
}

// iOS switch。对照 prototype/kit.jsx Toggle;CSS transition .2s 改用
// Animated.timing 150ms ease(对照 spec §6)。
export function Toggle({ on, onChange }: ToggleProps) {
  const t = useTheme();
  const trans = useRef(new Animated.Value(on ? 20 : 0)).current;
  useEffect(() => {
    Animated.timing(trans, { toValue: on ? 20 : 0, duration: 150, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [on, trans]);
  const trackBg = on ? t.green : (t.mode === 'dark' ? '#39393D' : '#E9E9EA');
  return (
    <Pressable onPress={() => onChange(!on)} style={{ width: 51, height: 31, borderRadius: 16, backgroundColor: trackBg, padding: 2 }}>
      <Animated.View
        style={{
          width: 27,
          height: 27,
          borderRadius: 14,
          backgroundColor: '#fff',
          transform: [{ translateX: trans }],
          // iOS 阴影
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 1.5,
          shadowOffset: { width: 0, height: 1 },
          elevation: 2,
        }}
      />
    </Pressable>
  );
}
