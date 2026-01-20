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
import type {
  Homework,
  CreateHomeworkData,
  UpdateHomeworkData,
  HomeworkSubmission,
  SubmissionStatus
} from '../types/homework';

const COLLECTION = 'homeworks';

export const homeworkService = {
  // 전체 숙제 실시간 구독
  subscribeAll(callback: (homeworks: Homework[]) => void) {
    const q = query(collection(db, COLLECTION), orderBy('dueDate', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const homeworks = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt ? (data.updatedAt as Timestamp)?.toDate().toISOString() : undefined,
          submissions: data.submissions || []
        };
      }) as Homework[];
      callback(homeworks);
    }, (error) => {
      console.error('Homeworks subscription error:', error);
    });
  },

  // 특정 반의 숙제 실시간 구독
  subscribeByClass(classId: string, callback: (homeworks: Homework[]) => void) {
    const q = query(
      collection(db, COLLECTION),
      where('classId', '==', classId),
      orderBy('dueDate', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const homeworks = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          submissions: data.submissions || []
        };
      }) as Homework[];
      callback(homeworks);
    }, (error) => {
      console.error('Homeworks subscription error:', error);
    });
  },

  // 특정 학생의 숙제 실시간 구독
  subscribeByStudent(studentId: string, callback: (homeworks: Homework[]) => void) {
    // 복합 인덱스 없이 studentIds만 필터링 (클라이언트에서 정렬)
    const q = query(
      collection(db, COLLECTION),
      where('studentIds', 'array-contains', studentId)
    );
    return onSnapshot(q, (snapshot) => {
      const homeworks = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          submissions: data.submissions || []
        };
      }) as Homework[];
      // 클라이언트에서 정렬
      homeworks.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
      callback(homeworks);
    }, (error) => {
      console.error('Homeworks subscription error:', error);
      // 에러 발생 시 빈 배열 반환
      callback([]);
    });
  },

  // 전체 숙제 조회 (일회성)
  async getAll(): Promise<Homework[]> {
    const q = query(collection(db, COLLECTION), orderBy('dueDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      submissions: doc.data().submissions || []
    })) as Homework[];
  },

  // 특정 숙제 조회
  async getById(id: string): Promise<Homework | null> {
    const docRef = doc(db, COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        ...docSnap.data(),
        id: docSnap.id,
        submissions: docSnap.data().submissions || []
      } as Homework;
    }
    return null;
  },

  // 숙제 생성
  async create(data: CreateHomeworkData): Promise<string> {
    // 대상 학생들의 초기 제출 상태 생성
    const initialSubmissions: HomeworkSubmission[] = data.studentIds.map(studentId => ({
      studentId,
      studentName: '', // 나중에 업데이트 필요
      status: 'pending' as SubmissionStatus
    }));

    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      submissions: initialSubmissions,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  },

  // 초기 제출 상태 생성 (학생 이름 포함)
  async createWithStudentNames(
    data: CreateHomeworkData,
    studentNames: Record<string, string>
  ): Promise<string> {
    const initialSubmissions: HomeworkSubmission[] = data.studentIds.map(studentId => ({
      studentId,
      studentName: studentNames[studentId] || '',
      status: 'pending' as SubmissionStatus
    }));

    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      submissions: initialSubmissions,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  },

  // 숙제 수정
  async update(id: string, data: UpdateHomeworkData): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), {
      ...data,
      updatedAt: serverTimestamp()
    });
  },

  // 숙제 삭제
  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  },

  // 숙제 제출
  async submit(
    homeworkId: string,
    studentId: string,
    content?: string,
    attachments?: { name: string; url: string; type: string }[]
  ): Promise<void> {
    const homework = await this.getById(homeworkId);
    if (!homework) throw new Error('Homework not found');

    const now = new Date();
    const dueDate = new Date(homework.dueDate);
    dueDate.setHours(23, 59, 59, 999); // 마감일 자정까지

    const isLate = now > dueDate;

    const updatedSubmissions = homework.submissions.map(sub => {
      if (sub.studentId === studentId) {
        return {
          ...sub,
          status: isLate ? 'late' : 'submitted' as SubmissionStatus,
          submittedAt: now.toISOString(),
          content,
          attachments
        };
      }
      return sub;
    });

    await updateDoc(doc(db, COLLECTION, homeworkId), {
      submissions: updatedSubmissions,
      updatedAt: serverTimestamp()
    });
  },

  // 숙제 확인 (피드백 작성)
  async checkSubmission(
    homeworkId: string,
    studentId: string,
    feedback: string,
    checkedBy: string
  ): Promise<void> {
    const homework = await this.getById(homeworkId);
    if (!homework) throw new Error('Homework not found');

    const updatedSubmissions = homework.submissions.map(sub => {
      if (sub.studentId === studentId) {
        return {
          ...sub,
          status: 'checked' as SubmissionStatus,
          feedback,
          checkedAt: new Date().toISOString(),
          checkedBy
        };
      }
      return sub;
    });

    await updateDoc(doc(db, COLLECTION, homeworkId), {
      submissions: updatedSubmissions,
      updatedAt: serverTimestamp()
    });
  },

  // 제출 상태 직접 변경
  async updateSubmissionStatus(
    homeworkId: string,
    studentId: string,
    status: SubmissionStatus
  ): Promise<void> {
    const homework = await this.getById(homeworkId);
    if (!homework) throw new Error('Homework not found');

    const updatedSubmissions = homework.submissions.map(sub => {
      if (sub.studentId === studentId) {
        return {
          ...sub,
          status
        };
      }
      return sub;
    });

    await updateDoc(doc(db, COLLECTION, homeworkId), {
      submissions: updatedSubmissions,
      updatedAt: serverTimestamp()
    });
  },

  // 마감 예정 숙제 조회
  async getUpcoming(days: number = 7): Promise<Homework[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);

    const todayStr = today.toISOString().split('T')[0];
    const futureStr = futureDate.toISOString().split('T')[0];

    const q = query(
      collection(db, COLLECTION),
      where('dueDate', '>=', todayStr),
      where('dueDate', '<=', futureStr),
      orderBy('dueDate', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      submissions: doc.data().submissions || []
    })) as Homework[];
  },

  // 미완료 숙제 구독 (학생용)
  subscribePendingByStudent(studentId: string, callback: (homeworks: Homework[]) => void) {
    // 복합 인덱스 없이 studentIds만 필터링 (클라이언트에서 정렬)
    const q = query(
      collection(db, COLLECTION),
      where('studentIds', 'array-contains', studentId)
    );
    return onSnapshot(q, (snapshot) => {
      const homeworks = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          submissions: data.submissions || []
        };
      }) as Homework[];

      // 해당 학생의 제출이 pending인 것만 필터
      const pending = homeworks.filter(hw => {
        const submission = hw.submissions.find(s => s.studentId === studentId);
        return submission?.status === 'pending';
      });

      // 클라이언트에서 정렬
      pending.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      callback(pending);
    }, (error) => {
      console.error('Homeworks subscription error:', error);
      // 에러 발생 시 빈 배열 반환
      callback([]);
    });
  }
};
