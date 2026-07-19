import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '../components/Icon';
import { useTheme } from '../context/Theme';

// Chat placeholder — sub-project D 接入真 AI chat。
export function ChatPlaceholderScreen() {
  const t = useTheme();
  const navigation = useNavigation();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', height: 46,
          paddingHorizontal: 6,
          backgroundColor: t.barBg,
          borderBottomWidth: 0.5, borderBottomColor: t.barBorder,
        }}
      >
        <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center' }, pressed && { opacity: 0.5 }]}>
          <Icon name="back" size={22} color={t.orange} />
          <Text style={{ color: t.orange, fontSize: 17 }}>返回</Text>
        </Pressable>
        <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }}>
          <Text style={{ color: t.label, fontSize: 16, fontWeight: '600' }}>问车况</Text>
          <Text style={{ color: t.label2, fontSize: 11 }}>基于你的行驶数据</Text>
        </View>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
        <Icon name="sparkles" size={48} color={t.label3} />
        <Text style={{ color: t.label2, fontSize: 15, textAlign: 'center', marginTop: 16, lineHeight: 22 }}>
          问车况将在 sub-project D 接入{'\n'}基于真实行程数据的 AI 对话。
        </Text>
      </View>
    </View>
  );
}
