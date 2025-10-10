import { useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';

export default function WebViewScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);
  
  // 안전 영역 인셋 가져오기
  const insets = useSafeAreaInsets();


  // 플랫폼별 userAgent 설정
  const customUserAgent = Platform.select({
    ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    android: 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Mobile Safari/537.36',
    default: 'Mozilla/5.0 Mobile'
  });

  
  // 권한 요청
  useEffect(() => {
  (async () => {
    try {
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
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
        await Notifications.requestPermissionsAsync();
        // 안드 채널 생성 (중요)
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
        if (webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }
        return false;
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => backHandler.remove();
    }, [])
  );

  // 웹뷰에서 메시지 수신 처리
  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('웹에서 메시지 수신:', data);
      
      switch(data.type) {
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

  // 웹뷰에서 외부 URL을 처리하는 함수
  const handleShouldStartLoad = (request: WebViewNavigation) => {
    const { url } = request;
    console.log('URL 요청:', url); // 디버깅용 로그
    
    // 기본 URL 스킴 처리 (tel, mailto, sms 등)
    if (url.startsWith('tel:') || 
        url.startsWith('mailto:') || 
        url.startsWith('sms:')) {
      Linking.openURL(url);
      return false; // 웹뷰에서는 처리하지 않음
    }
    
    // 앱 스킴 처리 (특정 앱으로 연결되는 URL)
    if (url.startsWith('market://') || 
        url.startsWith('intent://') || 
        url.includes('play.google.com/store')) {
      Linking.openURL(url);
      return false; // 웹뷰에서는 처리하지 않음
    }
    
    // 카카오 로그인 처리
    if (url.includes('kakao.com/oauth') || 
        url.includes('kakaoapi.com') ||
        url.startsWith('kakaolink://') || 
        url.startsWith('kakaotalk://')) {
      
      // kakaolink, kakaotalk 스킴은 앱으로 열기
      if (url.startsWith('kakaolink://') || url.startsWith('kakaotalk://')) {
        Linking.openURL(url).catch(() => {
          // 앱이 없는 경우 웹으로 대체
          console.log('카카오 앱을 열지 못했습니다.');
        });
        return false;
      }
      
      // 나머지 카카오 OAuth 처리는 웹뷰 내에서
      return true;
    }
    
    // 네이버 로그인 처리
    if (url.includes('naver.com/oauth') || 
        url.includes('nid.naver.com') ||
        url.startsWith('naversearchapp://') || 
        url.startsWith('navercafe://')) {
      
      // 네이버 앱 스킴은 앱으로 열기
      if (url.startsWith('naversearchapp://') || url.startsWith('navercafe://')) {
        Linking.openURL(url).catch(() => {
          console.log('네이버 앱을 열지 못했습니다.');
        });
        return false;
      }
      
      // 나머지 네이버 OAuth 처리는 웹뷰 내에서
      return true;
    }
    
    // 포트원/토스페이 결제 처리
    if (url.includes('tosspayments.com') || 
        url.includes('portone.io') ||
        url.includes('iamport.kr') ||
        url.startsWith('supertoss://') ||
        url.startsWith('tdirectsdk://') ||
        url.startsWith('ispmobile://')) {
      
      // 결제 앱 스킴은 외부 앱으로 열기
      if (url.startsWith('supertoss://') || 
          url.startsWith('tdirectsdk://') || 
          url.startsWith('ispmobile://') ||
          url.startsWith('kftc-bankpay://')) {
        Linking.openURL(url).catch(() => {
          console.log('결제 앱을 열지 못했습니다.');
        });
        return false;
      }
      
      // 나머지 결제 프로세스는 웹뷰 내에서
      return true;
    }
    
    // HTTP/HTTPS URL은 기본적으로 웹뷰에서 처리
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // 현재 도메인 체크 (필요한 경우)
      const baseUrl = 'selftest.webin.co.kr';
      
      // 현재 도메인이 아닌 외부 링크를 어떻게 처리할지 결정
      // 여기서는 모두 웹뷰로 열도록 설정
      return true;
    }
    
    // 기타 알 수 없는 스킴은 시스템에 위임 (앱 실행 시도)
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        console.log('URL을 처리할 수 없습니다:', url);
      }
    });
    
    // 기본적으로 웹뷰에서 열지 않음
    return false;
  };

  return (
    <View 
      style={[
        styles.container,
        { 
          paddingTop: insets.top, 
          paddingBottom: insets.bottom
        }
      ]}
    >
      <StatusBar style="auto" />
      
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            연결 오류가 발생했습니다. 다시 시도해주세요.
          </Text>
        </View>
      ) : (
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
        />
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
});