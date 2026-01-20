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
  Exam,
  CreateExamData,
  UpdateExamData,
  StudentScore,
  ClassScoreStats
} from '../types/score';

const COLLECTION = 'exams';

// 통계 계산 헬퍼 함수
function calculateStats(scores: number[]): ClassScoreStats {
  if (scores.length === 0) {
    return { average: 0, highest: 0, lowest: 0, median: 0, standardDeviation: 0 };
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const sum = scores.reduce((acc, val) => acc + val, 0);
  const average = sum / scores.length;

  // 중앙값
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;

  // 표준편차
  const squaredDiffs = scores.map(score => Math.pow(score - average, 2));
  const avgSquaredDiff = squaredDiffs.reduce((acc, val) => acc + val, 0) / scores.length;
  const standardDeviation = Math.sqrt(avgSquaredDiff);

  return {
    average: Math.round(average * 10) / 10,
    highest: Math.max(...scores),
    lowest: Math.min(...scores),
    median: Math.round(median * 10) / 10,
    standardDeviation: Math.round(standardDeviation * 10) / 10
  };
}

// 등수 계산
function calculateRanks(scores: StudentScore[]): StudentScore[] {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  let currentRank = 1;
  let previousScore = -1;
  let skipCount = 0;

  return scores.map(score => {
    const sortedIndex = sorted.findIndex(s => s.studentId === score.studentId);
    const sortedScore = sorted[sortedIndex];

    if (sortedScore.score !== previousScore) {
      currentRank += skipCount;
      skipCount = 1;
    } else {
      skipCount++;
    }

    previousScore = sortedScore.score;

    // 같은 점수면 같은 등수
    const rank = sorted.filter((s, i) => i < sortedIndex && s.score > sortedScore.score).length + 1;

    return { ...score, rank };
  });
}

export const scoreService = {
  // 전체 시험 실시간 구독
  subscribeAll(callback: (exams: Exam[]) => void) {
    const q = query(collection(db, COLLECTION), orderBy('examDate', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const exams = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt ? (data.updatedAt as Timestamp)?.toDate().toISOString() : undefined,
          scores: data.scores || []
        };
      }) as Exam[];
      callback(exams);
    }, (error) => {
      console.error('Exams subscription error:', error);
    });
  },

  // 특정 반의 시험 실시간 구독
  subscribeByClass(classId: string, callback: (exams: Exam[]) => void) {
    // 복합 인덱스 없이 classId만 필터링 (클라이언트에서 정렬)
    const q = query(
      collection(db, COLLECTION),
      where('classId', '==', classId)
    );
    return onSnapshot(q, (snapshot) => {
      const exams = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          scores: data.scores || []
        };
      }) as Exam[];
      // 클라이언트에서 정렬
      exams.sort((a, b) => new Date(b.examDate).getTime() - new Date(a.examDate).getTime());
      callback(exams);
    }, (error) => {
      console.error('Exams subscription error:', error);
      // 에러 발생 시 빈 배열 반환
      callback([]);
    });
  },

  // 전체 시험 조회 (일회성)
  async getAll(): Promise<Exam[]> {
    const q = query(collection(db, COLLECTION), orderBy('examDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      scores: doc.data().scores || []
    })) as Exam[];
  },

  // 특정 시험 조회
  async getById(id: string): Promise<Exam | null> {
    const docRef = doc(db, COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        ...docSnap.data(),
        id: docSnap.id,
        scores: docSnap.data().scores || []
      } as Exam;
    }
    return null;
  },

  // 특정 학생의 시험 조회
  async getByStudent(studentId: string): Promise<Exam[]> {
    const all = await this.getAll();
    return all.filter(exam =>
      exam.scores.some(score => score.studentId === studentId)
    );
  },

  // 시험 생성
  async create(data: CreateExamData): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      scores: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  },

  // 시험 생성 (학생 목록 포함)
  async createWithStudents(
    data: CreateExamData,
    students: { id: string; name: string }[]
  ): Promise<string> {
    const initialScores: StudentScore[] = students.map(student => ({
      studentId: student.id,
      studentName: student.name,
      score: 0
    }));

    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      scores: initialScores,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  },

  // 시험 수정
  async update(id: string, data: UpdateExamData): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), {
      ...data,
      updatedAt: serverTimestamp()
    });
  },

  // 시험 삭제
  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  },

  // 성적 입력/수정
  async updateScores(id: string, scores: StudentScore[]): Promise<void> {
    // 등수 계산
    const scoresWithRanks = calculateRanks(scores);

    await updateDoc(doc(db, COLLECTION, id), {
      scores: scoresWithRanks,
      updatedAt: serverTimestamp()
    });
  },

  // 개별 학생 성적 수정
  async updateStudentScore(
    examId: string,
    studentId: string,
    score: number,
    feedback?: string
  ): Promise<void> {
    const exam = await this.getById(examId);
    if (!exam) throw new Error('Exam not found');

    const updatedScores = exam.scores.map(s => {
      if (s.studentId === studentId) {
        return { ...s, score, feedback };
      }
      return s;
    });

    // 등수 재계산
    const scoresWithRanks = calculateRanks(updatedScores);

    await updateDoc(doc(db, COLLECTION, examId), {
      scores: scoresWithRanks,
      updatedAt: serverTimestamp()
    });
  },

  // 반 통계 계산
  getClassStats(exam: Exam): ClassScoreStats {
    const scores = exam.scores.map(s => s.score);
    return calculateStats(scores);
  },

  // 학생의 성적 추이 조회
  async getStudentTrend(studentId: string, limit: number = 10): Promise<{ exam: Exam; score: StudentScore }[]> {
    const exams = await this.getByStudent(studentId);
    return exams
      .slice(0, limit)
      .map(exam => ({
        exam,
        score: exam.scores.find(s => s.studentId === studentId)!
      }))
      .filter(item => item.score);
  },

  // 특정 학생의 성적 실시간 구독
  subscribeByStudent(studentId: string, callback: (exams: Exam[]) => void) {
    const q = query(collection(db, COLLECTION), orderBy('examDate', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const allExams = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          scores: data.scores || []
        };
      }) as Exam[];

      // 해당 학생의 성적이 있는 시험만 필터
      const studentExams = allExams.filter(exam =>
        exam.scores.some(score => score.studentId === studentId)
      );

      callback(studentExams);
    }, (error) => {
      console.error('Exams subscription error:', error);
      // 에러 발생 시 빈 배열 반환
      callback([]);
    });
  }
};
