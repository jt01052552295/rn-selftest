// index.js (루트)
import 'expo-router/entry';

import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  setBackgroundMessageHandler as setBGHandlerMod,
} from '@react-native-firebase/messaging';
import { initNotifications, showLocalNotification } from './src/push/notify';

initNotifications();

const m = getMessaging(getApp());
setBGHandlerMod(m, async (remoteMessage) => {
  console.log('BG message:', remoteMessage);
  const title =
    remoteMessage.notification?.title || remoteMessage.data?.title || '알림';
  const body =
    remoteMessage.notification?.body || remoteMessage.data?.body || '';
  await showLocalNotification(title, body, remoteMessage.data);
});
