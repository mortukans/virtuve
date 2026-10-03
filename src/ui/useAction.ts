import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { errorMessage } from './errors';
import { warn } from './haptics';

/**
 * Wrap an async action with a busy flag and a Latvian error Alert.
 * Usage: const { run, busy } = useAction(); ... run(() => addInventoryItems(...), { onDone });
 */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const inflight = useRef(false);

  const run = useCallback(async <T,>(fn: () => Promise<T>, opts?: { onDone?: (r: T) => void; silent?: boolean }): Promise<T | undefined> => {
    if (inflight.current) return undefined;
    inflight.current = true;
    setBusy(true);
    try {
      const r = await fn();
      opts?.onDone?.(r);
      return r;
    } catch (e) {
      if (!opts?.silent) {
        warn();
        Alert.alert('', errorMessage(e));
      }
      return undefined;
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }, []);

  return { run, busy };
}
