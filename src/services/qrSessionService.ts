import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface QRSession {
  id: string;
  classId: string;  // 'global' for unified QR
  date: string;
  token: string;
  expiresAt: Date;
  createdBy: string;
  isActive: boolean;
  isGlobal?: boolean;  // true for unified QR
}

const COLLECTION = 'qrSessions';

export const qrSessionService = {
  async createSession(classId: string, adminUid: string): Promise<QRSession> {
    const today = new Date().toISOString().split('T')[0];
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours

    // Deactivate existing sessions for this class/date
    const existingQuery = query(
      collection(db, COLLECTION),
      where('classId', '==', classId),
      where('date', '==', today),
      where('isActive', '==', true)
    );
    const existing = await getDocs(existingQuery);
    for (const docSnap of existing.docs) {
      await updateDoc(docSnap.ref, { isActive: false });
    }

    // Create new session
    const docRef = await addDoc(collection(db, COLLECTION), {
      classId,
      date: today,
      token,
      expiresAt: Timestamp.fromDate(expiresAt),
      createdBy: adminUid,
      isActive: true,
      createdAt: serverTimestamp()
    });

    return {
      id: docRef.id,
      classId,
      date: today,
      token,
      expiresAt,
      createdBy: adminUid,
      isActive: true
    };
  },

  async validateToken(token: string): Promise<{ valid: boolean; classId?: string; date?: string; reason?: string; debug?: string }> {
    const q = query(
      collection(db, COLLECTION),
      where('token', '==', token),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Check if token exists but is inactive
      const inactiveQuery = query(
        collection(db, COLLECTION),
        where('token', '==', token)
      );
      const inactiveSnapshot = await getDocs(inactiveQuery);

      if (inactiveSnapshot.empty) {
        return {
          valid: false,
          reason: '존재하지 않는 QR 코드',
          debug: `토큰: ${token.substring(0, 8)}...`
        };
      } else {
        const inactiveSession = inactiveSnapshot.docs[0].data();
        return {
          valid: false,
          reason: '비활성화된 QR 코드',
          debug: `클래스: ${inactiveSession.classId}, 날짜: ${inactiveSession.date}, isActive: ${inactiveSession.isActive}`
        };
      }
    }

    const session = snapshot.docs[0].data();
    const expiresAt = (session.expiresAt as Timestamp).toDate();

    if (expiresAt < new Date()) {
      // Session expired
      await updateDoc(snapshot.docs[0].ref, { isActive: false });
      return {
        valid: false,
        reason: '만료된 QR 코드',
        debug: `만료시간: ${expiresAt.toLocaleString()}, 현재시간: ${new Date().toLocaleString()}`
      };
    }

    return {
      valid: true,
      classId: session.classId,
      date: session.date
    };
  },

  async deactivateSession(sessionId: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION, sessionId), { isActive: false });
  },

  // 통합 QR 세션 생성
  async createGlobalSession(adminUid: string): Promise<QRSession> {
    const today = new Date().toISOString().split('T')[0];
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours

    // Deactivate existing global sessions for today
    const existingQuery = query(
      collection(db, COLLECTION),
      where('classId', '==', 'global'),
      where('date', '==', today),
      where('isActive', '==', true)
    );
    const existing = await getDocs(existingQuery);
    for (const docSnap of existing.docs) {
      await updateDoc(docSnap.ref, { isActive: false });
    }

    // Create new global session
    const docRef = await addDoc(collection(db, COLLECTION), {
      classId: 'global',
      date: today,
      token,
      expiresAt: Timestamp.fromDate(expiresAt),
      createdBy: adminUid,
      isActive: true,
      isGlobal: true,
      createdAt: serverTimestamp()
    });

    return {
      id: docRef.id,
      classId: 'global',
      date: today,
      token,
      expiresAt,
      createdBy: adminUid,
      isActive: true,
      isGlobal: true
    };
  },

  // 토큰 검증 (통합 QR 지원)
  async validateTokenWithGlobal(token: string): Promise<{
    valid: boolean;
    classId?: string;
    date?: string;
    reason?: string;
    debug?: string;
    isGlobal?: boolean;
  }> {
    const q = query(
      collection(db, COLLECTION),
      where('token', '==', token),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Check if token exists but is inactive
      const inactiveQuery = query(
        collection(db, COLLECTION),
        where('token', '==', token)
      );
      const inactiveSnapshot = await getDocs(inactiveQuery);

      if (inactiveSnapshot.empty) {
        return {
          valid: false,
          reason: '존재하지 않는 QR 코드',
          debug: `토큰: ${token.substring(0, 8)}...`
        };
      } else {
        const inactiveSession = inactiveSnapshot.docs[0].data();
        return {
          valid: false,
          reason: '비활성화된 QR 코드',
          debug: `날짜: ${inactiveSession.date}, isActive: ${inactiveSession.isActive}`
        };
      }
    }

    const session = snapshot.docs[0].data();
    const expiresAt = (session.expiresAt as Timestamp).toDate();

    if (expiresAt < new Date()) {
      // Session expired
      await updateDoc(snapshot.docs[0].ref, { isActive: false });
      return {
        valid: false,
        reason: '만료된 QR 코드',
        debug: `만료시간: ${expiresAt.toLocaleString()}, 현재시간: ${new Date().toLocaleString()}`
      };
    }

    return {
      valid: true,
      classId: session.classId,
      date: session.date,
      isGlobal: session.isGlobal || false
    };
  }
};
