// Converted from app.json to app.config.js so the Android Google Maps key
// can be injected from .env at config-resolution time (Node context, not
// bundled into the JS app -- no EXPO_PUBLIC_ prefix needed or wanted here).
// iOS uses native Apple Maps (no key needed) -- see REFACTOR_NOTES.md.
module.exports = {
  expo: {
    name: 'markt-logistics',
    slug: 'markt-logistics',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'marktlogistics',
    userInterfaceStyle: 'automatic',
    ios: {
      supportsTablet: true,
      // Required for an iOS build at all, and it is what the APNs
      // credentials attach to. Matches the Android package's shape.
      bundleIdentifier: 'com.marktcommerce.marktlogistics',
    },
    android: {
      // Without this, the committed google-services.json is just a file in
      // the repo: prebuild never writes it into the Android project, the
      // build ships with no FCM sender, and push fails by never arriving --
      // no build error, no runtime error, nothing in a log.
      googleServicesFile: './google-services.json',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      permissions: ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO'],
      package: 'com.marktcommerce.marktlogistics',
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID,
        },
      },
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      // Push. The config plugin is what wires the native notification
      // permission and Android channel into a dev/production build; without
      // it the JS API is there but nothing arrives.
      'expo-notifications',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#000000',
          },
        },
      ],
      'expo-font',
      'expo-image',
      'expo-status-bar',
      'expo-web-browser',
      [
        'expo-camera',
        {
          cameraPermission: 'Allow Markt Logistics to use your camera to scan delivery codes.',
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission: 'Markt Logistics uses your location to show nearby deliveries and your position on the map.',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: 'd8ac1705-4978-4635-a49c-fe13003ac219',
      },
    },
  },
};
