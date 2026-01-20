import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyByscDrn1u1V5Lbol-t7YwFgPEoBFWCxgE",
  authDomain: "art-academy-80ae5.firebaseapp.com",
  projectId: "art-academy-80ae5",
  storageBucket: "art-academy-80ae5.firebasestorage.app",
  messagingSenderId: "496950594898",
  appId: "1:496950594898:web:069336867debd98a43fe8b"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with persistent cache and experimental long polling for better connectivity
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  }),
  experimentalForceLongPolling: true
});

// FCM 메시징 (브라우저 지원 확인 후 초기화)
let messaging: ReturnType<typeof getMessaging> | null = null;

export const initMessaging = async () => {
  const supported = await isSupported();
  if (supported) {
    messaging = getMessaging(app);
  }
  return messaging;
};

export const getMessagingInstance = () => messaging;

// FCM 토큰 가져오기
export const getFCMToken = async (): Promise<string | null> => {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.log('FCM not supported in this browser');
      return null;
    }

    if (!messaging) {
      messaging = getMessaging(app);
    }

    // 알림 권한 요청
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    // VAPID 키로 토큰 가져오기
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
    });

    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

// 포그라운드 메시지 리스너
export const onForegroundMessage = (callback: (payload: unknown) => void) => {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
};

// Note: Offline persistence is now configured via initializeFirestore above
// using persistentLocalCache with persistentMultipleTabManager for multi-tab support

export default app;
