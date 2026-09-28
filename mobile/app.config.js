const path = require("node:path");

const googleServicesFile = process.env.KLYX_GOOGLE_SERVICES_FILE?.trim();

module.exports = {
  expo: {
    name: "KLYX",
    slug: "klyx-mobile",
    version: "0.1.0",
    orientation: "portrait",
    scheme: "klyx",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "app.klyx.mobile",
      infoPlist: {
        NSCameraUsageDescription: "KLYX utilise la caméra pour la vérification d’identité et les demandes avec photo.",
        NSMicrophoneUsageDescription: "KLYX utilise le microphone lorsque la vérification d’identité ou une fonctionnalité vocale l’exige.",
        NSPhotoLibraryUsageDescription: "KLYX peut accéder aux photos que tu choisis pour tes demandes et vérifications."
      }
    },
    android: {
      package: "app.klyx.mobile",
      permissions: ["CAMERA", "RECORD_AUDIO", "POST_NOTIFICATIONS"],
      ...(googleServicesFile ? { googleServicesFile } : {})
    },
    plugins: [
      "expo-secure-store",
      ["expo-notifications", { defaultChannel: "klyx-default" }],
      path.resolve(__dirname, "plugins/with-sumsub.js")
    ],
    extra: {
      klyxMobileContract: "core-api-v1"
    }
  }
};
