export interface LibraryInfo {
  name: string;
  description?: string;
  supportedPlatforms?: Array<'android' | 'ios'>;
}

const libraries: LibraryInfo[] = [
  {
    name: 'react-native-gesture-handler',
    description: 'Gesture handling library',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-screens',
    description: 'Native screens for navigation',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-safe-area-context',
    description: 'Safe area context provider',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-pager-view',
    description: 'ViewPager component',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-reanimated',
    description: 'React Native animation library',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-worklets',
    description: 'Run JS in separate threads',
    supportedPlatforms: ['android'],
  },
  {
    name: '@shopify/react-native-skia',
    description: 'GPU-accelerated graphics',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-svg',
    description: 'SVG support',
    supportedPlatforms: ['android'],
  },
  {
    name: 'lottie-react-native',
    description: 'Lottie animations',
    supportedPlatforms: ['android'],
  },
  {
    name: '@react-native-async-storage/async-storage',
    description: 'Local data storage',
    supportedPlatforms: ['android'],
  },
  {
    name: '@react-native-community/netinfo',
    description: 'Network information',
    supportedPlatforms: ['android'],
  },
  {
    name: '@pusher/pusher-websocket-react-native',
    description: 'WebSocket client',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-blob-util',
    description: 'Blob/File handling',
    supportedPlatforms: ['android'],
  },
  {
    name: '@react-native-firebase/app',
    description: 'Firebase core',
    supportedPlatforms: ['android'],
  },
  {
    name: '@react-native-firebase/analytics',
    description: 'Firebase Analytics',
    supportedPlatforms: ['android'],
  },
  {
    name: '@react-native-firebase/crashlytics',
    description: 'Firebase Crashlytics',
    supportedPlatforms: ['android'],
  },
  {
    name: '@react-native-firebase/perf',
    description: 'Firebase Performance',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-device-info',
    description: 'Device information',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-permissions',
    description: 'Permission management',
    supportedPlatforms: ['android'],
  },
  {
    name: '@react-native-clipboard/clipboard',
    description: 'Clipboard access',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-haptic-feedback',
    description: 'Haptic feedback',
    supportedPlatforms: ['android'],
  },
  {
    name: '@react-native-community/geolocation',
    description: 'Geolocation API',
    supportedPlatforms: ['android'],
  },
  {
    name: '@react-native-camera-roll/camera-roll',
    description: 'Camera roll access',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-image-picker',
    description: 'Image/video picker',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-view-shot',
    description: 'Screenshot functionality',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-sound',
    description: 'Audio playback',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-pdf',
    description: 'PDF viewing',
    supportedPlatforms: ['android'],
  },
  {
    name: '@rnmapbox/maps',
    description: 'Mapbox maps integration',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-android-location-enabler',
    description: 'Location enabling',
    supportedPlatforms: ['android'],
  },
  {
    name: '@react-native-masked-view/masked-view',
    description: 'Masked view component',
    supportedPlatforms: ['android'],
  },
  {
    name: '@zoontek/react-native-navigation-bar',
    description: 'Navigation bar customization',
    supportedPlatforms: ['android'],
  },
  {
    name: '@react-native-picker/picker',
    description: 'Picker component',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-config',
    description: 'Environment configuration',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-fs',
    description: 'File system access',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-localize',
    description: 'Localization support',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-webview',
    description: 'WebView component',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-share',
    description: 'Social sharing',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-keyboard-controller',
    description: 'Keyboard control',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-launch-arguments',
    description: 'Deep linking',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-get-random-values',
    description: 'Cryptographic random values',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-advanced-input-mask',
    description: 'Input masking',
    supportedPlatforms: ['android'],
  },
  {
    name: '@sentry/react-native',
    description: 'Error tracking and monitoring',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-performance',
    description: 'Performance monitoring',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-release-profiler',
    description: 'Release profiling',
    supportedPlatforms: ['android'],
  },
  {
    name: '@ua/react-native-airship',
    description: 'Airship integration',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-app-logs',
    description: 'App logging',
    supportedPlatforms: ['android'],
  },
  {
    name: '@react-native-google-signin/google-signin',
    description: 'Google Sign-In',
    supportedPlatforms: ['android'],
  },
  {
    name: '@react-native-documents/picker',
    description: 'Document picker',
    supportedPlatforms: ['android'],
  },

  {
    name: 'react-native-plaid-link-sdk',
    description: 'Plaid integration',
    supportedPlatforms: ['android'],
  },
  {
    name: 'react-native-key-command',
    description: 'Hardware keyboard commands',
    supportedPlatforms: ['android'],
  },
];

export function getAllLibraries() {
  return libraries;
}

export function getLibrariesCount() {
  return libraries.length;
}

export default libraries;
