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
import type { Student, StudentStatus, StatusChange } from '../types';

const COLLECTION = 'students';

// 6자리 랜덤 초대 코드 생성
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 혼동하기 쉬운 문자 제외 (0,O,1,I)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const studentService = {
  subscribe(callback: (students: Student[]) => void) {
    const q = query(collection(db, COLLECTION), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const students = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          enrolledAt: data.enrolledAt ? (data.enrolledAt as Timestamp)?.toDate?.()?.toISOString() || data.enrolledAt : undefined,
          parentIds: data.parentIds || [],
          status: data.status || 'active', // 기존 데이터 호환
          statusHistory: data.statusHistory || []
        };
      }) as Student[];
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
      id: doc.id,
      parentIds: doc.data().parentIds || []
    })) as Student[];
  },

  async getById(id: string): Promise<Student | null> {
    const docRef = doc(db, COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        ...docSnap.data(),
        id: docSnap.id,
        parentIds: docSnap.data().parentIds || []
      } as Student;
    }
    return null;
  },

  async getByInviteCode(inviteCode: string): Promise<Student | null> {
    const q = query(collection(db, COLLECTION), where('inviteCode', '==', inviteCode));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return {
      ...doc.data(),
      id: doc.id,
      parentIds: doc.data().parentIds || []
    } as Student;
  },

  async getByUserId(userId: string): Promise<Student | null> {
    const q = query(collection(db, COLLECTION), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return {
      ...doc.data(),
      id: doc.id,
      parentIds: doc.data().parentIds || []
    } as Student;
  },

  async create(data: Omit<Student, 'id' | 'createdAt' | 'inviteCode' | 'parentIds' | 'status' | 'statusHistory' | 'enrolledAt'> & { enrolledAt?: string }): Promise<string> {
    // 고유한 초대 코드 생성 (중복 체크)
    let inviteCode = generateInviteCode();
    let existing = await this.getByInviteCode(inviteCode);
    while (existing) {
      inviteCode = generateInviteCode();
      existing = await this.getByInviteCode(inviteCode);
    }

    const now = new Date().toISOString();
    const initialStatus: StatusChange = {
      status: 'active',
      changedAt: now
    };

    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      inviteCode,
      parentIds: [],
      status: 'active',
      enrolledAt: data.enrolledAt || now,
      statusHistory: [initialStatus],
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

  async linkUserAccount(studentId: string, userId: string, phone?: string): Promise<void> {
    if (phone) {
      await updateDoc(doc(db, COLLECTION, studentId), {
        userId,
        phone,
        updatedAt: serverTimestamp()
      });
    } else {
      await updateDoc(doc(db, COLLECTION, studentId), {
        userId,
        updatedAt: serverTimestamp()
      });
    }
  },

  async addParent(studentId: string, parentId: string): Promise<void> {
    const student = await this.getById(studentId);
    if (!student) throw new Error('Student not found');

    const parentIds = student.parentIds || [];
    if (!parentIds.includes(parentId)) {
      parentIds.push(parentId);
      await updateDoc(doc(db, COLLECTION, studentId), {
        parentIds,
        updatedAt: serverTimestamp()
      });
    }
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  },

  // 원생 상태 변경 (재원/휴원/퇴원)
  async changeStatus(id: string, newStatus: StudentStatus, reason?: string): Promise<void> {
    const student = await this.getById(id);
    if (!student) throw new Error('Student not found');

    const statusChange: StatusChange = {
      status: newStatus,
      changedAt: new Date().toISOString(),
      reason
    };

    const statusHistory = [...(student.statusHistory || []), statusChange];

    await updateDoc(doc(db, COLLECTION, id), {
      status: newStatus,
      statusHistory,
      updatedAt: serverTimestamp()
    });
  },

  // 상태별 원생 조회 (실시간)
  subscribeByStatus(status: StudentStatus, callback: (students: Student[]) => void) {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', status),
      orderBy('name', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
      const students = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          parentIds: data.parentIds || [],
          status: data.status || 'active',
          statusHistory: data.statusHistory || []
        };
      }) as Student[];
      callback(students);
    });
  },

  // 재원생만 조회
  async getActiveStudents(): Promise<Student[]> {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'active'),
      orderBy('name', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      parentIds: doc.data().parentIds || [],
      status: doc.data().status || 'active'
    })) as Student[];
  }
};
