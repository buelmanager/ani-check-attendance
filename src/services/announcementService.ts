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
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Announcement } from '../types';

const COLLECTION = 'announcements';

export const announcementService = {
  subscribe(callback: (announcements: Announcement[]) => void) {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const announcements = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString()
      })) as Announcement[];
      callback(announcements);
    }, (error) => {
      console.error('Announcements subscription error:', error);
    });
  },

  // 학생용: 본인에게 해당하는 공지만 조회
  subscribeForStudent(studentId: string, classIds: string[], callback: (announcements: Announcement[]) => void) {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const allAnnouncements = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString()
      })) as Announcement[];

      // 필터링: 전체 공지 OR 해당 클래스 공지 OR 해당 학생 공지
      const filtered = allAnnouncements.filter(a => {
        if (a.targetType === 'all') return true;
        if (a.targetType === 'class' && a.classIds?.some(id => classIds.includes(id))) return true;
        if (a.targetType === 'student' && a.studentIds?.includes(studentId)) return true;
        return false;
      });

      callback(filtered);
    }, (error) => {
      console.error('Announcements subscription error:', error);
    });
  },

  async getAll(): Promise<Announcement[]> {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as Announcement[];
  },

  async getById(id: string): Promise<Announcement | null> {
    const docRef = doc(db, COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        ...docSnap.data(),
        id: docSnap.id
      } as Announcement;
    }
    return null;
  },

  async create(data: Omit<Announcement, 'id' | 'createdAt'>): Promise<string> {
    // undefined 값 필터링 (Firebase는 undefined를 지원하지 않음)
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined)
    );
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...filteredData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  },

  async update(id: string, data: Partial<Announcement>): Promise<void> {
    // undefined 값 필터링 (Firebase는 undefined를 지원하지 않음)
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined)
    );
    await updateDoc(doc(db, COLLECTION, id), {
      ...filteredData,
      updatedAt: serverTimestamp()
    });
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  }
};
