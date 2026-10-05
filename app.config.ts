import type { ConfigContext, ExpoConfig } from 'expo/config';

const BUNDLE_ID = 'lv.virtuve.app';
const LINK_HOST = process.env.EXPO_PUBLIC_UNIVERSAL_LINK_HOST ?? 'virtuve.lv';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Virtuve',
  slug: 'virtuve',
  scheme: 'virtuve',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: false,
    usesAppleSignIn: true,
    associatedDomains: [`applinks:${LINK_HOST}`],
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      UIBackgroundModes: ['remote-notification'],
      CFBundleAllowMixedLocalizations: true,
      CFBundleLocalizations: ['lv'],
      NSCameraUsageDescription:
        'Virtuve izmanto kameru, lai nofotografētu ledusskapi un atpazītu produktus.',
      NSPhotoLibraryUsageDescription:
        'Virtuve izmanto fotoattēlus, lai atpazītu produktus un saglabātu pagatavoto ēdienu bildes.',
    },
    entitlements: { 'aps-environment': 'production' },
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: { backgroundColor: '#0C100D', foregroundImage: './assets/icon.png' },
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: LINK_HOST, pathPrefix: '/i' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: { favicon: './assets/favicon.png', bundler: 'metro' },
  plugins: [
    'expo-router',
    '@react-native-community/datetimepicker',
    'expo-secure-store',
    'expo-localization',
    'expo-apple-authentication',
    ['expo-image-picker', { photosPermission: 'Virtuve izmanto fotoattēlus, lai atpazītu produktus.' }],
    ['expo-camera', { cameraPermission: 'Virtuve izmanto kameru, lai nofotografētu ledusskapi.' }],
    ['expo-splash-screen', { backgroundColor: '#0C100D', image: './assets/splash-icon.png', imageWidth: 180 }],
    ['expo-notifications', { color: '#FFB43E' }],
  ],
  experiments: { typedRoutes: false },
  extra: { eas: { projectId: process.env.EAS_PROJECT_ID } },
  updates: process.env.EAS_PROJECT_ID
    ? { url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID}` }
    : undefined,
  runtimeVersion: { policy: 'appVersion' },
});
