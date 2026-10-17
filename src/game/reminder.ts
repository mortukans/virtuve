/**
 * Optional daily reminder for the dinner game — a local notification at 12:00
 * in the user's local time. Fully guarded: no-ops on web and never throws, so a
 * missing permission or unavailable module can't crash the app. State is stored
 * per device in AsyncStorage.
 */
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { L } from '@src/i18n/lv';

const FLAG = 'virtuve.reminder.enabled';
const IDK = 'virtuve.reminder.id';

export async function isReminderEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(FLAG)) === '1';
  } catch {
    return false;
  }
}

async function cancelExisting(): Promise<void> {
  try {
    const prev = await AsyncStorage.getItem(IDK);
    if (prev) await Notifications.cancelScheduledNotificationAsync(prev).catch(() => {});
    await AsyncStorage.removeItem(IDK);
  } catch {
    /* ignore */
  }
}

/** Request permission + schedule the daily 12:00 reminder. Returns true on success. */
export async function enableReminder(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const perm = await Notifications.getPermissionsAsync();
    let granted = perm.granted || perm.status === 'granted';
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted || req.status === 'granted';
    }
    if (!granted) return false;

    await cancelExisting();
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: L.game.notifTitle, body: L.game.notifBody },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 12, minute: 0 },
    });
    await AsyncStorage.setItem(IDK, id);
    await AsyncStorage.setItem(FLAG, '1');
    return true;
  } catch {
    return false;
  }
}

/** Cancel the reminder and remember it's off. */
export async function disableReminder(): Promise<void> {
  await cancelExisting();
  try {
    await AsyncStorage.setItem(FLAG, '0');
  } catch {
    /* ignore */
  }
}

/** Toggle state + setter for the settings control. `supported` is false on web. */
export function useReminder() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported = Platform.OS !== 'web';

  useEffect(() => {
    let mounted = true;
    void isReminderEnabled().then((v) => { if (mounted) setEnabled(v); });
    return () => { mounted = false; };
  }, []);

  const toggle = useCallback(async (next: boolean): Promise<boolean> => {
    setBusy(true);
    try {
      if (next) {
        const ok = await enableReminder();
        setEnabled(ok);
        return ok;
      }
      await disableReminder();
      setEnabled(false);
      return true;
    } finally {
      setBusy(false);
    }
  }, []);

  return { enabled, busy, supported, toggle };
}
