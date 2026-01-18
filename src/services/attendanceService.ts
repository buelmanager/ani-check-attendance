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
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Attendance } from '../types';

const COLLECTION = 'attendances';

export const attendanceService = {
  subscribeByDate(date: string, callback: (attendances: Attendance[]) => void) {
    const q = query(
      collection(db, COLLECTION),
      where('date', '==', date),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const attendances = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Attendance[];
      callback(attendances);
    }, (error) => {
      console.error('Attendances subscription error:', error);
    });
  },

  subscribeAll(callback: (attendances: Attendance[]) => void) {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const attendances = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Attendance[];
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
  }
};
