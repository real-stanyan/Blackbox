import { View, Text } from 'react-native';
import { useMemo } from 'react';
import { useTheme } from '../../context/Theme';

export interface StatTileProps {
  label: string;
  value: string | number; // '—' 或数字
  unit?: string;
  note?: string;
  color?: string;
}

// Home 的实时 tile。对照 prototype/screensA.jsx StatTile。
export function StatTile({ label, value, unit, note, color }: StatTileProps) {
  const t = useTheme();
  const isDash = value === '—';
  const s = useMemo(
    () => ({
      tile: {
        backgroundColor: t.card,
        borderRadius: 14,
        padding: 13,
        paddingHorizontal: 14,
        flex: 1,
        flexBasis: '40%' as unknown as number,
        minWidth: 0,
      },
      label: { color: t.label2, fontSize: 13, marginBottom: 6 },
      row: { flexDirection: 'row' as const, alignItems: 'baseline' as const, gap: 4 },
      value: {
        color: isDash ? t.label3 : (color ?? t.label),
        fontSize: 30,
        fontWeight: '600' as const,
        letterSpacing: -0.5,
        fontVariant: ['tabular-nums' as const],
        lineHeight: 30,
      },
      unit: { color: t.label2, fontSize: 13 },
      note: { color: t.label3, fontSize: 11, marginTop: 5 },
    }),
    [t, isDash, color],
  );
  return (
    <View style={s.tile}>
      <Text style={s.label}>{label}</Text>
      <View style={s.row}>
        <Text style={s.value}>{value}</Text>
        {unit && !isDash ? <Text style={s.unit}>{unit}</Text> : null}
      </View>
      {note ? <Text style={s.note}>{note}</Text> : null}
    </View>
  );
}
