import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Attendance } from '../types';

const COLLECTION = 'attendances';

// 진행 중인 요청을 추적하기 위한 Set (클라이언트 측 중복 방지)
const pendingRequests = new Set<string>();

export const attendanceService = {
  subscribeByDate(date: string, callback: (attendances: Attendance[]) => void) {
    const q = query(
      collection(db, COLLECTION),
      where('date', '==', date)
    );
    return onSnapshot(q, (snapshot) => {
      const attendances = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Attendance[];
      // 클라이언트에서 정렬
      attendances.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      callback(attendances);
    }, (error) => {
      console.error('Attendances subscription error:', error);
    });
  },

  subscribeAll(callback: (attendances: Attendance[]) => void) {
    const q = query(collection(db, COLLECTION));
    return onSnapshot(q, (snapshot) => {
      const attendances = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Attendance[];
      // 클라이언트에서 정렬
      attendances.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      callback(attendances);
    }, (error) => {
      console.error('Attendances subscription error:', error);
    });
  },

  async getAll(): Promise<Attendance[]> {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as Attendance[];
  },

  async getByDate(date: string): Promise<Attendance[]> {
    const q = query(
      collection(db, COLLECTION),
      where('date', '==', date)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as Attendance[];
  },

  async create(data: Omit<Attendance, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  },

  async checkIfExists(classId: string, studentId: string, date: string): Promise<boolean> {
    const q = query(
      collection(db, COLLECTION),
      where('classId', '==', classId),
      where('studentId', '==', studentId),
      where('date', '==', date)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  },

  async getExisting(classId: string, studentId: string, date: string): Promise<Attendance | null> {
    const q = query(
      collection(db, COLLECTION),
      where('classId', '==', classId),
      where('studentId', '==', studentId),
      where('date', '==', date)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as Attendance;
  },

  async update(id: string, data: Partial<Attendance>): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), {
      ...data,
      updatedAt: serverTimestamp()
    });
  },

  /**
   * 출석을 생성하거나 업데이트 (upsert)
   * - 클라이언트 측 중복 요청 방지
   * - Firestore 트랜잭션으로 원자성 보장
   * - 기존 출석이 있으면 업데이트, 없으면 생성
   */
  async createOrUpdate(data: Omit<Attendance, 'id'>): Promise<{ id: string; isNew: boolean }> {
    const { classId, studentId, date } = data;
    const requestKey = `${classId}-${studentId}-${date}`;

    // 클라이언트 측 중복 요청 방지
    if (pendingRequests.has(requestKey)) {
      console.log('Duplicate request blocked:', requestKey);
      throw new Error('이미 처리 중인 요청입니다.');
    }

    pendingRequests.add(requestKey);

    try {
      // 고유한 문서 ID 생성 (classId_studentId_date)
      const docId = `${classId}_${studentId}_${date}`;
      const docRef = doc(db, COLLECTION, docId);

      let isNew = false;

      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);

        if (docSnap.exists()) {
          // 기존 출석 업데이트
          transaction.update(docRef, {
            ...data,
            updatedAt: serverTimestamp()
          });
          isNew = false;
        } else {
          // 새 출석 생성
          transaction.set(docRef, {
            ...data,
            createdAt: serverTimestamp()
          });
          isNew = true;
        }
      });

      return { id: docId, isNew };
    } finally {
      // 요청 완료 후 Set에서 제거
      pendingRequests.delete(requestKey);
    }
  },

  /**
   * 안전한 출석 생성 (중복 체크 포함)
   * 이미 존재하면 기존 ID 반환
   */
  async createSafe(data: Omit<Attendance, 'id'>): Promise<{ id: string; alreadyExists: boolean }> {
    const { classId, studentId, date } = data;
    const requestKey = `${classId}-${studentId}-${date}`;

    // 클라이언트 측 중복 요청 방지
    if (pendingRequests.has(requestKey)) {
      console.log('Duplicate request blocked:', requestKey);
      throw new Error('이미 처리 중인 요청입니다.');
    }

    pendingRequests.add(requestKey);

    try {
      // 고유한 문서 ID 생성
      const docId = `${classId}_${studentId}_${date}`;
      const docRef = doc(db, COLLECTION, docId);

      let alreadyExists = false;

      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);

        if (docSnap.exists()) {
          // 이미 존재하면 아무것도 하지 않음
          alreadyExists = true;
          return;
        }

        // 새 출석 생성
        transaction.set(docRef, {
          ...data,
          createdAt: serverTimestamp()
        });
      });

      return { id: docId, alreadyExists };
    } finally {
      pendingRequests.delete(requestKey);
    }
  }
};
