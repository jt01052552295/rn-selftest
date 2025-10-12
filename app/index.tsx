import { useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  WebView,
  WebViewMessageEvent,
  WebViewNavigation,
} from 'react-native-webview';

export default function WebViewScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);

  // 안전 영역 인셋 가져오기
  const insets = useSafeAreaInsets();

  const [canGoBack, setCanGoBack] = useState(false);
  const onNavChange = (nav: WebViewNavigation) => setCanGoBack(nav.canGoBack);

  // 플랫폼별 userAgent 설정
  const customUserAgent = Platform.select({
    ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    android:
      'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Mobile Safari/537.36',
    default: 'Mozilla/5.0 Mobile',
  });

  // 권한 요청
  useEffect(() => {
    (async () => {
      try {
        const { status: locStatus } =
          await Location.requestForegroundPermissionsAsync();
        if (locStatus !== 'granted') {
          console.log('위치 권한 거부');
        }

        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });

        await MediaLibrary.requestPermissionsAsync();

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }
      } catch (e) {
        console.log('권한 요청 오류:', e);
      }
    })();
  }, []);

  // 안드로이드 뒤로가기 버튼 처리
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (webViewRef.current && canGoBack) {
          webViewRef.current.goBack();
          return true;
        }
        return false; // 루트면 기본 동작(앱 종료)
      };
      const sub = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );
      return () => sub.remove();
    }, [canGoBack]),
  );

  // 웹뷰에서 메시지 수신 처리
  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('웹에서 메시지 수신:', data);

      switch (data.type) {
        case 'OPEN_URL':
          if (data.url) Linking.openURL(data.url);
          break;
      }
    } catch (err) {
      console.log('메시지 처리 오류:', err);
    }
  };

  // 웹뷰에 주입할 자바스크립트 코드
  const INJECTED_JAVASCRIPT = `
    window.isInApp = true;
    window.sendToApp = function(data) {
      window.ReactNativeWebView.postMessage(JSON.stringify(data));
    };
    true;
  `;

  // iOS용 뒤로가기 버튼
  const [showBackButton, setShowBackButton] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      setShowBackButton(canGoBack);
    }
  }, [canGoBack]);

  const openExternal = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      // intent:// → https fallback
      if (url.startsWith('intent://')) {
        const https = url.replace(/^intent:\/\//, 'https://');
        try {
          await Linking.openURL(https);
        } catch {}
      }
      // market:// → 웹 스토어
      if (url.startsWith('market://')) {
        const web = url.replace(
          /^market:\/\//,
          'https://play.google.com/store/',
        );
        try {
          await Linking.openURL(web);
        } catch {}
      }
    }
  };
  // 웹뷰에서 외부 URL을 처리하는 함수
  const handleShouldStartLoad = (req: WebViewNavigation) => {
    const { url = '' } = req;

    // 네이버, 카카오 로그인 URL은 WebView 내에서 처리
    if (
      url.includes('nid.naver.com') ||
      url.includes('accounts.kakao.com') ||
      url.includes('kauth.kakao.com')
    ) {
      return true;
    }

    const external =
      /^(tel:|mailto:|sms:|intent:|market:|kakaotalk:|kakaolink:|supertoss:|tdirectsdk:|ispmobile:|kftc-bankpay:|naversearchapp:|navercafe:)/i;
    if (external.test(url) || url.includes('play.google.com/store')) {
      openExternal(url);
      return false;
    }
    return true;
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <StatusBar style="dark" backgroundColor="#FFFFFF" translucent={false} />

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            연결 오류가 발생했습니다. 다시 시도해주세요.
          </Text>
        </View>
      ) : (
        <>
          <WebView
            ref={webViewRef}
            source={{ uri: 'https://selftest.webin.co.kr' }}
            style={styles.webview}
            onLoadStart={() => setIsLoading(true)}
            onLoad={() => setIsLoading(false)}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              setError(nativeEvent.description);
              setIsLoading(false);
            }}
            onMessage={handleMessage}
            injectedJavaScript={INJECTED_JAVASCRIPT}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            onNavigationStateChange={onNavChange}
            setSupportMultipleWindows={false}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            geolocationEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            originWhitelist={['*']}
            cacheEnabled={true}
            userAgent={customUserAgent}
            sharedCookiesEnabled={true}
            thirdPartyCookiesEnabled={true}
            mixedContentMode="compatibility"
            onFileDownload={({ nativeEvent }) => {
              const { downloadUrl } = nativeEvent;
              Linking.openURL(downloadUrl).catch(() => {});
            }}
            pullToRefreshEnabled={true}
            overScrollMode="always"
            onRenderProcessGone={() => {
              // 가벼운 복구: 동일 URL 재로딩
              webViewRef.current?.reload();
            }}
            onHttpError={(e) => {
              console.log(
                'HTTP error',
                e.nativeEvent.statusCode,
                e.nativeEvent.description,
              );
            }}
          />
          {/* iOS용 뒤로가기 버튼 */}
          {Platform.OS === 'ios' && showBackButton && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => webViewRef.current?.goBack()}
            >
              <Text style={styles.backButtonText}>← 뒤로</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
  },
  backButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
