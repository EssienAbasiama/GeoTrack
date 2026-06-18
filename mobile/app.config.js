// Dynamic Expo config. Uses app.json as the base, then injects the native
// Google Maps API key (required for react-native-maps' PROVIDER_GOOGLE on a
// standalone Android build). The key is read from the environment so it never
// has to be committed: set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in mobile/.env for
// local runs, or as an env var in eas.json for cloud builds.
export default ({ config }) => {
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: { apiKey: googleMapsApiKey },
      },
    },
    ios: {
      ...config.ios,
      config: {
        ...config.ios?.config,
        googleMapsApiKey,
      },
    },
  };
};
