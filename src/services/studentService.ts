import {
  collection,
  doc,
  getDocs,
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
import type { Student } from '../types';

const COLLECTION = 'students';

export const studentService = {
  subscribe(callback: (students: Student[]) => void) {
    const q = query(collection(db, COLLECTION), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const students = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString()
      })) as Student[];
      callback(students);
    }, (error) => {
      console.error('Students subscription error:', error);
    });
  },

  async getAll(): Promise<Student[]> {
    const q = query(collection(db, COLLECTION), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as Student[];
  },

  async create(data: Omit<Student, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  },

  async update(id: string, data: Partial<Student>): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), {
      ...data,
      updatedAt: serverTimestamp()
    });
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  }
};
