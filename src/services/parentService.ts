import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Parent } from '../types';

const COLLECTION = 'parents';

export const parentService = {
  subscribe(callback: (parents: Parent[]) => void) {
    return onSnapshot(collection(db, COLLECTION), (snapshot) => {
      const parents = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        studentIds: doc.data().studentIds || []
      })) as Parent[];
      callback(parents);
    }, (error) => {
      console.error('Parents subscription error:', error);
    });
  },

  async getAll(): Promise<Parent[]> {
    const snapshot = await getDocs(collection(db, COLLECTION));
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      studentIds: doc.data().studentIds || []
    })) as Parent[];
  },

  async getById(id: string): Promise<Parent | null> {
    const docRef = doc(db, COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        ...docSnap.data(),
        id: docSnap.id,
        studentIds: docSnap.data().studentIds || []
      } as Parent;
    }
    return null;
  },

  async getByUserId(userId: string): Promise<Parent | null> {
    const q = query(collection(db, COLLECTION), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return {
      ...doc.data(),
      id: doc.id,
      studentIds: doc.data().studentIds || []
    } as Parent;
  },

  async create(data: Omit<Parent, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      studentIds: data.studentIds || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  },

  async update(id: string, data: Partial<Parent>): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), {
      ...data,
      updatedAt: serverTimestamp()
    });
  },

  async addStudent(parentId: string, studentId: string): Promise<void> {
    const parent = await this.getById(parentId);
    if (!parent) throw new Error('Parent not found');

    const studentIds = parent.studentIds || [];
    if (!studentIds.includes(studentId)) {
      studentIds.push(studentId);
      await updateDoc(doc(db, COLLECTION, parentId), {
        studentIds,
        updatedAt: serverTimestamp()
      });
    }
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  }
};
