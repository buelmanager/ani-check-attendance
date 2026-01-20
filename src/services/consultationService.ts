import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Consultation, CreateConsultationData, UpdateConsultationData } from '../types/consultation';

const COLLECTION = 'consultations';

export const consultationService = {
  // 전체 상담 실시간 구독
  subscribeAll(callback: (consultations: Consultation[]) => void) {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const consultations = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt ? (data.updatedAt as Timestamp)?.toDate().toISOString() : undefined
        };
      }) as Consultation[];
      callback(consultations);
    }, (error) => {
      console.error('Consultations subscription error:', error);
    });
  },

  // 특정 학생의 상담 실시간 구독
  subscribeByStudent(studentId: string, callback: (consultations: Consultation[]) => void) {
    // 복합 인덱스 없이 studentId만 필터링 (클라이언트에서 정렬)
    const q = query(
      collection(db, COLLECTION),
      where('studentId', '==', studentId)
    );
    return onSnapshot(q, (snapshot) => {
      const consultations = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt ? (data.updatedAt as Timestamp)?.toDate().toISOString() : undefined
        };
      }) as Consultation[];
      // 클라이언트에서 정렬
      consultations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(consultations);
    }, (error) => {
      console.error('Consultations subscription error:', error);
      // 에러 발생 시 빈 배열 반환
      callback([]);
    });
  },

  // 미완료 상담 조회
  subscribeIncomplete(callback: (consultations: Consultation[]) => void) {
    const q = query(
      collection(db, COLLECTION),
      where('isCompleted', '==', false),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const consultations = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString()
        };
      }) as Consultation[];
      callback(consultations);
    });
  },

  // 전체 상담 조회 (일회성)
  async getAll(): Promise<Consultation[]> {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as Consultation[];
  },

  // 특정 학생의 상담 조회
  async getByStudent(studentId: string): Promise<Consultation[]> {
    const q = query(
      collection(db, COLLECTION),
      where('studentId', '==', studentId)
    );
    const snapshot = await getDocs(q);
    const consultations = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as Consultation[];
    // 클라이언트에서 정렬
    return consultations.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  // 특정 상담 조회
  async getById(id: string): Promise<Consultation | null> {
    const docRef = doc(db, COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        ...docSnap.data(),
        id: docSnap.id
      } as Consultation;
    }
    return null;
  },

  // 상담 생성
  async create(data: CreateConsultationData): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  },

  // 상담 수정
  async update(id: string, data: UpdateConsultationData): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), {
      ...data,
      updatedAt: serverTimestamp()
    });
  },

  // 상담 완료 처리
  async complete(id: string, result?: string): Promise<void> {
    const updateData: UpdateConsultationData = {
      isCompleted: true
    };
    if (result) {
      updateData.result = result;
    }
    await this.update(id, updateData);
  },

  // 상담 삭제
  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  },

  // 다음 상담 예정일이 있는 상담 조회
  async getUpcoming(): Promise<Consultation[]> {
    const today = new Date().toISOString().split('T')[0];
    const q = query(
      collection(db, COLLECTION),
      where('nextDate', '>=', today),
      where('isCompleted', '==', false),
      orderBy('nextDate', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as Consultation[];
  }
};
