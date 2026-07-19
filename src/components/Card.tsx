import { Pressable, View, type ViewStyle, type StyleProp } from 'react-native';
import { useMemo, type ReactNode } from 'react';
import { useTheme } from '../context/Theme';

export interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  pad?: number;
  onClick?: () => void;
}

export function Card({ children, style, pad = 16, onClick }: CardProps) {
  const t = useTheme();
  const baseStyle = useMemo(
    () => ({
      card: {
        backgroundColor: t.card,
        borderRadius: 16,
        padding: pad,
        marginHorizontal: 16,
        marginBottom: 14,
      } as ViewStyle,
    }),
    [t, pad],
  );
  if (onClick) {
    return (
      <Pressable
        onPress={onClick}
        style={({ pressed }) => [baseStyle.card, pressed && { opacity: 0.7 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[baseStyle.card, style]}>{children}</View>;
}
