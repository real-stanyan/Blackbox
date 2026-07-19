import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMemo } from 'react';
import { Icon } from './Icon';
import { useTheme } from '../context/Theme';

// 头部「问一问」按钮,点击跳 Chat placeholder。对照 prototype/chat.jsx AskButton。
export function AskButton() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const s = useMemo(
    () => ({
      wrap: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 5,
        backgroundColor: t.orange,
        paddingHorizontal: 13,
        paddingVertical: 7,
        borderRadius: 20,
      },
      label: { color: '#fff', fontSize: 14, fontWeight: '600' as const },
    }),
    [t],
  );
  return (
    <Pressable onPress={() => navigation.navigate('Chat')} style={({ pressed }) => [s.wrap, pressed && { opacity: 0.8 }]}>
      <Icon name="sparkles" size={16} color="#fff" stroke={1.8} />
      <Text style={s.label}>问一问</Text>
    </Pressable>
  );
}
