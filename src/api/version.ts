import { Platform } from 'react-native';
import { API } from '../../constants/app-config';

/**
 * 버전 체크 응답 타입
 */
export interface VersionCheckResponse {
  success: boolean;
  msg: string;
  data: {
    android: {
      ver: string;
      update: number; // 1: 선택, 2: 필수
      store: {
        app: string; // 앱 스토어 딥링크
        web: string; // 웹 스토어 URL
      };
    };
    ios: {
      ver: string;
      update: number; // 1: 선택, 2: 필수
      store: {
        app: string;
        web: string;
      };
    };
    message: string;
  };
}

/**
 * 버전 비교 함수
 * @param currentVer 현재 버전 (예: "1.0.0")
 * @param serverVer 서버 버전 (예: "1.0.1")
 * @returns 1: 업데이트 필요, 0: 같음, -1: 서버가 더 낮음
 */
export function compareVersions(currentVer: string, serverVer: string): number {
  const current = currentVer.split('.').map(Number);
  const server = serverVer.split('.').map(Number);

  for (let i = 0; i < Math.max(current.length, server.length); i++) {
    const c = current[i] || 0;
    const s = server[i] || 0;

    if (s > c) return 1; // 업데이트 필요
    if (s < c) return -1; // 서버가 더 낮음
  }

  return 0; // 같음
}

/**
 * 서버에서 앱 버전 정보 조회
 */
export async function checkAppVersion(): Promise<VersionCheckResponse> {
  try {
    const response = await fetch(API.APP_VERSION_CHECK, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: VersionCheckResponse = await response.json();
    return data;
  } catch (error) {
    console.error('버전 체크 에러:', error);
    throw error;
  }
}

/**
 * 현재 플랫폼의 버전 정보만 추출
 */
export function getPlatformVersionInfo(data: VersionCheckResponse) {
  const platformData =
    Platform.OS === 'android' ? data.data.android : data.data.ios;
  return {
    ...platformData,
    message: data.data.message,
  };
}
