// 시험 유형
export type ExamType = 'unit' | 'mock' | 'midterm' | 'final' | 'quiz' | 'custom';

// 학생 성적
export interface StudentScore {
  studentId: string;
  studentName: string;
  score: number;
  rank?: number;            // 등수
  feedback?: string;        // 개별 피드백
}

// 시험
export interface Exam {
  id: string;
  classId: string;
  className: string;
  examType: ExamType;
  examName: string;          // 시험명
  subject?: string;          // 과목
  maxScore: number;          // 만점
  examDate: string;          // 시험일
  description?: string;      // 설명
  scores: StudentScore[];
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
}

// 시험 생성 시 필요한 데이터
export type CreateExamData = Omit<Exam, 'id' | 'createdAt' | 'updatedAt' | 'scores'>;

// 시험 수정 시 필요한 데이터
export type UpdateExamData = Partial<Omit<Exam, 'id' | 'createdBy' | 'createdByName' | 'createdAt'>>;

// 학생 성적 통계
export interface StudentScoreStats {
  average: number;
  highest: number;
  lowest: number;
  count: number;
  trend: 'up' | 'down' | 'stable';
}

// 반 성적 통계
export interface ClassScoreStats {
  average: number;
  highest: number;
  lowest: number;
  median: number;
  standardDeviation: number;
}

// 시험 유형 라벨
export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  unit: '단원평가',
  mock: '모의고사',
  midterm: '중간고사',
  final: '기말고사',
  quiz: '쪽지시험',
  custom: '기타'
};

// 시험 유형 색상
export const EXAM_TYPE_COLORS: Record<ExamType, { bg: string; text: string }> = {
  unit: { bg: 'bg-blue-100', text: 'text-blue-700' },
  mock: { bg: 'bg-purple-100', text: 'text-purple-700' },
  midterm: { bg: 'bg-orange-100', text: 'text-orange-700' },
  final: { bg: 'bg-red-100', text: 'text-red-700' },
  quiz: { bg: 'bg-green-100', text: 'text-green-700' },
  custom: { bg: 'bg-gray-100', text: 'text-gray-700' }
};

// 성적 등급 계산 (백분율 기준)
export function getGrade(score: number, maxScore: number): string {
  const percentage = (score / maxScore) * 100;
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

// 성적 등급 색상
export function getGradeColor(grade: string): { bg: string; text: string } {
  switch (grade) {
    case 'A': return { bg: 'bg-green-100', text: 'text-green-700' };
    case 'B': return { bg: 'bg-blue-100', text: 'text-blue-700' };
    case 'C': return { bg: 'bg-yellow-100', text: 'text-yellow-700' };
    case 'D': return { bg: 'bg-orange-100', text: 'text-orange-700' };
    default: return { bg: 'bg-red-100', text: 'text-red-700' };
  }
}
