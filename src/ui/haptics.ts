import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const ok = Platform.OS !== 'web';

export const tap = () => { if (ok) void Haptics.selectionAsync().catch(() => {}); };
export const success = () => { if (ok) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); };
export const warn = () => { if (ok) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); };
export const impact = () => { if (ok) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); };
