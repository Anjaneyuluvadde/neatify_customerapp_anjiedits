// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Redirect react-native-razorpay to a mock shim when bundling for Expo Go.
// The real native module will be linked during a full `expo run:android` / APK build.
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    ...config.resolver.extraNodeModules,
    "react-native-razorpay": path.resolve(__dirname, "mocks/react-native-razorpay.js"),
  },
};

module.exports = config;
