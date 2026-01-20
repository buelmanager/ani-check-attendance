// 상담 유형
export type ConsultationType = 'initial' | 'regular' | 'issue' | 'parent_request';

// 상담 카테고리
export type ConsultationCategory =
  | '학습상담'
  | '진로상담'
  | '행동상담'
  | '학부모상담'
  | '기타';

export const CONSULTATION_TYPE_LABELS: Record<ConsultationType, string> = {
  initial: '초기상담',
  regular: '정기상담',
  issue: '문제상담',
  parent_request: '학부모요청'
};

export const CONSULTATION_CATEGORIES: ConsultationCategory[] = [
  '학습상담',
  '진로상담',
  '행동상담',
  '학부모상담',
  '기타'
];

export interface Consultation {
  id: string;
  studentId: string;
  studentName: string;          // 조회 편의를 위한 비정규화
  counselorId: string;          // 상담자 (관리자) ID
  counselorName: string;        // 상담자 이름
  type: ConsultationType;
  category: ConsultationCategory;
  title: string;                // 상담 제목
  content: string;              // 상담 내용
  result?: string;              // 조치사항/결과
  nextAction?: string;          // 후속 조치
  nextDate?: string;            // 다음 상담 예정일
  isCompleted: boolean;         // 상담 완료 여부
  createdAt: string;
  updatedAt?: string;
}

// 상담 생성 시 필요한 데이터
export type CreateConsultationData = Omit<Consultation, 'id' | 'createdAt' | 'updatedAt'>;

// 상담 수정 시 필요한 데이터
export type UpdateConsultationData = Partial<Omit<Consultation, 'id' | 'studentId' | 'createdAt'>>;
