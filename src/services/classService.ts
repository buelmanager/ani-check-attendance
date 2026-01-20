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
import type { Class } from '../types';

const COLLECTION = 'classes';

export const classService = {
  // Real-time subscription
  subscribe(callback: (classes: Class[]) => void) {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const classes = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString()
      })) as Class[];
      callback(classes);
    }, (error) => {
      console.error('Classes subscription error:', error);
    });
  },

  async getAll(): Promise<Class[]> {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as Class[];
  },

  async getById(id: string): Promise<Class | null> {
    const docRef = doc(db, COLLECTION, id);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return { ...snapshot.data(), id: snapshot.id } as Class;
  },

  async create(data: Omit<Class, 'id' | 'createdAt'>): Promise<string> {
    // Filter out undefined values (Firebase doesn't support undefined)
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

  async update(id: string, data: Partial<Class>): Promise<void> {
    const docRef = doc(db, COLLECTION, id);
    // Filter out undefined values (Firebase doesn't support undefined)
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined)
    );
    await updateDoc(docRef, {
      ...filteredData,
      updatedAt: serverTimestamp()
    });
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  },

  async addStudentToClass(classId: string, studentId: string): Promise<void> {
    const classDoc = await this.getById(classId);
    if (!classDoc) throw new Error('Class not found');

    const studentIds = classDoc.studentIds || [];
    if (!studentIds.includes(studentId)) {
      await this.update(classId, {
        studentIds: [...studentIds, studentId]
      });
    }
  },

  async removeStudentFromClass(classId: string, studentId: string): Promise<void> {
    const classDoc = await this.getById(classId);
    if (!classDoc) throw new Error('Class not found');

    const studentIds = (classDoc.studentIds || []).filter(id => id !== studentId);
    await this.update(classId, { studentIds });
  }
};
