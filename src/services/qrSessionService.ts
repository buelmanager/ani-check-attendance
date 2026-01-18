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
  classId: string;
  date: string;
  token: string;
  expiresAt: Date;
  createdBy: string;
  isActive: boolean;
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

  async validateToken(token: string): Promise<{ valid: boolean; classId?: string; date?: string }> {
    const q = query(
      collection(db, COLLECTION),
      where('token', '==', token),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) return { valid: false };

    const session = snapshot.docs[0].data();
    const expiresAt = (session.expiresAt as Timestamp).toDate();

    if (expiresAt < new Date()) {
      // Session expired
      await updateDoc(snapshot.docs[0].ref, { isActive: false });
      return { valid: false };
    }

    return {
      valid: true,
      classId: session.classId,
      date: session.date
    };
  },

  async deactivateSession(sessionId: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION, sessionId), { isActive: false });
  }
};
