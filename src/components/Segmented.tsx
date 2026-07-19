import { View, Pressable, Text } from 'react-native';
import { useMemo } from 'react';
import { useTheme } from '../context/Theme';

export interface SegmentedProps {
  options: string[];
  value: number;
  onChange: (i: number) => void;
}

// iOS segmented control。对照 prototype/kit.jsx Segmented。
export function Segmented({ options, value, onChange }: SegmentedProps) {
  const t = useTheme();
  const s = useMemo(
    () => ({
      wrap: {
        flexDirection: 'row' as const,
        backgroundColor: t.fill,
        borderRadius: 9,
        padding: 2,
        gap: 2,
        marginHorizontal: 16,
        marginBottom: 16,
      },
      item: {
        flex: 1,
        alignItems: 'center' as const,
        paddingVertical: 6,
        paddingHorizontal: 4,
        borderRadius: 7,
      },
      labelSel: { fontSize: 13, fontWeight: '600' as const, color: t.label },
      labelUnsel: { fontSize: 13, fontWeight: '400' as const, color: t.label },
    }),
    [t],
  );
  return (
    <View style={s.wrap}>
      {options.map((o, i) => {
        const sel = value === i;
        return (
          <Pressable
            key={i}
            onPress={() => onChange(i)}
            style={({ pressed }) => [
              s.item,
              sel && { backgroundColor: t.elevated },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={sel ? s.labelSel : s.labelUnsel}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
