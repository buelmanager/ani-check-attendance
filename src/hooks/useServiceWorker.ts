import { useState, useEffect, useCallback, useRef } from 'react';
import { logCustomError } from '../services/errorTrackingService';
import { APP_VERSION } from '../config/version';

interface ServiceWorkerState {
  isUpdateAvailable: boolean;
  registration: ServiceWorkerRegistration | null;
}

export function useServiceWorker() {
  const [state, setState] = useState<ServiceWorkerState>({
    isUpdateAvailable: false,
    registration: null,
  });
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    // 컨트롤러 변경 감지 (새 서비스 워커가 활성화되면)
    const handleControllerChange = () => {
      console.log('[useServiceWorker] Controller changed, reloading...');
      if (!refreshingRef.current) {
        refreshingRef.current = true;
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    const checkForUpdates = async () => {
      try {
        // 방금 업데이트했는지 확인
        const justUpdated = localStorage.getItem('sw-just-updated');
        if (justUpdated) {
          console.log('[useServiceWorker] Just updated, clearing flag');
          localStorage.removeItem('sw-just-updated');
          // URL에서 캐시 버스팅 파라미터 제거
          const url = new URL(window.location.href);
          if (url.searchParams.has('_sw_update')) {
            url.searchParams.delete('_sw_update');
            window.history.replaceState({}, '', url.toString());
          }
          return; // 업데이트 직후에는 체크하지 않음
        }

        const registration = await navigator.serviceWorker.getRegistration();
        console.log('[useServiceWorker] Registration:', registration);
        console.log('[useServiceWorker] Current app version:', APP_VERSION);

        if (registration) {
          setState(prev => ({ ...prev, registration }));

          // 대기 중인 서비스 워커가 있으면 업데이트 가능
          if (registration.waiting) {
            console.log('[useServiceWorker] Waiting worker found');
            setState(prev => ({ ...prev, isUpdateAvailable: true }));
          }

          // 새 서비스 워커가 설치되면 알림
          registration.addEventListener('updatefound', () => {
            console.log('[useServiceWorker] Update found');
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                console.log('[useServiceWorker] New worker state:', newWorker.state);
                if (newWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    // 기존 컨트롤러가 있으면 업데이트 가능
                    console.log('[useServiceWorker] New version available');
                    setState(prev => ({ ...prev, isUpdateAvailable: true }));
                  } else {
                    // 첫 설치인 경우
                    console.log('[useServiceWorker] First install');
                  }
                }
              });
            }
          });

          // 즉시 업데이트 확인
          registration.update().catch(console.error);
        }
      } catch (error) {
        console.error('[useServiceWorker] Check failed:', error);
      }
    };

    checkForUpdates();

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  // 강제 업데이트 - 캐시 삭제 및 서비스 워커 재등록
  const forceUpdate = useCallback(async () => {
    console.log('[useServiceWorker] Force update started');

    if (refreshingRef.current) return;
    refreshingRef.current = true;

    try {
      // 1. 모든 캐시 삭제
      const cacheNames = await caches.keys();
      console.log('[useServiceWorker] Clearing caches:', cacheNames);
      await Promise.all(cacheNames.map(name => caches.delete(name)));

      // 2. 현재 서비스 워커 등록 해제
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        console.log('[useServiceWorker] Unregistering SW:', registration.scope);
        await registration.unregister();
      }

      console.log('[useServiceWorker] All cleared, reloading...');
    } catch (e) {
      console.error('[useServiceWorker] Force update error:', e);
    }

    // 3. dismiss 플래그 설정 (업데이트 후 24시간 동안 알림 표시 안함)
    localStorage.setItem('sw-update-dismissed', Date.now().toString());

    // 4. 업데이트 완료 플래그 설정
    localStorage.setItem('sw-just-updated', 'true');

    // 5. 캐시 버스팅을 위한 URL로 새로고침
    const url = new URL(window.location.href);
    url.searchParams.set('_sw_update', Date.now().toString());
    window.location.replace(url.toString());
  }, []);

  const updateApp = useCallback(async () => {
    console.log('[useServiceWorker] updateApp called');
    const { registration } = state;

    // 로그 남기기
    logCustomError('PWA Update Attempt', {
      hasRegistration: !!registration,
      hasWaiting: !!registration?.waiting,
      hasActive: !!registration?.active,
      hasInstalling: !!registration?.installing,
      currentVersion: APP_VERSION,
      isStandalone: window.matchMedia('(display-mode: standalone)').matches,
      isPWA: (navigator as { standalone?: boolean }).standalone === true ||
             window.matchMedia('(display-mode: standalone)').matches,
    });

    if (registration?.waiting) {
      console.log('[useServiceWorker] Posting SKIP_WAITING to waiting worker');

      // 타임아웃 설정 - 2초 후에도 변화 없으면 강제 업데이트
      setTimeout(() => {
        if (!refreshingRef.current) {
          console.log('[useServiceWorker] SKIP_WAITING timeout, forcing update');
          logCustomError('PWA Update Timeout - Force Update', {
            message: 'SKIP_WAITING did not work, using force update',
            currentVersion: APP_VERSION,
          });
          forceUpdate();
        }
      }, 2000);

      // SKIP_WAITING 메시지 전송 시도
      try {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      } catch (e) {
        console.error('[useServiceWorker] postMessage failed:', e);
        // postMessage 실패 시 즉시 강제 업데이트
        forceUpdate();
      }
    } else {
      // waiting이 없으면 강제 업데이트
      console.log('[useServiceWorker] No waiting worker, forcing update');

      logCustomError('PWA Update No Waiting Worker', {
        message: 'No waiting worker found, using force update',
        currentVersion: APP_VERSION,
      });

      forceUpdate();
    }
  }, [state, forceUpdate]);

  const dismissUpdate = useCallback(() => {
    console.log('[useServiceWorker] Dismissing update');
    setState(prev => ({ ...prev, isUpdateAvailable: false }));
    // 24시간 동안 다시 표시하지 않음
    localStorage.setItem('sw-update-dismissed', Date.now().toString());
  }, []);

  return {
    ...state,
    updateApp,
    dismissUpdate,
    forceUpdate,
  };
}
