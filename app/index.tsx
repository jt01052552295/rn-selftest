import Ionicons from '@expo/vector-icons/Ionicons';
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
  Keyboard,
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
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // 안전 영역 인셋 가져오기
  const insets = useSafeAreaInsets();

  // 키보드 이벤트 리스너 설정
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      },
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      },
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const [webViewSource, setWebViewSource] = useState({
    uri: 'https://selftest.webin.co.kr',
  });

  const PG_DOMAINS = [
    'payment-gateway.tosspayments.com',
    'payment-gateway-sandbox.tosspayments.com',
    'tosspayments.com',
  ];
  const RETURN_OK = 'https://selftest.webin.co.kr/order/complete.php';
  const RETURN_FAIL = 'https://selftest.webin.co.kr/order/fail.php';

  const isPgUrl = (url: string) => PG_DOMAINS.some((d) => url.includes(d));

  const [canGoBack, setCanGoBack] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(''); // 현재 URL 추적을 위한 상태 추가

  // URL이 외부 인증(네이버/카카오) URL인지 확인하는 함수
  const isExternalAuthUrl = (url: string) => {
    return (
      url.includes('nid.naver.com') ||
      url.includes('accounts.kakao.com') ||
      url.includes('kauth.kakao.com')
    );
  };

  const onNavChange = (nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
    setCurrentUrl(nav.url);
    if (
      !nav.loading &&
      (isPgUrl(nav.url) ||
        nav.url.startsWith(RETURN_OK) ||
        nav.url.startsWith(RETURN_FAIL))
    ) {
      setIsLoading(false);
    }
  };

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

      if (data.type === 'CONSOLE_LOG') {
        console.log('웹 콘솔:', data.log);
        return;
      } else if (data.type === 'CONSOLE_ERROR') {
        console.error('웹 콘솔 에러:', data.log);
        return;
      } else if (data.type === 'JS_ERROR') {
        console.error('웹 JS 에러:', data.error);
        return;
      }

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

    // 원래 콘솔 메서드 저장
      const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info
      };

    // 콘솔 메서드 오버라이드
    console.log = function() {
      originalConsole.log.apply(console, arguments);
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'CONSOLE_LOG',
        log: Array.from(arguments).map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ')
      }));
    };
    
    console.error = function() {
      originalConsole.error.apply(console, arguments);
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'CONSOLE_ERROR',
        log: Array.from(arguments).map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ')
      }));
    };

    window.onerror = function(message, source, lineno, colno, error) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'JS_ERROR',
        error: { message, source, lineno, colno }
      }));
      return true;
    };

    window.isInApp = true;
    window.sendToApp = function(data) {
      window.ReactNativeWebView.postMessage(JSON.stringify(data));
    };
    
    // 화면 크기 조정을 위한 meta 태그 추가
    (function() {
      var meta = document.createElement('meta');
      meta.setAttribute('name', 'viewport');
      meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      document.getElementsByTagName('head')[0].appendChild(meta);
      
      // 특정 로그인 페이지에 스타일 추가
      if (window.location.href.includes('nid.naver.com') || 
          window.location.href.includes('accounts.kakao.com') ||
          window.location.href.includes('kauth.kakao.com') || 
          window.location.href.includes('payment-gateway-sandbox.tosspayments.com') ||
          window.location.href.includes('payment-gateway.tosspayments.com')) {
        var styleElement = document.createElement('style');
        styleElement.textContent = 'body { width: 100%; overflow-x: hidden; } div { max-width: 100%; }';
        document.head.appendChild(styleElement);
      }

      // 파일 입력 필드 이벤트 모니터링
      document.addEventListener('click', function(e) {
        // 파일 입력 버튼 관련 요소 클릭 감지
        if (e.target && (e.target.type === 'file' || 
            e.target.closest('input[type="file"]') ||
            e.target.getAttribute('role') === 'button' && e.target.closest('[data-role="upload"]'))) {
          console.log('파일 입력 요소 클릭됨:', e.target);
        }
      }, true);

      // 이미지 업로드 실패 확인을 위한 MutationObserver 설정
      const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList' && mutation.addedNodes.length) {
            const errorMessages = document.querySelectorAll('.error-message, .upload-error, [class*="error"]');
            if (errorMessages.length) {
              Array.from(errorMessages).forEach(el => {
                if (el.offsetParent !== null) { // 화면에 표시된 요소만
                  console.error('업로드 오류 메시지 발견:', el.textContent, el.className);
                }
              });
            }
          }
        }
      });
      
      observer.observe(document.body, { childList: true, subtree: true });


    })();
    true;
  `;

  const showBackButton = canGoBack && isExternalAuthUrl(currentUrl);

  const handleIntentUrl = async (url: string) => {
    // intent:// 스킴 처리
    const pkg = (url.split(';package=')[1] || '').split(';')[0];
    // 1) 바로 열기(일부 단말은 intent:// 그대로 지원)
    if (await Linking.canOpenURL(url)) return Linking.openURL(url);
    // 2) scheme 치환 시도
    const scheme = (url.split('scheme=')[1] || '').split(';')[0];
    const data = (url.split('intent://')[1] || '').split('#')[0];
    if (scheme) {
      const tryUrl = `${scheme}://${data}`;
      if (await Linking.canOpenURL(tryUrl)) return Linking.openURL(tryUrl);
    }
    // 3) 마켓 이동
    if (pkg) return Linking.openURL(`market://details?id=${pkg}`);
  };

  const openExternal = async (url: string) => {
    try {
      if (url.startsWith('intent://')) return handleIntentUrl(url);
      if (await Linking.canOpenURL(url)) return Linking.openURL(url);
      if (url.startsWith('market://'))
        return Linking.openURL(
          url.replace(/^market:\/\//, 'https://play.google.com/store/'),
        );
    } catch {}
  };

  // 웹뷰에서 외부 URL을 처리하는 함수
  const handleShouldStartLoad = (req: WebViewNavigation) => {
    const { url = '' } = req;

    // 네이버, 카카오 로그인 URL은 WebView 내에서 처리
    if (isExternalAuthUrl(url)) {
      setIsLoading(true);
      return true;
    }

    const external =
      /^(tel:|mailto:|sms:|intent:|market:|kakaotalk:|kakaolink:|supertoss:|tdirectsdk:|ispmobile:|kftc-bankpay:|naversearchapp:|navercafe:)/i;
    if (external.test(url) || url.includes('play.google.com/store')) {
      openExternal(url);
      return false;
    }

    if (
      isPgUrl(url) ||
      url.startsWith(RETURN_OK) ||
      url.startsWith(RETURN_FAIL)
    ) {
      setIsLoading(true);
    }
    return true;
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          paddingBottom: keyboardVisible ? 0 : insets.bottom,
        },
      ]}
    >
      <StatusBar style="light" />

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
            source={webViewSource}
            style={styles.webview}
            onLoadStart={() => setIsLoading(true)}
            onLoad={() => setIsLoading(false)}
            onLoadEnd={() => setIsLoading(false)}
            onLoadProgress={({ nativeEvent }) => {
              if (nativeEvent.progress === 1) setIsLoading(false);
            }}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              setError(nativeEvent.description);
              setIsLoading(false);
            }}
            onMessage={handleMessage}
            injectedJavaScript={INJECTED_JAVASCRIPT}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            onNavigationStateChange={onNavChange}
            setSupportMultipleWindows={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            geolocationEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            originWhitelist={['*']}
            cacheEnabled={false}
            sharedCookiesEnabled={true}
            thirdPartyCookiesEnabled={true}
            mixedContentMode="always"
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
            // 화면 비율 조정을 위한 추가 설정
            scalesPageToFit={true}
            automaticallyAdjustContentInsets={true}
            keyboardDisplayRequiresUserAction={false} // iOS에서 키보드 자동 표시 허용
            // 파일 업로드 관련 속성들 추가
            allowFileAccess={true}
            allowingReadAccessToURL={'*'}
            allowFileAccessFromFileURLs={true}
            allowUniversalAccessFromFileURLs={true}
            incognito={false}
            // 디버깅 속성
            onContentProcessDidTerminate={() => {
              console.log('WebView 프로세스가 종료됨, 재로딩 시도');
              webViewRef.current?.reload();
            }}
          />
          {/* iOS용 뒤로가기 버튼 */}
          {(Platform.OS === 'ios' || Platform.OS === 'android') &&
            showBackButton &&
            !keyboardVisible && (
              <TouchableOpacity
                style={[
                  styles.backButtonTopLeft,
                  {
                    top: insets.top + 5,
                  },
                ]}
                onPress={() => {
                  webViewRef.current?.goBack();
                }}
              >
                <Ionicons name="chevron-back" size={24} color="#fff" />
              </TouchableOpacity>
            )}
        </>
      )}

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#11412D" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  backButtonTopLeft: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#555',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 4, // Android 그림자
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
});
