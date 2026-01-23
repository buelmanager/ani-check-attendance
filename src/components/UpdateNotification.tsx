import { useState, useEffect } from 'react';
import { useServiceWorker } from '../hooks/useServiceWorker';
import { logCustomError } from '../services/errorTrackingService';
import { APP_VERSION } from '../config/version';

export default function UpdateNotification() {
  const { isUpdateAvailable, updateApp, dismissUpdate, forceUpdate } = useServiceWorker();
  const [isVisible, setIsVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showRestartHint, setShowRestartHint] = useState(false);

  // PWA 모드 감지
  const isPWA = (navigator as { standalone?: boolean }).standalone === true ||
                window.matchMedia('(display-mode: standalone)').matches;

  useEffect(() => {
    // 이전에 dismiss했는지 확인 (24시간 기준)
    const dismissedTime = localStorage.getItem('sw-update-dismissed');
    if (dismissedTime) {
      const hoursSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60);
      if (hoursSinceDismissed < 24) {
        return;
      }
    }

    // 업데이트가 가능하면 약간의 딜레이 후 표시
    if (isUpdateAvailable) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isUpdateAvailable]);

  const handleDismiss = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[UpdateNotification] Dismiss clicked');
    setIsVisible(false);
    dismissUpdate();
  };

  const handleUpdate = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('[UpdateNotification] Update clicked');

    // 이미 업데이트 중이면 무시
    if (isUpdating) {
      console.log('[UpdateNotification] Already updating, ignoring');
      return;
    }

    setIsUpdating(true);

    // 클릭 로그
    logCustomError('PWA Update Button Clicked', {
      currentVersion: APP_VERSION,
      isPWA,
      userAgent: navigator.userAgent,
    });

    // PWA 모드에서는 바로 강제 업데이트 사용
    if (isPWA) {
      console.log('[UpdateNotification] PWA mode - using force update directly');
      setShowRestartHint(true);

      // 3초 후 강제 업데이트 실행 (사용자에게 안내 메시지 보여준 후)
      setTimeout(() => {
        forceUpdate();
      }, 1500);
      return;
    }

    try {
      await updateApp();
    } catch (error) {
      console.error('[UpdateNotification] Update failed:', error);
      // 실패 시 강제 업데이트
      forceUpdate();
    }
  };

  // 강제 업데이트 버튼 (PWA에서 일반 업데이트가 안 될 경우)
  const handleForceUpdate = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[UpdateNotification] Force update clicked');

    logCustomError('PWA Force Update Clicked', {
      currentVersion: APP_VERSION,
      isPWA: (navigator as { standalone?: boolean }).standalone === true ||
             window.matchMedia('(display-mode: standalone)').matches,
    });

    forceUpdate();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[9999] animate-slide-up">
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-4 shadow-lg max-w-md mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            {isUpdating ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm">
              {showRestartHint ? '앱을 새로고침합니다' : isUpdating ? '업데이트 중...' : '새 버전이 있습니다'}
            </p>
            <p className="text-white/70 text-xs truncate">
              {showRestartHint
                ? '잠시 후 앱이 다시 시작됩니다'
                : isUpdating
                  ? '잠시만 기다려주세요'
                  : '업데이트하여 최신 기능을 사용하세요'}
            </p>
          </div>
          {!isUpdating && !showRestartHint && (
            <div className="flex gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleDismiss}
                onTouchEnd={handleDismiss}
                className="px-3 py-2 text-white/70 text-sm hover:text-white active:text-white transition-colors touch-manipulation"
                style={{ WebkitTapHighlightColor: 'transparent', minWidth: '44px', minHeight: '44px' }}
              >
                나중에
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                onTouchEnd={handleUpdate}
                className="px-4 py-2 bg-white text-blue-600 rounded-lg font-medium text-sm hover:bg-blue-50 active:bg-blue-100 transition-colors touch-manipulation"
                style={{ WebkitTapHighlightColor: 'transparent', minWidth: '44px', minHeight: '44px' }}
              >
                업데이트
              </button>
            </div>
          )}
        </div>

        {/* PWA에서 업데이트가 안 될 경우 강제 업데이트 링크 */}
        {!isUpdating && !showRestartHint && (
          <div className="mt-2 text-center">
            <button
              type="button"
              onClick={handleForceUpdate}
              onTouchEnd={handleForceUpdate}
              className="text-white/50 text-xs underline hover:text-white/70 active:text-white/80 touch-manipulation"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              업데이트가 안 되나요? 강제 새로고침
            </button>
          </div>
        )}

        {/* 재시작 힌트 표시 */}
        {showRestartHint && (
          <div className="mt-2 text-center">
            <p className="text-white/70 text-xs">
              업데이트가 완료되지 않으면 앱을 닫았다가 다시 열어주세요
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
