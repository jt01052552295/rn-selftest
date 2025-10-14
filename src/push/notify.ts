import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * 알림 채널 및 초기화 설정
 */
export async function initNotifications() {
  // 알림 핸들러 설정
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true, // 추가
      shouldShowList: true, // 추가
    }),
  });

  // 안드로이드 알림 채널 생성
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '기본 알림',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  }

  // 알림 권한 요청
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * 로컬 알림을 표시하는 함수
 */
export async function showLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>,
) {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        data: data || {},
      },
      trigger: null, // null이면 즉시 표시
    });

    console.log('로컬 알림이 표시됨:', { id: notificationId, title, body });
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
