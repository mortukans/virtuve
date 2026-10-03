import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

/** Sign in with Apple is iOS-only. */
export const appleAvailable = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
};

export class ProviderCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'ProviderCancelled';
  }
}

/**
 * Prompt Sign in with Apple and return the identity token for
 * supabase.auth.signInWithIdToken. The Supabase Apple provider must have "skip
 * nonce check" enabled (we don't pass a nonce). Throws ProviderCancelled when
 * the user dismisses the sheet.
 */
export async function appleIdToken(): Promise<string> {
  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!cred.identityToken) throw new Error('apple_no_token');
    return cred.identityToken;
  } catch (e) {
    if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') throw new ProviderCancelled();
    throw e;
  }
}
