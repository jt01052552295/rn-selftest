/**
 * 앱 전체에서 사용되는 상수값들을 관리하는 파일
 * URL, 도메인, 설정값 등 앱 전역에서 사용되는 상수들이 정의되어 있습니다.
 */

// ===== URL 관련 상수 =====
// 기본 도메인 URL
export const BASE_URL = 'https://selftest.webin.co.kr';

// API 관련 URL
export const API = {
  AUTO_LOGIN: `${BASE_URL}/api/fcm/auto_login.php`,
  REGISTER: `${BASE_URL}/api/fcm/register.php`,
  REVOKE: `${BASE_URL}/api/fcm/revoke.php`,
};

// 결제 관련 URL
export const ORDER = {
  // 결제 완료 URL
  COMPLETE: `${BASE_URL}/order/complete.php`,
  // 결제 실패 URL
  FAIL: `${BASE_URL}/order/fail.php`,
};

// 결제 게이트웨이 도메인 목록
export const PG_DOMAINS = [
  'payment-gateway.tosspayments.com',
  'payment-gateway-sandbox.tosspayments.com',
  'tosspayments.com',
];

// 외부 인증 도메인 목록
export const EXTERNAL_AUTH_DOMAINS = [
  'nid.naver.com', // 네이버 로그인
  'accounts.kakao.com', // 카카오 로그인
  'kauth.kakao.com', // 카카오 인증
  'accounts.google.com', // 구글 로그인
  'appleid.apple.com', // 애플 로그인
  'idmsa.apple.com', // 애플 인증 관련
  'auth.apple.com', // 애플 인증 관련
];

// ===== 앱 설정 관련 상수 =====
// 웹뷰 설정 관련 상수
export const WEBVIEW_CONFIG = {
  // 웹뷰 리로드 타임아웃 (ms)
  RELOAD_TIMEOUT: 300,
};

// 플랫폼별 사용자 에이전트
export const USER_AGENTS = {
  IOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  ANDROID:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Mobile Safari/537.36',
  DEFAULT: 'Mozilla/5.0 Mobile',
};

// 외부 스키마 패턴 (Linking으로 열어야 하는 URL 패턴)
export const EXTERNAL_URL_PATTERN =
  /^(tel:|mailto:|sms:|intent:|market:|kakaotalk:|kakaolink:|supertoss:|tdirectsdk:|ispmobile:|kftc-bankpay:|naversearchapp:|navercafe:)/i;

// ===== 스타일 관련 상수 =====
// 로딩 표시기 색상
export const LOADING_INDICATOR_COLOR = '#11412D';

// 뒤로가기 버튼 스타일 상수
export const BACK_BUTTON = {
  BACKGROUND_COLOR: '#555',
  SIZE: 40,
  BORDER_RADIUS: 20,
  ICON_COLOR: '#fff',
};

// 특정 로그인 페이지에 스타일 추가 부분을 동적으로 생성
const authDomainsStr = JSON.stringify(EXTERNAL_AUTH_DOMAINS).replace(/"/g, "'");
const pgDomainsStr = JSON.stringify(PG_DOMAINS).replace(/"/g, "'");

export const INJECTED_JAVASCRIPT = `
    // 원래 콘솔 메서드 저장
      const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info
      };

    // 콘솔 메서드 오버라이드
    console.log = function() {
      originalConsole.log.apply(console, arguments);
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'CONSOLE_LOG',
        log: Array.from(arguments).map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ')
      }));
    };
    
    console.error = function() {
      originalConsole.error.apply(console, arguments);
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'CONSOLE_ERROR',
        log: Array.from(arguments).map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ')
      }));
    };

    window.onerror = function(message, source, lineno, colno, error) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'JS_ERROR',
        error: { message, source, lineno, colno }
      }));
      return true;
    };

    window.isInApp = true;
    window.sendToApp = function(data) {
      window.ReactNativeWebView.postMessage(JSON.stringify(data));
    };
  
  // 화면 크기 조정을 위한 meta 태그 추가
  (function() {
    var meta = document.createElement('meta');
    meta.setAttribute('name', 'viewport');
    meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    document.getElementsByTagName('head')[0].appendChild(meta);
    
    // 특정 로그인 페이지에 스타일 추가
    const authDomains = ${authDomainsStr};
    const pgDomains = ${pgDomainsStr};
    
    const isAuthOrPgPage = () => {
      const url = window.location.href;
      return authDomains.some(domain => url.includes(domain)) || 
             pgDomains.some(domain => url.includes(domain));
    }
    
    if (isAuthOrPgPage()) {
      var styleElement = document.createElement('style');
      styleElement.textContent = 'body { width: 100%; overflow-x: hidden; } div { max-width: 100%; }';
      document.head.appendChild(styleElement);
    }

    // 파일 입력 필드 이벤트 모니터링
      document.addEventListener('click', function(e) {
        // 파일 입력 버튼 관련 요소 클릭 감지
        if (e.target && (e.target.type === 'file' || 
            e.target.closest('input[type="file"]') ||
            e.target.getAttribute('role') === 'button' && e.target.closest('[data-role="upload"]'))) {
          console.log('파일 입력 요소 클릭됨:', e.target);
        }
      }, true);

      // 이미지 업로드 실패 확인을 위한 MutationObserver 설정
      const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList' && mutation.addedNodes.length) {
            const errorMessages = document.querySelectorAll('.error-message, .upload-error, [class*="error"]');
            if (errorMessages.length) {
              Array.from(errorMessages).forEach(el => {
                if (el.offsetParent !== null) { // 화면에 표시된 요소만
                  console.error('업로드 오류 메시지 발견:', el.textContent, el.className);
                }
              });
            }
          }
        }
      });
      
      observer.observe(document.body, { childList: true, subtree: true });
    

  })();
`;

// 웹뷰 메시지 이벤트 타입
export const WEB_MESSAGE_TYPES = {
  OPEN_URL: 'OPEN_URL',
  LOGIN_OK: 'LOGIN_OK',
  LOGOUT_OK: 'LOGOUT_OK',
  CONSOLE_LOG: 'CONSOLE_LOG',
  CONSOLE_ERROR: 'CONSOLE_ERROR',
  JS_ERROR: 'JS_ERROR',
};

export const UI_STYLE = {
  LOADING_BG_COLOR: 'rgba(255, 255, 255, 0.8)',
  ERROR_TEXT_COLOR: 'red',
};
