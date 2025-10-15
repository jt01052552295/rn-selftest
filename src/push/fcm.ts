import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';

const FCM_TOKEN_KEY = 'fcm_token';

/**
 * FCM 초기화 및 토큰 관리
 */
export async function initFcm(
  onTokenReceived: (token: string) => Promise<void>,
): Promise<() => void> {
  // 알림 권한 요청
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!enabled) {
    console.log('FCM 권한이 없습니다.');
    return () => {};
  }

  // 기존 토큰 확인
  const savedToken = await AsyncStorage.getItem(FCM_TOKEN_KEY);
  if (savedToken) {
    await onTokenReceived(savedToken);
  }

  // 새 토큰 발급 이벤트
  const unsubscribe = messaging().onTokenRefresh(async (token) => {
    console.log('FCM 토큰 갱신:', token);
    await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
    await onTokenReceived(token);
  });

  // 토큰 가져오기 (없으면 생성)
  const token = await messaging().getToken();
  console.log('FCM 토큰:', token);
  await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
  await onTokenReceived(token);

  return unsubscribe;
}

/**
 * 포그라운드 메시지 수신 리스너
 */
export function listenForegroundMessages(callback: (message: any) => void) {
  return messaging().onMessage(async (remoteMessage) => {
    console.log('포그라운드에서 메시지 수신:', remoteMessage);
    callback(remoteMessage);
    return remoteMessage;
  });
}

/**
 * 단말기에 저장된 FCM 토큰 삭제
 */
export async function deleteDeviceToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(FCM_TOKEN_KEY);
    // Firebase의 토큰 삭제는 불필요할 수 있지만,
    // 완전한 로그아웃을 위해 포함
    await messaging().deleteToken();
  } catch (error) {
    console.error('FCM 토큰 삭제 실패:', error);
  }
}
