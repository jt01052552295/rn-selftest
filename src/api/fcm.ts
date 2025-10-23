import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { API } from '../../constants/app-config';
import { getUniqueDeviceId } from '../utils/devices';

export async function registerFcmToken(token: string) {
  const payload = {
    token,
    device_info: {
      model: Device.modelName ?? 'unknown',
      os: Platform.OS,
      osVersion: String(Platform.Version),
      deviceId: await getUniqueDeviceId(),
      appVersion: '1.0.0',
    },
  };

  const res = await fetch(`${API.REGISTER}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // 세션 인증은 WebView(쿠키)에서 처리 → 이 API는 서버 세션 없으면 거부됨(정상)
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function revokeFcmToken(token: string) {
  const res = await fetch(`${API.REVOKE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return res.json();
}
