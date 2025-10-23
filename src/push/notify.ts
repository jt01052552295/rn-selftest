import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// 마지막 알림 저장 키
const LAST_NOTIFICATION_KEY = 'last_clicked_notification';

// URL 변경을 위한 글로벌 콜백 함수
let urlChangeCallback: ((url: string) => void) | null = null;

// 이전에 등록된 알림 응답 구독
let previousResponseListener: { remove: () => void } | null = null;

/**
 * URL 변경 콜백 함수 설정
 */
export function setUrlChangeHandler(callback: (url: string) => void) {
  urlChangeCallback = callback;
}

/**
 * URL 변경 처리 (WebView 소스 변경)
 * 모든 시나리오에서 동일하게 작동하도록 통합된 메소드
 */
export function handleUrlChange(url: string) {
  console.log('알림 URL 처리:', url);

  // 1. AsyncStorage에 저장 (앱 재시작시 필요)
  saveLastNotificationUrl(url);

  // 2. 콜백 호출 (포그라운드에서 필요)
  if (urlChangeCallback) {
    console.log('URL 변경 콜백 호출:', url);
    urlChangeCallback(url);
  } else {
    console.log('URL 변경 콜백이 설정되지 않음');
  }
}

/**
 * 마지막으로 클릭한 알림의 targetUrl 저장
 */
export async function saveLastNotificationUrl(url: string) {
  try {
    if (!url) return;
    console.log('알림 URL 저장:', url);
    await AsyncStorage.setItem(LAST_NOTIFICATION_KEY, url);
  } catch (error) {
    console.error('알림 URL 저장 실패:', error);
  }
}

/**
 * 마지막으로 클릭한 알림의 targetUrl 가져오기
 */
export async function getLastNotificationUrl(): Promise<string | null> {
  try {
    const url = await AsyncStorage.getItem(LAST_NOTIFICATION_KEY);
    console.log('저장된 알림 URL 불러옴:', url);
    return url;
  } catch (error) {
    console.error('알림 URL 불러오기 실패:', error);
    return null;
  }
}

/**
 * 마지막 알림 URL 정보 초기화
 */
export async function clearLastNotificationUrl(): Promise<void> {
  try {
    console.log('알림 URL 삭제');
    await AsyncStorage.removeItem(LAST_NOTIFICATION_KEY);
  } catch (error) {
    console.error('알림 URL 삭제 실패:', error);
  }
}

/**
 * 알림 채널 및 초기화 설정
 */
export async function initNotifications() {
  try {
    // 기존 리스너가 있으면 제거 (중복 리스너 방지)
    if (previousResponseListener) {
      console.log('기존 알림 리스너 제거');
      previousResponseListener.remove();
      previousResponseListener = null;
    }

    // 알림 핸들러 설정
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    // 알림 응답 리스너 설정 - 알림 클릭 시 호출됨
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        try {
          const data = response.notification.request.content.data;
          console.log('알림 클릭 시 호출:', data);

          // targetUrl이 있으면 WebView에서 해당 URL 열기
          if (data && data.targetUrl && typeof data.targetUrl === 'string') {
            console.log('알림의 targetUrl로 이동:', data.targetUrl);

            // URL을 AsyncStorage에 저장 (앱이 백그라운드에서 시작될 때 사용)
            saveLastNotificationUrl(data.targetUrl);

            // 등록된 콜백 함수가 있으면 호출 (앱이 포그라운드일 때 사용)
            if (urlChangeCallback) {
              console.log('URL 변경 콜백 호출 중...', data.targetUrl);
              urlChangeCallback(data.targetUrl);
            } else {
              console.log('URL 변경 콜백이 없음, AsyncStorage에만 저장됨');
            }
          } else {
            console.log('알림에 targetUrl이 없음:', data);
          }
        } catch (error) {
          console.error('알림 응답 처리 중 오류:', error);
        }
      },
    );

    // 나중에 제거할 수 있도록 구독 객체 저장
    previousResponseListener = subscription;

    // 안드로이드 알림 채널 생성
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: '기본 알림',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
        showBadge: true,
        enableLights: true,
        enableVibrate: true,
      });
    }

    // 알림 권한 요청
    const { status } = await Notifications.requestPermissionsAsync();
    console.log('알림 권한 상태:', status);

    return { granted: status === 'granted', subscription };
  } catch (error) {
    console.error('알림 초기화 중 오류:', error);
    return { granted: false, subscription: null };
  }
}

/**
 * 로컬 알림을 표시하는 함수
 * 포그라운드에서 즉시 WebView URL을 변경할 수 있는 옵션 추가
 */
export async function showLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>,
  changeUrlImmediately: boolean = false,
) {
  try {
    // 즉시 URL 변경 처리 (포그라운드에서 사용)
    if (
      changeUrlImmediately &&
      data?.targetUrl &&
      typeof data.targetUrl === 'string'
    ) {
      console.log('포그라운드 메시지의 URL 즉시 변경:', data.targetUrl);
      handleUrlChange(data.targetUrl);
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        data: data || {},
      },
      trigger: null, // null이면 즉시 표시
    });

    console.log('로컬 알림이 표시됨:', {
      id: notificationId,
      title,
      body,
      data,
    });
    return notificationId;
  } catch (error) {
    console.error('알림 표시 중 오류 발생:', error);
    return null;
  }
}

/**
 * 특정 알림 취소
 */
export async function cancelNotification(notificationId: string) {
  await Notifications.dismissNotificationAsync(notificationId);
}

/**
 * 모든 알림 취소
 */
export async function cancelAllNotifications() {
  await Notifications.dismissAllNotificationsAsync();
}
