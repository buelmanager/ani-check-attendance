import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fcmService } from '../services/fcmService';
import { onForegroundMessage, initMessaging } from '../lib/firebase';

interface PushNotificationState {
  isSupported: boolean;
  isPermissionGranted: boolean;
  isTokenSaved: boolean;
  error: string | null;
}

export function usePushNotification() {
  const { user, parentData, studentData } = useAuth();
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isPermissionGranted: false,
    isTokenSaved: false,
    error: null
  });

  useEffect(() => {
    const initPush = async () => {
      // 브라우저 지원 확인
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        setState(prev => ({ ...prev, isSupported: false, error: 'Push not supported' }));
        return;
      }

      setState(prev => ({ ...prev, isSupported: true }));

      // 이미 권한이 있는 경우
      if (Notification.permission === 'granted') {
        setState(prev => ({ ...prev, isPermissionGranted: true }));
      }

      // 메시징 초기화
      await initMessaging();

      // 서비스 워커 등록
      try {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service Worker registered:', registration);
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    };

    initPush();

    // 권한 상태 변경 감지 (macOS에서 시스템 설정에서 변경 시)
    const checkPermission = () => {
      if ('Notification' in window) {
        const granted = Notification.permission === 'granted';
        setState(prev => {
          if (prev.isPermissionGranted !== granted) {
            console.log('[usePushNotification] Permission changed:', granted);
            return { ...prev, isPermissionGranted: granted };
          }
          return prev;
        });
      }
    };

    // 2초마다 권한 상태 확인 (최대 30초간)
    const interval = setInterval(checkPermission, 2000);
    const timeout = setTimeout(() => clearInterval(interval), 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  // 사용자 로그인 시 토큰 저장
  useEffect(() => {
    const saveToken = async () => {
      if (!user) return;

      // 권한이 이미 승인된 경우에만 자동 저장
      if (Notification.permission !== 'granted') return;

      try {
        let userType: 'parent' | 'student' | 'admin' = 'parent';
        if (studentData) userType = 'student';
        else if (parentData) userType = 'parent';

        const token = await fcmService.saveToken(user.uid, userType);
        if (token) {
          setState(prev => ({ ...prev, isTokenSaved: true }));
        }
      } catch (error) {
        console.error('Error saving FCM token:', error);
      }
    };

    saveToken();
  }, [user, parentData, studentData]);

  // 포그라운드 메시지 처리
  useEffect(() => {
    if (!state.isPermissionGranted) return;

    const unsubscribe = onForegroundMessage((payload) => {
      console.log('Foreground message received:', payload);

      // 포그라운드에서도 알림 표시
      const notificationPayload = payload as { notification?: { title?: string; body?: string } };
      if (Notification.permission === 'granted' && notificationPayload.notification) {
        new Notification(notificationPayload.notification.title || '새 알림', {
          body: notificationPayload.notification.body || '',
          icon: '/icons/logo.png'
        });
      }
    });

    return () => unsubscribe();
  }, [state.isPermissionGranted]);

  // 푸시 알림 권한 요청
  const requestPermission = async (): Promise<boolean> => {
    if (!state.isSupported) {
      setState(prev => ({ ...prev, error: '이 브라우저에서는 푸시 알림을 지원하지 않습니다.' }));
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      console.log('[usePushNotification] Permission result:', permission);

      // macOS에서는 시스템 설정으로 이동할 수 있으므로 실제 권한 상태를 다시 확인
      const actualPermission = Notification.permission;
      console.log('[usePushNotification] Actual permission:', actualPermission);

      const granted = actualPermission === 'granted';
      setState(prev => ({ ...prev, isPermissionGranted: granted }));

      if (granted && user) {
        let userType: 'parent' | 'student' | 'admin' = 'parent';
        if (studentData) userType = 'student';
        else if (parentData) userType = 'parent';

        const token = await fcmService.saveToken(user.uid, userType);
        if (token) {
          setState(prev => ({ ...prev, isTokenSaved: true }));
          console.log('[usePushNotification] FCM token saved');
        }
      }

      return granted;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      setState(prev => ({ ...prev, error: '알림 권한 요청 중 오류가 발생했습니다.' }));
      return false;
    }
  };

  return {
    ...state,
    requestPermission
  };
}
