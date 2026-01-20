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
  Timestamp,
  arrayUnion
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Notice, CreateNoticeData, UpdateNoticeData, NoticeTemplate, ReadReceipt } from '../types/notice';

const COLLECTION = 'notices';
const TEMPLATES_COLLECTION = 'noticeTemplates';

// 템플릿 변수 치환 함수
export function replaceTemplateVariables(
  content: string,
  studentName?: string,
  className?: string
): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const formatDate = (date: Date) => {
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  let result = content;
  if (studentName) {
    result = result.replace(/{학생이름}/g, studentName);
  }
  if (className) {
    result = result.replace(/{반이름}/g, className);
  }
  result = result.replace(/{오늘날짜}/g, formatDate(today));
  result = result.replace(/{내일날짜}/g, formatDate(tomorrow));

  return result;
}

export const noticeService = {
  // 전체 알림장 실시간 구독
  subscribeAll(callback: (notices: Notice[]) => void) {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const notices = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt ? (data.updatedAt as Timestamp)?.toDate().toISOString() : undefined,
          sentAt: data.sentAt ? (data.sentAt as Timestamp)?.toDate().toISOString() : undefined,
          readReceipts: data.readReceipts || []
        };
      }) as Notice[];
      callback(notices);
    }, (error) => {
      console.error('Notices subscription error:', error);
    });
  },

  // 발송된 알림장만 구독 (학부모/학생용)
  subscribeSent(callback: (notices: Notice[]) => void) {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'sent'),
      orderBy('sentAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const notices = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt ? (data.updatedAt as Timestamp)?.toDate().toISOString() : undefined,
          sentAt: data.sentAt ? (data.sentAt as Timestamp)?.toDate().toISOString() : undefined,
          readReceipts: data.readReceipts || []
        };
      }) as Notice[];
      callback(notices);
    }, (error) => {
      console.error('Notices subscription error:', error);
    });
  },

  // 특정 학생/반에게 발송된 알림장 구독
  subscribeByTarget(targetId: string, callback: (notices: Notice[]) => void) {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'sent'),
      where('targetIds', 'array-contains', targetId),
      orderBy('sentAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const notices = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          sentAt: data.sentAt ? (data.sentAt as Timestamp)?.toDate().toISOString() : undefined,
          readReceipts: data.readReceipts || []
        };
      }) as Notice[];
      callback(notices);
    }, (error) => {
      console.error('Notices subscription error:', error);
    });
  },

  // 전체 대상 알림장 구독 (targetType이 'all'인 경우)
  subscribeAllTargetNotices(callback: (notices: Notice[]) => void) {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'sent'),
      where('targetType', '==', 'all'),
      orderBy('sentAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const notices = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          sentAt: data.sentAt ? (data.sentAt as Timestamp)?.toDate().toISOString() : undefined,
          readReceipts: data.readReceipts || []
        };
      }) as Notice[];
      callback(notices);
    }, (error) => {
      console.error('Notices subscription error:', error);
    });
  },

  // 전체 알림장 조회 (일회성)
  async getAll(): Promise<Notice[]> {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      readReceipts: doc.data().readReceipts || []
    })) as Notice[];
  },

  // 특정 알림장 조회
  async getById(id: string): Promise<Notice | null> {
    const docRef = doc(db, COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        ...docSnap.data(),
        id: docSnap.id,
        readReceipts: docSnap.data().readReceipts || []
      } as Notice;
    }
    return null;
  },

  // 알림장 생성 (초안 또는 예약)
  async create(data: CreateNoticeData): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      readReceipts: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  },

  // 알림장 수정
  async update(id: string, data: UpdateNoticeData): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), {
      ...data,
      updatedAt: serverTimestamp()
    });
  },

  // 알림장 발송
  async send(id: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), {
      status: 'sent',
      sentAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  },

  // 알림장 삭제
  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  },

  // 읽음 처리
  async markAsRead(noticeId: string, userId: string, userName: string): Promise<void> {
    const readReceipt: ReadReceipt = {
      userId,
      userName,
      readAt: new Date().toISOString()
    };

    await updateDoc(doc(db, COLLECTION, noticeId), {
      readReceipts: arrayUnion(readReceipt)
    });
  },

  // 템플릿 관련 메서드
  async getTemplates(): Promise<NoticeTemplate[]> {
    const q = query(collection(db, TEMPLATES_COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as NoticeTemplate[];
  },

  async createTemplate(data: Omit<NoticeTemplate, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, TEMPLATES_COLLECTION), {
      ...data,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  },

  async deleteTemplate(id: string): Promise<void> {
    await deleteDoc(doc(db, TEMPLATES_COLLECTION, id));
  },

  // 템플릿 실시간 구독
  subscribeTemplates(callback: (templates: NoticeTemplate[]) => void) {
    const q = query(collection(db, TEMPLATES_COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const templates = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString()
        };
      }) as NoticeTemplate[];
      callback(templates);
    });
  }
};
