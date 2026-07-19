import { View, Text } from 'react-native';
import { useMemo, type ReactNode } from 'react';
import { useTheme } from '../context/Theme';
import { VERDICT, type Verdict } from '../styles/tokens';

export interface BadgeProps {
  tone: Verdict;
  children: ReactNode;
}

export function Badge({ tone, children }: BadgeProps) {
  const t = useTheme();
  const colorKey = VERDICT[tone][1];
  const color = t[colorKey];
  const s = useMemo(
    () => ({
      wrap: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 5,
        backgroundColor: `${color}22`, // 13% alpha(hex 22 后缀)
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 20,
      },
      dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color },
      label: { color, fontSize: 12.5, fontWeight: '600' as const },
    }),
    [color],
  );
  return (
    <View style={s.wrap}>
      <View style={s.dot} />
      <Text style={s.label}>{children}</Text>
    </View>
  );
}
