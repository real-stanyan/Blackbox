import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useMemo, type ReactNode } from 'react';
import { useTheme } from '../context/Theme';

export interface GroupProps {
  header?: string;
  footer?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

// iOS grouped list 容器。children 是一组 Row。
export function Group({ header, footer, children, style }: GroupProps) {
  const t = useTheme();
  const s = useMemo(
    () => ({
      wrap: { marginBottom: 22 } as ViewStyle,
      header: { color: t.label2, fontSize: 13, letterSpacing: 0.2, paddingHorizontal: 20, paddingBottom: 7 },
      inner: { backgroundColor: t.card, borderRadius: 12, marginHorizontal: 16, overflow: 'hidden' as const } as ViewStyle,
      footer: { color: t.label2, fontSize: 13, lineHeight: 18, paddingHorizontal: 20, paddingTop: 7 },
    }),
    [t],
  );
  return (
    <View style={[s.wrap, style]}>
      {header ? <Text style={s.header}>{header}</Text> : null}
      <View style={s.inner}>{children}</View>
      {footer ? <Text style={s.footer}>{footer}</Text> : null}
    </View>
  );
}
