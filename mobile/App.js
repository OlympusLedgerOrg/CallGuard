import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  SafeAreaView,
  StatusBar,
  Platform,
  BackHandler,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from "react-native";
import { WebView } from "react-native-webview";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as SplashScreen from "expo-splash-screen";
import config from "./src/config";

/* ── Keep splash visible until the WebView content loads ── */
SplashScreen.preventAutoHideAsync().catch(() => {});

/* ── Notification handler (foreground) ── */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/* ── Colors (matches the web UI) ── */
const C = {
  bg: "#030508",
  surface: "#0E1219",
  accent: "#00C2FF",
  text: "#EEF2FF",
  muted: "#7A8BA8",
  danger: "#FF4D6A",
};

/**
 * Register for push notifications and return the Expo push token.
 * Returns null when running in a simulator or when permissions are denied.
 */
async function registerForPushNotifications() {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("calls", {
      name: "Call Alerts",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: C.accent,
    });
  }

  const token = await Notifications.getExpoPushTokenAsync();
  return token.data;
}

/* ── JavaScript injected into the WebView ── */
const INJECTED_JS = `
  (function() {
    // Tell the web app it's running inside a native shell
    window.__CALLGUARD_NATIVE = true;
    window.__CALLGUARD_PLATFORM = "${Platform.OS}";

    // Forward push token when set
    window.addEventListener("message", function(e) {
      try { window.ReactNativeWebView.postMessage(e.data); } catch {}
    });

    // Hide the platform switcher & device frame in the web UI
    // (the native app IS the device frame)
    var style = document.createElement("style");
    style.textContent = [
      // Hide the outer frame chrome that the web app renders
      '[data-native-hide] { display: none !important; }',
    ].join("\\n");
    document.head.appendChild(style);

    true; // required by WebView
  })();
`;

export default function App() {
  const webviewRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [pushToken, setPushToken] = useState(null);

  /* ── Push notifications ── */
  useEffect(() => {
    registerForPushNotifications().then((token) => {
      if (token) setPushToken(token);
    });

    // Listen for notification taps → could deep-link into the WebView
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.url && webviewRef.current) {
          webviewRef.current.injectJavaScript(
            `window.location.href = '${data.url}'; true;`
          );
        }
      }
    );

    return () => sub.remove();
  }, []);

  /* ── Android back button → navigate back in WebView ── */
  useEffect(() => {
    if (Platform.OS !== "android") return;

    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (webviewRef.current) {
        webviewRef.current.goBack();
        return true;
      }
      return false;
    });

    return () => handler.remove();
  }, []);

  /* ── Hide splash once the page loads ── */
  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  /* ── Handle messages from the WebView ── */
  const handleMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      // Handle call notifications natively
      if (msg.type === "call:start") {
        Notifications.scheduleNotificationAsync({
          content: {
            title: "📞 Incoming Call",
            body: `${msg.callerName || "Unknown"} — ${msg.callerNumber || ""}`,
            data: { url: "/" },
            sound: true,
          },
          trigger: null, // immediate
        });
      }
    } catch {
      /* ignore non-JSON messages */
    }
  }, []);

  /* ── Open external links in the system browser ── */
  const handleNavRequest = useCallback(
    (request) => {
      const { url } = request;
      // Allow navigation within our own server
      if (url.startsWith(config.SERVER_URL)) return true;
      // Open everything else externally
      Linking.openURL(url).catch(() => {});
      return false;
    },
    []
  );

  /* ── Error screen ── */
  if (hasError) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <View style={styles.center}>
          <Text style={styles.errorIcon}>📡</Text>
          <Text style={styles.errorTitle}>Can't reach server</Text>
          <Text style={styles.errorBody}>
            Make sure your CallGuard server is running at:{"\n"}
            <Text style={styles.errorUrl}>{config.SERVER_URL}</Text>
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => setHasError(false)}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <WebView
        ref={webviewRef}
        source={{ uri: config.SERVER_URL }}
        style={styles.webview}
        injectedJavaScript={INJECTED_JS}
        onLoadEnd={handleLoadEnd}
        onError={() => setHasError(true)}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          if (nativeEvent.statusCode >= 500) setHasError(true);
        }}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={handleNavRequest}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        allowsBackForwardNavigationGestures
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={styles.loaderText}>Loading CallGuard…</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  webview: {
    flex: 1,
    backgroundColor: C.bg,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  loaderText: {
    marginTop: 16,
    color: C.muted,
    fontSize: 15,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: C.text,
    marginBottom: 8,
  },
  errorBody: {
    fontSize: 14,
    color: C.muted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  errorUrl: {
    color: C.accent,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 13,
  },
  retryBtn: {
    backgroundColor: C.accent,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    color: C.bg,
    fontSize: 15,
    fontWeight: "600",
  },
});
