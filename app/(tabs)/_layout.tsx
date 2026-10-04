import { Tabs } from 'expo-router';
import { colors } from '@src/ui/theme';
import { TabBar } from '@src/ui/TabBar';

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="home"
      tabBar={(props) => <TabBar {...(props as unknown as Parameters<typeof TabBar>[0])} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="kitchen" />
      <Tabs.Screen name="shopping" />
      <Tabs.Screen name="us" />
    </Tabs>
  );
}
