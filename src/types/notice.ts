// 알림장 대상 유형
export type NoticeTargetType = 'student' | 'class' | 'all';

// 알림장 상태
export type NoticeStatus = 'draft' | 'scheduled' | 'sent';

export interface Attachment {
  name: string;
  url: string;
  type: string;
  size?: number;
}

export interface ReadReceipt {
  userId: string;          // 읽은 사용자 ID (학부모 또는 학생)
  userName: string;        // 읽은 사용자 이름
  readAt: string;          // 읽은 시간
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  targetType: NoticeTargetType;
  targetIds: string[];           // 대상 학생/반 ID 목록
  targetNames: string[];         // 대상 이름 (조회 편의)
  attachments?: Attachment[];
  readReceipts: ReadReceipt[];
  status: NoticeStatus;
  createdBy: string;             // 작성자 ID
  createdByName: string;         // 작성자 이름
  createdAt: string;
  updatedAt?: string;
  scheduledAt?: string;          // 예약 발송 시간
  sentAt?: string;               // 실제 발송 시간
}

// 알림장 생성 시 필요한 데이터
export type CreateNoticeData = Omit<Notice, 'id' | 'createdAt' | 'updatedAt' | 'readReceipts' | 'sentAt'>;

// 알림장 수정 시 필요한 데이터
export type UpdateNoticeData = Partial<Omit<Notice, 'id' | 'createdBy' | 'createdByName' | 'createdAt'>>;

// 알림장 템플릿
export interface NoticeTemplate {
  id: string;
  name: string;
  title: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

// 템플릿 변수 치환용
export const TEMPLATE_VARIABLES = {
  '{학생이름}': '학생 이름으로 치환됩니다',
  '{반이름}': '반 이름으로 치환됩니다',
  '{오늘날짜}': '오늘 날짜로 치환됩니다',
  '{내일날짜}': '내일 날짜로 치환됩니다'
};
