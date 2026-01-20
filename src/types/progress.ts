// 진도 상태
export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';

// 단원 (토픽)
export interface Topic {
  id: string;
  name: string;
  order: number;
  description?: string;
}

// 단원 그룹 (챕터)
export interface Unit {
  id: string;
  name: string;
  order: number;
  topics: Topic[];
}

// 커리큘럼 (반별)
export interface Curriculum {
  id: string;
  classId: string;
  className: string;
  subject?: string;            // 과목
  title: string;               // 커리큘럼 제목
  description?: string;
  units: Unit[];
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
}

// 학생별 진도
export interface StudentProgress {
  id: string;
  studentId: string;
  studentName: string;
  curriculumId: string;
  topicId: string;
  unitId: string;
  status: ProgressStatus;
  startedAt?: string;
  completedAt?: string;
  notes?: string;              // 메모
  createdAt: string;
  updatedAt?: string;
}

// 커리큘럼 생성 시 필요한 데이터
export type CreateCurriculumData = Omit<Curriculum, 'id' | 'createdAt' | 'updatedAt'>;

// 커리큘럼 수정 시 필요한 데이터
export type UpdateCurriculumData = Partial<Omit<Curriculum, 'id' | 'createdBy' | 'createdByName' | 'createdAt'>>;

// 진도 상태 라벨
export const PROGRESS_STATUS_LABELS: Record<ProgressStatus, string> = {
  not_started: '미시작',
  in_progress: '진행중',
  completed: '완료'
};

// 진도 상태 색상
export const PROGRESS_STATUS_COLORS: Record<ProgressStatus, { bg: string; text: string; border: string }> = {
  not_started: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' },
  in_progress: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-400' },
  completed: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-500' }
};

// 진도율 계산
export function calculateProgressRate(
  completedCount: number,
  totalCount: number
): number {
  if (totalCount === 0) return 0;
  return Math.round((completedCount / totalCount) * 100);
}

// 학생의 커리큘럼 진도 요약
export interface StudentCurriculumSummary {
  curriculumId: string;
  curriculumTitle: string;
  totalTopics: number;
  completedTopics: number;
  inProgressTopics: number;
  progressRate: number;
}
