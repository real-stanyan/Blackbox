import { Pressable, View, Text, type ViewStyle } from 'react-native';
import { useMemo, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { useTheme } from '../context/Theme';

export interface RowProps {
  icon?: IconName;
  iconBg?: string;
  title: string;
  sub?: string;
  value?: string;
  valueColor?: string;
  // 'chevron'(默认)/ 'check' / null(无 accessory)
  accessory?: 'chevron' | 'check' | null;
  // 自定义右侧(优先于 value/accessory)
  right?: ReactNode;
  last?: boolean;
  onClick?: () => void;
}

// iOS grouped list 的行。对照 prototype/kit.jsx Row。
export function Row({
  icon, iconBg, title, sub, value, valueColor,
  accessory = 'chevron', right, last = false, onClick,
}: RowProps) {
  const t = useTheme();
  const s = useMemo(
    () => ({
      row: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 11,
        minHeight: 44,
      } as ViewStyle,
      iconWrap: {
        width: 29,
        height: 29,
        borderRadius: 7,
        backgroundColor: iconBg ?? t.blue,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
      },
      main: { flex: 1 } as ViewStyle,
      title: { color: t.label, fontSize: 17, lineHeight: 20 },
      sub: { color: t.label2, fontSize: 13, marginTop: 2 },
      sep: { height: 0.5, backgroundColor: t.sep, marginLeft: 12 + (icon ? 29 : 0) },
      valueText: {
        color: valueColor ?? t.label2,
        fontSize: 17,
        fontVariant: ['tabular-nums' as const],
      },
    }),
    [t, iconBg],
  );
  return (
    <Pressable
      onPress={onClick}
      disabled={!onClick}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: t.fill }]}
    >
      {icon ? (
        <View style={s.iconWrap}>
          <Icon name={icon} size={18} color="#fff" />
        </View>
      ) : null}
      <View style={s.main}>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={s.sub}>{sub}</Text> : null}
      </View>
      {right ? (
        right
      ) : (
        <>
          {value != null ? <Text style={s.valueText}>{value}</Text> : null}
          {accessory === 'chevron' && onClick ? <Icon name="chevron" size={17} color={t.label3} /> : null}
          {accessory === 'check' ? <Icon name="check" size={20} color={t.blue} /> : null}
        </>
      )}
      {!last ? <View style={[{ position: 'absolute' as const, left: 0, right: 0, bottom: 0 }, s.sep]} /> : null}
    </Pressable>
  );
}
