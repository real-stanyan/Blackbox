import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useThemeMode } from '../context/Theme';
import { TabBar } from '../components/TabBar';
import { HomeScreen } from '../screens/HomeScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { TripDetailScreen } from '../screens/TripDetailScreen';
import { TrendsScreen } from '../screens/TrendsScreen';
import { HealthScreen } from '../screens/HealthScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ChatPlaceholderScreen } from '../screens/ChatPlaceholderScreen';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

export function RootNavigator() {
  return (
    <ThemeProvider>
      <NavigatorInner />
    </ThemeProvider>
  );
}

function NavigatorInner() {
  const { mode } = useThemeMode();
  return (
    <SafeAreaProvider>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Tabs" component={TabsScreen} />
          <Stack.Screen name="TripDetail" component={TripDetailScreen} />
          <Stack.Screen
            name="Chat"
            component={ChatPlaceholderScreen}
            options={{ presentation: 'modal' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

function TabsScreen() {
  return (
    <Tabs.Navigator
      tabBar={(p) => <TabBar {...p} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="History" component={HistoryScreen} />
      <Tabs.Screen name="Trends" component={TrendsScreen} />
      <Tabs.Screen name="Health" component={HealthScreen} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}
