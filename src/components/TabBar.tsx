import { View, Pressable, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useMemo } from 'react';
import { Icon, type IconName } from './Icon';
import { useTheme } from '../context/Theme';

// 对照 prototype/chrome.jsx TabBar。expo-blur BlurView 做 barBg 玻璃质感,
// active tint = orange。每个 tab 配 iconName + 中文 label,在 route.name
// 上以 params.icon / params.label 传(见 RootNavigator TabsScreen)。
const TAB_META: Record<string, { icon: IconName; label: string }> = {
  Home:     { icon: 'gauge', label: '实时' },
  History:  { icon: 'clock', label: '历史' },
  Trends:   { icon: 'chart', label: '趋势' },
  Health:   { icon: 'heart', label: '健康' },
  Settings: { icon: 'gear',  label: '设置' },
};

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(
    () => ({
      wrap: {
        position: 'absolute' as const,
        left: 0, right: 0, bottom: 0,
        borderTopWidth: 0.5,
        borderTopColor: t.barBorder,
        paddingBottom: insets.bottom,
      },
      row: { flexDirection: 'row' as const, height: 50 },
      tab: {
        flex: 1,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        gap: 3,
      },
      labelActive: { fontSize: 10, fontWeight: '600' as const, color: t.orange },
      labelInactive: { fontSize: 10, fontWeight: '500' as const, color: t.label3 },
    }),
    [t, insets.bottom],
  );
  return (
    <View style={s.wrap}>
      <BlurView intensity={80} tint={t.mode === 'dark' ? 'dark' : 'light'} style={s.row}>
        {state.routes.map((route, i) => {
          const active = state.index === i;
          const meta = TAB_META[route.name];
          if (!meta) return null;
          const col = active ? t.orange : t.label3;
          const { options } = descriptors[route.key];
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!active && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };
          return (
            <Pressable key={route.key} onPress={onPress} style={s.tab} accessibilityRole="button" accessibilityState={active ? { selected: true } : {}} accessibilityLabel={options.tabBarAccessibilityLabel}>
              <Icon name={meta.icon} size={26} color={col} fill={active && meta.icon === 'heart'} stroke={active ? 2.2 : 1.9} />
              <Text style={active ? s.labelActive : s.labelInactive}>{meta.label}</Text>
            </Pressable>
          );
        })}
      </BlurView>
    </View>
  );
}
