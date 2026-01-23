// 웹뷰/브라우저 환경 감지 유틸리티

export type BrowserEnvironment =
  | 'safari'
  | 'chrome'
  | 'kakao'
  | 'naver'
  | 'instagram'
  | 'facebook'
  | 'line'
  | 'webview'
  | 'standalone'
  | 'unknown';

export type DeviceOS = 'ios' | 'android' | 'unknown';

interface WebviewInfo {
  isWebview: boolean;
  isStandalone: boolean;
  browser: BrowserEnvironment;
  os: DeviceOS;
  needsPwaGuide: boolean;
}

// iOS 기기 감지
const isIOS = (): boolean => {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Android 기기 감지
const isAndroid = (): boolean => {
  return /Android/.test(navigator.userAgent);
};

// 디바이스 OS 감지
export const getDeviceOS = (): DeviceOS => {
  if (isIOS()) return 'ios';
  if (isAndroid()) return 'android';
  return 'unknown';
};

// 카카오톡 웹뷰 감지
const isKakaoWebview = (): boolean => {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('kakaotalk') || ua.includes('kakao');
};

// 네이버 웹뷰 감지
const isNaverWebview = (): boolean => {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('naver') || ua.includes('whale');
};

// 인스타그램 웹뷰 감지
const isInstagramWebview = (): boolean => {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('instagram');
};

// 페이스북 웹뷰 감지
const isFacebookWebview = (): boolean => {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('fban') || ua.includes('fbav') || ua.includes('facebook');
};

// 라인 웹뷰 감지
const isLineWebview = (): boolean => {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('line/');
};

// 일반 웹뷰 감지 (앱 내장 브라우저)
const isGenericWebview = (): boolean => {
  const ua = navigator.userAgent.toLowerCase();

  // iOS WebView 감지
  if (isIOS()) {
    // WKWebView 또는 UIWebView
    const safari = ua.match(/safari/i);
    const webkit = ua.match(/webkit/i);
    // Safari가 없고 WebKit만 있으면 웹뷰
    if (webkit && !safari) return true;
  }

  // Android WebView 감지
  if (isAndroid()) {
    // WebView 특성
    if (ua.includes('wv') || ua.includes('webview')) return true;
    // Chrome이 아닌 경우
    const chrome = ua.includes('chrome');
    const safari = ua.includes('safari');
    if (!chrome && safari) return true;
  }

  return false;
};

// 스탠드얼론 모드 감지 (이미 홈 화면에 추가됨)
const isStandalone = (): boolean => {
  // iOS Safari 스탠드얼론
  if ('standalone' in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone) {
    return true;
  }
  // Android Chrome 스탠드얼론
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  // TWA (Trusted Web Activity)
  if (document.referrer.includes('android-app://')) {
    return true;
  }
  return false;
};

// 브라우저 환경 감지
export const getBrowserEnvironment = (): BrowserEnvironment => {
  if (isStandalone()) return 'standalone';
  if (isKakaoWebview()) return 'kakao';
  if (isNaverWebview()) return 'naver';
  if (isInstagramWebview()) return 'instagram';
  if (isFacebookWebview()) return 'facebook';
  if (isLineWebview()) return 'line';
  if (isGenericWebview()) return 'webview';

  const ua = navigator.userAgent.toLowerCase();
  if (isIOS() && ua.includes('safari') && !ua.includes('crios')) return 'safari';
  if (ua.includes('chrome') || ua.includes('crios')) return 'chrome';

  return 'unknown';
};

// 종합 웹뷰 정보 반환
export const getWebviewInfo = (): WebviewInfo => {
  const browser = getBrowserEnvironment();
  const os = getDeviceOS();
  const standalone = isStandalone();

  // 웹뷰 여부
  const webviewBrowsers: BrowserEnvironment[] = ['kakao', 'naver', 'instagram', 'facebook', 'line', 'webview'];
  const isWebview = webviewBrowsers.includes(browser);

  // PWA 가이드 필요 여부
  // - 웹뷰에서 접속한 경우
  // - 아직 홈 화면에 추가하지 않은 경우
  // - iOS 또는 Android인 경우
  const needsPwaGuide = isWebview && !standalone && (os === 'ios' || os === 'android');

  return {
    isWebview,
    isStandalone: standalone,
    browser,
    os,
    needsPwaGuide
  };
};

// 브라우저 이름 반환
export const getBrowserName = (browser: BrowserEnvironment): string => {
  const names: Record<BrowserEnvironment, string> = {
    safari: 'Safari',
    chrome: 'Chrome',
    kakao: '카카오톡',
    naver: '네이버',
    instagram: '인스타그램',
    facebook: '페이스북',
    line: '라인',
    webview: '앱 내 브라우저',
    standalone: '홈 화면 앱',
    unknown: '브라우저'
  };
  return names[browser];
};

// 외부 브라우저로 열기 URL 생성
export const getExternalBrowserUrl = (): string => {
  return window.location.href;
};
