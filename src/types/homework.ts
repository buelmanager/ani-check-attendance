// 숙제 제출 상태
export type SubmissionStatus = 'pending' | 'submitted' | 'late' | 'checked';

// 첨부파일 (notice.ts와 동일 구조)
export interface Attachment {
  name: string;
  url: string;
  type: string;
  size?: number;
}

// 학생별 숙제 제출 정보
export interface HomeworkSubmission {
  studentId: string;
  studentName: string;
  status: SubmissionStatus;
  submittedAt?: string;
  content?: string;              // 제출 내용 (텍스트)
  attachments?: Attachment[];    // 제출 첨부파일
  feedback?: string;             // 선생님 피드백
  checkedAt?: string;            // 확인 시간
  checkedBy?: string;            // 확인한 관리자 ID
}

// 숙제
export interface Homework {
  id: string;
  classId: string;
  className: string;
  title: string;
  description: string;
  dueDate: string;               // 마감일 (YYYY-MM-DD)
  attachments?: Attachment[];    // 숙제 관련 첨부파일
  studentIds: string[];          // 대상 학생 ID 목록
  submissions: HomeworkSubmission[];
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
}

// 숙제 생성 시 필요한 데이터
export type CreateHomeworkData = Omit<Homework, 'id' | 'createdAt' | 'updatedAt' | 'submissions'>;

// 숙제 수정 시 필요한 데이터
export type UpdateHomeworkData = Partial<Omit<Homework, 'id' | 'createdBy' | 'createdByName' | 'createdAt'>>;

// 숙제 현황 통계
export interface HomeworkStats {
  total: number;
  pending: number;
  submitted: number;
  late: number;
  checked: number;
}

// 제출 상태 라벨
export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  pending: '미제출',
  submitted: '제출완료',
  late: '지각제출',
  checked: '확인완료'
};

// 제출 상태 색상
export const SUBMISSION_STATUS_COLORS: Record<SubmissionStatus, { bg: string; text: string }> = {
  pending: { bg: 'bg-red-100', text: 'text-red-700' },
  submitted: { bg: 'bg-blue-100', text: 'text-blue-700' },
  late: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  checked: { bg: 'bg-green-100', text: 'text-green-700' }
};
