import { getAnalytics, logEvent, isSupported } from 'firebase/analytics';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import app from '../lib/firebase';
import { APP_VERSION } from '../config/version';

// Analytics 인스턴스
let analytics: ReturnType<typeof getAnalytics> | null = null;

// Analytics 초기화
const initAnalytics = async () => {
  if (analytics) return analytics;

  const supported = await isSupported();
  if (supported) {
    analytics = getAnalytics(app);
  }
  return analytics;
};

// 에러 타입 정의
export interface ErrorReport {
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  userAgent: string;
  timestamp: Date;
  appVersion: string;
  userId?: string;
  userRole?: 'admin' | 'student' | 'parent';
  additionalInfo?: Record<string, unknown>;
  errorType: 'javascript' | 'react' | 'network' | 'promise' | 'custom';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// undefined 값 제거 헬퍼
const removeUndefined = (obj: Record<string, unknown>): Record<string, unknown> => {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  );
};

// Firestore에 에러 저장
const saveErrorToFirestore = async (error: ErrorReport) => {
  try {
    const errorsRef = collection(db, 'errorLogs');
    // undefined 값 제거 (Firestore는 undefined를 허용하지 않음)
    const cleanedError = removeUndefined(error as unknown as Record<string, unknown>);
    await addDoc(errorsRef, {
      ...cleanedError,
      timestamp: serverTimestamp(),
    });
  } catch (e) {
    console.error('Failed to save error to Firestore:', e);
  }
};

// Analytics에 에러 이벤트 로깅
const logErrorToAnalytics = async (error: ErrorReport) => {
  try {
    const analyticsInstance = await initAnalytics();
    if (analyticsInstance) {
      logEvent(analyticsInstance, 'exception', {
        description: error.message.slice(0, 100),
        fatal: error.severity === 'critical',
        error_type: error.errorType,
        app_version: error.appVersion,
        page_url: error.url,
      });
    }
  } catch (e) {
    console.error('Failed to log error to Analytics:', e);
  }
};

// 에러 심각도 결정
const determineSeverity = (error: Error | string): ErrorReport['severity'] => {
  const message = typeof error === 'string' ? error : error.message;

  // Critical: 앱이 작동하지 않는 에러
  if (message.includes('ChunkLoadError') ||
      message.includes('Loading chunk') ||
      message.includes('Failed to fetch dynamically imported module')) {
    return 'critical';
  }

  // High: 주요 기능에 영향을 주는 에러
  if (message.includes('Firebase') ||
      message.includes('auth') ||
      message.includes('Firestore')) {
    return 'high';
  }

  // Medium: 일부 기능에 영향
  if (message.includes('TypeError') || message.includes('ReferenceError')) {
    return 'medium';
  }

  return 'low';
};

// 메인 에러 추적 함수
export const trackError = async (
  error: Error | string,
  options: {
    errorType?: ErrorReport['errorType'];
    componentStack?: string;
    userId?: string;
    userRole?: 'admin' | 'student' | 'parent';
    additionalInfo?: Record<string, unknown>;
  } = {}
) => {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorStack = typeof error === 'string' ? undefined : error.stack;

  const report: ErrorReport = {
    message: errorMessage,
    stack: errorStack,
    componentStack: options.componentStack,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date(),
    appVersion: APP_VERSION,
    userId: options.userId,
    userRole: options.userRole,
    additionalInfo: options.additionalInfo,
    errorType: options.errorType || 'javascript',
    severity: determineSeverity(error),
  };

  // 콘솔에 에러 로깅 (개발용)
  console.error('[ErrorTracking]', report);

  // Firestore와 Analytics에 병렬로 저장
  await Promise.all([
    saveErrorToFirestore(report),
    logErrorToAnalytics(report),
  ]);

  return report;
};

// 전역 에러 핸들러 설정
export const setupGlobalErrorHandlers = (getUserInfo?: () => { userId?: string; userRole?: 'admin' | 'student' | 'parent' }) => {
  // JavaScript 에러 핸들러
  window.onerror = (message, source, lineno, colno, error) => {
    const userInfo = getUserInfo?.() || {};
    trackError(error || String(message), {
      errorType: 'javascript',
      additionalInfo: { source, lineno, colno },
      ...userInfo,
    });
    return false; // 기본 에러 처리도 허용
  };

  // Promise rejection 핸들러
  window.onunhandledrejection = (event) => {
    const userInfo = getUserInfo?.() || {};
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));

    trackError(error, {
      errorType: 'promise',
      ...userInfo,
    });
  };

  // 네트워크 에러 감지 (fetch 래핑) - 비활성화
  // Firebase SDK가 내부적으로 fetch를 사용하므로 래핑하면 무한 루프 발생 가능
  // 필요시 특정 API 호출에서 직접 trackError 호출 권장
};

// React Error Boundary용 에러 핸들러
export const handleReactError = (
  error: Error,
  errorInfo: { componentStack: string },
  userInfo?: { userId?: string; userRole?: 'admin' | 'student' | 'parent' }
) => {
  trackError(error, {
    errorType: 'react',
    componentStack: errorInfo.componentStack,
    ...userInfo,
  });
};

// 커스텀 에러 로깅 (수동으로 에러 추적할 때 사용)
export const logCustomError = (
  message: string,
  additionalInfo?: Record<string, unknown>,
  userInfo?: { userId?: string; userRole?: 'admin' | 'student' | 'parent' }
) => {
  return trackError(message, {
    errorType: 'custom',
    additionalInfo,
    ...userInfo,
  });
};

// 성능 이벤트 로깅
export const logPerformanceEvent = async (
  eventName: string,
  params: Record<string, string | number>
) => {
  try {
    const analyticsInstance = await initAnalytics();
    if (analyticsInstance) {
      logEvent(analyticsInstance, eventName, {
        ...params,
        app_version: APP_VERSION,
      });
    }
  } catch (e) {
    console.error('Failed to log performance event:', e);
  }
};

// 페이지 뷰 로깅
export const logPageView = async (pageName: string, pageUrl: string) => {
  try {
    const analyticsInstance = await initAnalytics();
    if (analyticsInstance) {
      logEvent(analyticsInstance, 'page_view', {
        page_title: pageName,
        page_location: pageUrl,
        app_version: APP_VERSION,
      });
    }
  } catch (e) {
    console.error('Failed to log page view:', e);
  }
};

export default {
  trackError,
  setupGlobalErrorHandlers,
  handleReactError,
  logCustomError,
  logPerformanceEvent,
  logPageView,
};
