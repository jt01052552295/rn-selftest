// index.js (루트)
import messaging from '@react-native-firebase/messaging';
import 'expo-router/entry';
import { initNotifications, showLocalNotification } from './src/push/notify';

initNotifications();

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('BG message:', remoteMessage);
  const title =
    remoteMessage.notification?.title || remoteMessage.data?.title || '알림';
  const body =
    remoteMessage.notification?.body || remoteMessage.data?.body || '';
  await showLocalNotification(title, body, remoteMessage.data);
});
