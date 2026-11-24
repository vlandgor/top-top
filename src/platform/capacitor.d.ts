// The slice of the Capacitor bridge the game uses. Inside the Android app the native shell
// injects window.Capacitor; in a browser it is absent and every caller checks for it.

interface AppBridge {
  addListener(event: "backButton" | "pause" | "resume", fn: () => void): unknown;
  exitApp(): Promise<void>;
}

interface Window {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    Plugins?: { App?: AppBridge };
  };
  webkitAudioContext?: typeof AudioContext;
}
