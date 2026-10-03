import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@src/ui/theme';
import { L } from '@src/i18n/lv';

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: L.nav.home, tabBarIcon: ({ color, size }) => <Ionicons name="restaurant" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="kitchen"
        options={{ title: L.nav.kitchen, tabBarIcon: ({ color, size }) => <Ionicons name="snow" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="shopping"
        options={{ title: L.nav.shopping, tabBarIcon: ({ color, size }) => <Ionicons name="cart" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="us"
        options={{ title: L.nav.us, tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
