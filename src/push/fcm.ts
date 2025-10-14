// src/push/fcm.ts
import { getApp } from '@react-native-firebase/app';
import {
  AuthorizationStatus,
  deleteToken as deleteTokenMod,
  getMessaging,
  getToken as getTokenMod,
  onMessage as onMessageMod,
  onTokenRefresh as onTokenRefreshMod,
  requestPermission,
} from '@react-native-firebase/messaging';

const app = getApp();
const m = getMessaging(app);

export async function requestNotifPermission() {
  const status = await requestPermission(m);
  return (
    status === AuthorizationStatus.AUTHORIZED ||
    status === AuthorizationStatus.PROVISIONAL
  );
}

export async function initFcm(onToken: (t: string) => void) {
  const ok = await requestNotifPermission();
  if (!ok) {
    console.log('알림 권한 미허용');
    return () => {};
  }
  const token = await getTokenMod(m);
  if (token) onToken(token);
  const unsub = onTokenRefreshMod(m, onToken);
  return () => unsub();
}

export function listenForegroundMessages(
  handler: (msg: any) => Promise<void> | void,
) {
  return onMessageMod(m, handler);
}

export async function deleteDeviceToken() {
  try {
    await deleteTokenMod(m);
  } catch {}
}
