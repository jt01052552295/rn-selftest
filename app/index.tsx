import Ionicons from '@expo/vector-icons/Ionicons';
import NetInfo from '@react-native-community/netinfo';
import { useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import { useLastNotificationResponse } from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {
  API,
  BACK_BUTTON,
  BASE_URL,
  EXTERNAL_AUTH_DOMAINS,
  EXTERNAL_URL_PATTERN,
  INJECTED_JAVASCRIPT,
  LOADING_INDICATOR_COLOR,
  ORDER,
  PG_DOMAINS,
  UI_STYLE,
  USER_AGENTS,
  WEBVIEW_CONFIG,
  WEB_MESSAGE_TYPES,
} from '../constants/app-config';
import { registerFcmToken, revokeFcmToken } from '../src/api/fcm';
import {
  deleteDeviceToken,
  initFcm,
  listenForegroundMessages,
} from '../src/push/fcm';
import {
  clearLastNotificationUrl,
  getLastNotificationUrl,
  initNotifications,
  setUrlChangeHandler,
  showLocalNotification,
} from '../src/push/notify';

export default function WebViewScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  const autoLoginFiredRef = useRef(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  const lastNotificationResponse = useLastNotificationResponse();

  // 안전 영역 인셋 가져오기
  const insets = useSafeAreaInsets();

  // 플랫폼별 userAgent 설정
  const customUserAgent = Platform.select({
    ios: USER_AGENTS.IOS,
    android: USER_AGENTS.ANDROID,
    default: USER_AGENTS.DEFAULT,
  });

  const navigateToUrl = (url: string) => {
    console.log('WebView URL 변경 시도:', url);

    // URL이 유효한지 확인
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      console.error('유효하지 않은 URL:', url);
      return;
    }

    // 1. 상태 업데이트로 URL 변경
    setWebViewSource({ uri: url });

    // 2. WebView ref를 통해 직접 이동 시도 (더 확실한 방법)
    if (webViewRef.current) {
      console.log('WebView ref를 통해 직접 URL 변경 시도');

      // JavaScript를 통해 직접 location.href 변경 시도
      const jsCode = `
      (function() {
        console.log("WebView 내부에서 URL 변경 시도: ${url}");
        window.location.href = "${url}";
        true;
      })();
    `;
      webViewRef.current.injectJavaScript(jsCode);

      // 필요하다면 일정 시간 후 리로드 시도
      setTimeout(() => {
        if (webViewRef.current) {
          console.log('WebView 리로드 시도');
          webViewRef.current.reload();
        }
      }, WEBVIEW_CONFIG.RELOAD_TIMEOUT);
    }
  };

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

  // 네트워크 상태 감지
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      console.log('네트워크 연결 상태:', state.isConnected);
      setIsConnected(state.isConnected ?? true);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // fcm 등록
  useEffect(() => {
    let unsubRotate: null | (() => void) = null;
    let unsubFG: null | (() => void) = null;

    (async () => {
      unsubRotate = await initFcm(async (token) => {
        setFcmToken(token);
        if (isLoggedIn) {
          try {
            const r = await registerFcmToken(token);
            console.log('FCM register (init/rotate):', r);
          } catch (e) {
            console.log('FCM register error:', e);
          }
        }
      });

      // 포그라운드 수신
      unsubFG = listenForegroundMessages(async (msg) => {
        const title = msg.notification?.title || msg.data?.title || '알림';
        const body = msg.notification?.body || msg.data?.body || '';
        console.log('FG message:', msg);
        await showLocalNotification(title, body, msg.data);
      });
    })();

    return () => {
      if (typeof unsubRotate === 'function') unsubRotate();
      if (typeof unsubFG === 'function') unsubFG();
    };
  }, [isLoggedIn]);

  // 토큰으로 자동로그인 페이지 호출
  useEffect(() => {
    if (!isLoggedIn && fcmToken && !autoLoginFiredRef.current) {
      const url = `${API.AUTO_LOGIN}?fcm_token=${encodeURIComponent(fcmToken)}`;
      setWebViewSource({ uri: url }); // 네가 이미 가진 함수/상태
      console.log('Auto-login URL set:', url, fcmToken);
    }
  }, [fcmToken, isLoggedIn]);

  // lastNotificationResponse 변경 감지 및 처리 부분 수정
  useEffect(() => {
    if (lastNotificationResponse) {
      try {
        const data = lastNotificationResponse.notification.request.content.data;
        console.log('마지막 알림 응답 데이터:', data);

        if (data && data.targetUrl && typeof data.targetUrl === 'string') {
          console.log('마지막 알림의 targetUrl로 이동:', data.targetUrl);

          // 기존 setWebViewSource 대신 새로운 함수 사용
          navigateToUrl(data.targetUrl);
        }
      } catch (error) {
        console.error('알림 데이터 처리 중 오류:', error);
      }
    }
  }, [lastNotificationResponse]);

  // 알림 초기화 및 URL 핸들러 설정
  useEffect(() => {
    let notificationSubscription: any = null;

    // 앱 초기화 및 알림 설정
    async function setupApp() {
      try {
        console.log('앱 초기화 시작');

        // URL 변경 핸들러 설정 (알림 클릭 시 WebView URL 변경용)
        setUrlChangeHandler((url) => {
          console.log('알림에서 WebView URL 변경 요청:', url);
          navigateToUrl(url);
        });

        // expo-notifications 초기화 - 알림 응답 리스너 등록
        const result = await initNotifications();
        notificationSubscription = result.subscription;

        // 마지막으로 저장된 URL이 있는지 확인 (백그라운드에서 앱이 시작된 경우)
        const lastUrl = await getLastNotificationUrl();
        if (lastUrl) {
          console.log('저장된 알림 URL로 이동:', lastUrl);
          setWebViewSource({ uri: lastUrl });
          await clearLastNotificationUrl();
        }

        console.log('앱 초기화 완료');
      } catch (error) {
        console.error('앱 초기화 중 오류:', error);
      }
    }

    // 앱 초기화 실행
    setupApp();

    // 컴포넌트 언마운트 시 정리
    return () => {
      console.log('앱 정리 시작');
      setUrlChangeHandler(() => {});
      if (notificationSubscription) {
        notificationSubscription.remove();
      }
      console.log('앱 정리 완료');
    };
  }, []);

  const [webViewSource, setWebViewSource] = useState({
    uri: BASE_URL,
  });

  const isPgUrl = (url: string) => PG_DOMAINS.some((d) => url.includes(d));

  const [canGoBack, setCanGoBack] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(''); // 현재 URL 추적을 위한 상태 추가

  // URL이 외부 인증(네이버/카카오) URL인지 확인하는 함수
  const isExternalAuthUrl = (url: string) => {
    return EXTERNAL_AUTH_DOMAINS.some((domain) => url.includes(domain));
  };

  const onNavChange = (nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
    setCurrentUrl(nav.url);
    if (
      !nav.loading &&
      (isPgUrl(nav.url) ||
        nav.url.startsWith(ORDER.COMPLETE) ||
        nav.url.startsWith(ORDER.FAIL))
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

        Alert.alert(
          '알림',
          '확인을 누르면 앱이 종료됩니다.',
          [
            {
              text: '취소',
              onPress: () => {},
              style: 'cancel',
            },
            {
              text: '확인',
              onPress: () => BackHandler.exitApp(),
              style: 'destructive',
            },
          ],
          { cancelable: true },
        );
        return true; // 기본 동작을 막고 우리가 처리
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

      if (data.type === WEB_MESSAGE_TYPES.CONSOLE_LOG) {
        console.log('웹 콘솔:', data.log);
        return;
      } else if (data.type === WEB_MESSAGE_TYPES.CONSOLE_ERROR) {
        return;
      } else if (data.type === WEB_MESSAGE_TYPES.JS_ERROR) {
        return;
      }

      switch (data.type) {
        case WEB_MESSAGE_TYPES.OPEN_URL:
          if (data.url) Linking.openURL(data.url);
          break;
        case WEB_MESSAGE_TYPES.LOGIN_OK:
          setIsLoggedIn(true);
          if (fcmToken) {
            registerFcmToken(fcmToken)
              .then((r) => console.log('FCM register after LOGIN_OK:', r))
              .catch((e) => console.log('FCM register error:', e));
          }
          break;

        case WEB_MESSAGE_TYPES.LOGOUT_OK:
          setIsLoggedIn(false);
          if (fcmToken) {
            console.log('revokeFcmToken', fcmToken);
            revokeFcmToken(fcmToken)
              .then((r) => console.log('FCM revoke after LOGOUT_OK:', r))
              .catch((e) => console.log('FCM revoke error:', e));
            // 단말 FCM 토큰 삭제(모듈러 헬퍼)
            deleteDeviceToken().catch(() => {});
            setFcmToken(null);
          }
          break;
      }
    } catch (err) {
      console.log('메시지 처리 오류:', err);
    }
  };

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

    if (
      EXTERNAL_URL_PATTERN.test(url) ||
      url.includes('play.google.com/store')
    ) {
      openExternal(url);
      return false;
    }

    if (
      isPgUrl(url) ||
      url.startsWith(ORDER.COMPLETE) ||
      url.startsWith(ORDER.FAIL)
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

      {!isConnected ? (
        <View style={styles.noConnectionContainer}>
          <Ionicons
            name="cloud-offline-outline"
            size={80}
            color="#999"
            style={{ marginBottom: 20 }}
          />
          <Text style={styles.noConnectionTitle}>
            인터넷 연결이 끊어졌습니다.
          </Text>
          <Text style={styles.noConnectionText}>
            네트워크 연결을 확인하고{'\n'}다시 시도해주세요.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              NetInfo.fetch().then((state) => {
                setIsConnected(state.isConnected ?? true);
                if (state.isConnected) {
                  webViewRef.current?.reload();
                }
              });
            }}
          >
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : error ? (
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
            userAgent={customUserAgent}
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
                <Ionicons
                  name="chevron-back"
                  size={24}
                  color={BACK_BUTTON.ICON_COLOR}
                />
              </TouchableOpacity>
            )}
        </>
      )}

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={LOADING_INDICATOR_COLOR} />
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
    backgroundColor: UI_STYLE.LOADING_BG_COLOR,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: UI_STYLE.ERROR_TEXT_COLOR,
    textAlign: 'center',
  },
  noConnectionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#f5f5f5',
  },
  noConnectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  noConnectionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButtonTopLeft: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: BACK_BUTTON.BACKGROUND_COLOR,
    width: BACK_BUTTON.SIZE,
    height: BACK_BUTTON.SIZE,
    borderRadius: BACK_BUTTON.BORDER_RADIUS,
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
