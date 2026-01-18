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
      const granted = permission === 'granted';
      setState(prev => ({ ...prev, isPermissionGranted: granted }));

      if (granted && user) {
        let userType: 'parent' | 'student' | 'admin' = 'parent';
        if (studentData) userType = 'student';
        else if (parentData) userType = 'parent';

        const token = await fcmService.saveToken(user.uid, userType);
        if (token) {
          setState(prev => ({ ...prev, isTokenSaved: true }));
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
