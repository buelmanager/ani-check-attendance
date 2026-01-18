import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, getFCMToken } from '../lib/firebase';

const COLLECTION = 'fcmTokens';

export interface FCMTokenDoc {
  userId: string;
  token: string;
  userType: 'parent' | 'student' | 'admin';
  deviceInfo?: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export const fcmService = {
  // FCM 토큰 저장/업데이트
  async saveToken(userId: string, userType: 'parent' | 'student' | 'admin'): Promise<string | null> {
    try {
      const token = await getFCMToken();
      if (!token) return null;

      const docId = `${userId}_${token.substring(0, 20)}`;
      const docRef = doc(db, COLLECTION, docId);

      await setDoc(docRef, {
        userId,
        token,
        userType,
        deviceInfo: navigator.userAgent,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      console.log('FCM token saved successfully');
      return token;
    } catch (error) {
      console.error('Error saving FCM token:', error);
      return null;
    }
  },

  // 특정 사용자의 모든 토큰 가져오기
  async getTokensForUser(userId: string): Promise<string[]> {
    try {
      const q = query(collection(db, COLLECTION), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data().token);
    } catch (error) {
      console.error('Error getting FCM tokens:', error);
      return [];
    }
  },

  // 여러 사용자의 토큰 가져오기
  async getTokensForUsers(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];

    try {
      const tokens: string[] = [];
      // Firestore 'in' 쿼리는 최대 10개까지만 지원
      for (let i = 0; i < userIds.length; i += 10) {
        const batch = userIds.slice(i, i + 10);
        const q = query(collection(db, COLLECTION), where('userId', 'in', batch));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(doc => {
          tokens.push(doc.data().token);
        });
      }
      return tokens;
    } catch (error) {
      console.error('Error getting FCM tokens for users:', error);
      return [];
    }
  },

  // 토큰 삭제
  async removeToken(userId: string, token: string): Promise<void> {
    try {
      const docId = `${userId}_${token.substring(0, 20)}`;
      await deleteDoc(doc(db, COLLECTION, docId));
    } catch (error) {
      console.error('Error removing FCM token:', error);
    }
  },

  // 사용자의 모든 토큰 삭제
  async removeAllTokensForUser(userId: string): Promise<void> {
    try {
      const q = query(collection(db, COLLECTION), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      for (const docSnap of snapshot.docs) {
        await deleteDoc(docSnap.ref);
      }
    } catch (error) {
      console.error('Error removing all FCM tokens:', error);
    }
  },

  // 토큰 유효성 확인
  async isTokenValid(token: string): Promise<boolean> {
    try {
      const q = query(collection(db, COLLECTION), where('token', '==', token));
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking token validity:', error);
      return false;
    }
  }
};
