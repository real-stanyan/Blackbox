import { View, Text, ScrollView, Pressable, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useMemo, type ReactNode } from 'react';
import { Icon } from './Icon';
import { useTheme } from '../context/Theme';

export interface ScreenProps {
  title: string;
  children: ReactNode;
  right?: ReactNode;
  below?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  // 是否占满高度(非滚动场景)。默认 false(走 ScrollView)。
  noScroll?: boolean;
}

// Screen scaffold:large title + 可选 right + 可选 below + 可选 onBack
// (栈 push 的子页用)。对照 prototype/chrome.jsx Screen。
export function Screen({ title, children, right, below, onBack, backLabel = '返回', noScroll = false }: ScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(
    () => ({
      root: {
        flex: 1,
        backgroundColor: t.bg,
        paddingTop: insets.top,
      } as ViewStyle,
      navBar: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        height: 44,
        paddingHorizontal: 8,
        borderBottomWidth: 0.5,
        borderBottomColor: t.barBorder,
      },
      back: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
      },
      backLabel: { color: t.orange, fontSize: 17 },
      titleRow: {
        flexDirection: 'row' as const,
        alignItems: 'flex-end' as const,
        justifyContent: 'space-between' as const,
        paddingHorizontal: 16,
        paddingVertical: 8,
      },
      title: {
        fontSize: 34,
        fontWeight: '700' as const,
        letterSpacing: 0.4,
        color: t.label,
      },
      body: { paddingTop: 6, paddingBottom: 110 }, // 110 = tab bar 高度 + safe area 余量
    }),
    [t, insets.top],
  );
  return (
    <View style={s.root}>
      {onBack ? (
        <BlurView intensity={80} tint={t.mode === 'dark' ? 'dark' : 'light'} style={s.navBar}>
          <Pressable onPress={onBack} style={({ pressed }) => [s.back, pressed && { opacity: 0.5 }]}>
            <Icon name="back" size={22} color={t.orange} />
            <Text style={s.backLabel}>{backLabel}</Text>
          </Pressable>
        </BlurView>
      ) : null}
      <ScrollView scrollEnabled={!noScroll} contentContainerStyle={noScroll ? { flex: 1 } : undefined}>
        <View style={s.titleRow}>
          <Text style={s.title}>{title}</Text>
          {right}
        </View>
        {below}
        <View style={s.body}>{children}</View>
      </ScrollView>
    </View>
  );
}
