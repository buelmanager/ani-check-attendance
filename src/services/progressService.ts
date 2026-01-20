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
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  Curriculum,
  CreateCurriculumData,
  UpdateCurriculumData,
  StudentProgress,
  ProgressStatus,
  StudentCurriculumSummary
} from '../types/progress';

const CURRICULA_COLLECTION = 'curricula';
const PROGRESS_COLLECTION = 'studentProgress';

export const progressService = {
  // ===== 커리큘럼 관련 =====

  // 전체 커리큘럼 실시간 구독
  subscribeCurricula(callback: (curricula: Curriculum[]) => void) {
    const q = query(collection(db, CURRICULA_COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const curricula = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt ? (data.updatedAt as Timestamp)?.toDate().toISOString() : undefined
        };
      }) as Curriculum[];
      callback(curricula);
    }, (error) => {
      console.error('Curricula subscription error:', error);
    });
  },

  // 특정 반의 커리큘럼 구독
  subscribeCurriculaByClass(classId: string, callback: (curricula: Curriculum[]) => void) {
    const q = query(
      collection(db, CURRICULA_COLLECTION),
      where('classId', '==', classId),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const curricula = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString()
        };
      }) as Curriculum[];
      callback(curricula);
    }, (error) => {
      console.error('Curricula subscription error:', error);
    });
  },

  // 커리큘럼 조회
  async getCurriculumById(id: string): Promise<Curriculum | null> {
    const docRef = doc(db, CURRICULA_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        ...docSnap.data(),
        id: docSnap.id
      } as Curriculum;
    }
    return null;
  },

  // 커리큘럼 생성
  async createCurriculum(data: CreateCurriculumData): Promise<string> {
    const docRef = await addDoc(collection(db, CURRICULA_COLLECTION), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  },

  // 커리큘럼 수정
  async updateCurriculum(id: string, data: UpdateCurriculumData): Promise<void> {
    await updateDoc(doc(db, CURRICULA_COLLECTION, id), {
      ...data,
      updatedAt: serverTimestamp()
    });
  },

  // 커리큘럼 삭제
  async deleteCurriculum(id: string): Promise<void> {
    // 관련 진도 데이터도 삭제
    const progressQuery = query(
      collection(db, PROGRESS_COLLECTION),
      where('curriculumId', '==', id)
    );
    const progressSnapshot = await getDocs(progressQuery);

    const batch = writeBatch(db);
    progressSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    batch.delete(doc(db, CURRICULA_COLLECTION, id));

    await batch.commit();
  },

  // ===== 학생 진도 관련 =====

  // 특정 학생의 진도 실시간 구독
  subscribeStudentProgress(studentId: string, callback: (progress: StudentProgress[]) => void) {
    const q = query(
      collection(db, PROGRESS_COLLECTION),
      where('studentId', '==', studentId)
    );
    return onSnapshot(q, (snapshot) => {
      const progress = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt ? (data.updatedAt as Timestamp)?.toDate().toISOString() : undefined
        };
      }) as StudentProgress[];
      callback(progress);
    }, (error) => {
      console.error('Progress subscription error:', error);
    });
  },

  // 특정 커리큘럼의 모든 학생 진도 구독
  subscribeProgressByCurriculum(curriculumId: string, callback: (progress: StudentProgress[]) => void) {
    const q = query(
      collection(db, PROGRESS_COLLECTION),
      where('curriculumId', '==', curriculumId)
    );
    return onSnapshot(q, (snapshot) => {
      const progress = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString()
        };
      }) as StudentProgress[];
      callback(progress);
    }, (error) => {
      console.error('Progress subscription error:', error);
    });
  },

  // 학생의 특정 커리큘럼 진도 조회
  async getStudentCurriculumProgress(
    studentId: string,
    curriculumId: string
  ): Promise<StudentProgress[]> {
    const q = query(
      collection(db, PROGRESS_COLLECTION),
      where('studentId', '==', studentId),
      where('curriculumId', '==', curriculumId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as StudentProgress[];
  },

  // 진도 상태 업데이트 또는 생성
  async updateProgress(
    studentId: string,
    studentName: string,
    curriculumId: string,
    unitId: string,
    topicId: string,
    status: ProgressStatus,
    notes?: string
  ): Promise<void> {
    // 기존 진도 데이터 확인
    const q = query(
      collection(db, PROGRESS_COLLECTION),
      where('studentId', '==', studentId),
      where('curriculumId', '==', curriculumId),
      where('topicId', '==', topicId)
    );
    const snapshot = await getDocs(q);

    const now = new Date().toISOString();

    if (snapshot.empty) {
      // 새로 생성
      await addDoc(collection(db, PROGRESS_COLLECTION), {
        studentId,
        studentName,
        curriculumId,
        unitId,
        topicId,
        status,
        startedAt: status !== 'not_started' ? now : undefined,
        completedAt: status === 'completed' ? now : undefined,
        notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      // 업데이트
      const docRef = snapshot.docs[0].ref;
      const existingData = snapshot.docs[0].data();

      // 기본 업데이트 데이터
      const baseUpdate = {
        status,
        notes,
        updatedAt: serverTimestamp()
      };

      // 진행중으로 변경 시 시작 시간 기록
      if (status === 'in_progress' && !existingData.startedAt) {
        await updateDoc(docRef, {
          ...baseUpdate,
          startedAt: now
        });
      } else if (status === 'completed') {
        // 완료로 변경 시 완료 시간 기록
        await updateDoc(docRef, {
          ...baseUpdate,
          completedAt: now
        });
      } else {
        await updateDoc(docRef, baseUpdate);
      }
    }
  },

  // 학생의 커리큘럼 진도 요약 계산
  async getStudentCurriculumSummary(
    studentId: string,
    curriculum: Curriculum
  ): Promise<StudentCurriculumSummary> {
    const progress = await this.getStudentCurriculumProgress(studentId, curriculum.id);

    // 총 토픽 수 계산
    const totalTopics = curriculum.units.reduce(
      (sum, unit) => sum + unit.topics.length,
      0
    );

    // 완료/진행중 토픽 수 계산
    let completedTopics = 0;
    let inProgressTopics = 0;

    progress.forEach(p => {
      if (p.status === 'completed') completedTopics++;
      if (p.status === 'in_progress') inProgressTopics++;
    });

    return {
      curriculumId: curriculum.id,
      curriculumTitle: curriculum.title,
      totalTopics,
      completedTopics,
      inProgressTopics,
      progressRate: totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0
    };
  },

  // 반 전체 학생들의 진도 초기화 (커리큘럼 배정)
  async initializeClassProgress(
    curriculumId: string,
    students: { id: string; name: string }[]
  ): Promise<void> {
    const curriculum = await this.getCurriculumById(curriculumId);
    if (!curriculum) throw new Error('Curriculum not found');

    const batch = writeBatch(db);

    for (const student of students) {
      for (const unit of curriculum.units) {
        for (const topic of unit.topics) {
          const progressRef = doc(collection(db, PROGRESS_COLLECTION));
          batch.set(progressRef, {
            studentId: student.id,
            studentName: student.name,
            curriculumId,
            unitId: unit.id,
            topicId: topic.id,
            status: 'not_started',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }
    }

    await batch.commit();
  },

  // 진도 삭제
  async deleteProgress(progressId: string): Promise<void> {
    await deleteDoc(doc(db, PROGRESS_COLLECTION, progressId));
  }
};
