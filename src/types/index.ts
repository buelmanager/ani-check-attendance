// 사용자 역할
export type UserRole = 'admin' | 'student' | 'parent';

export interface Class {
  id: string;
  name: string;
  schedule: string;
  time: string;                          // 기본 시간
  timeByDay?: Record<string, string>;    // 요일별 다른 시간 (예: { "월": "14:00", "수": "16:00" })
  studentIds: string[];
  createdAt: string;
}

// 원생 상태 변경 이력
export interface StatusChange {
  status: StudentStatus;
  changedAt: string;
  reason?: string;  // 휴원/퇴원 사유
}

// 원생 상태
export type StudentStatus = 'active' | 'inactive' | 'withdrawn';

// 학년 타입
export type GradeLevel =
  | '미취학'
  | '초1' | '초2' | '초3' | '초4' | '초5' | '초6'
  | '중1' | '중2' | '중3'
  | '고1' | '고2' | '고3'
  | '성인';

export interface Student {
  id: string;
  name: string;
  phone?: string;
  parentPhone?: string;
  inviteCode: string;      // 6자리 연결 코드 (ABC123)
  userId?: string;         // Firebase Auth UID (학생 계정 연결)
  parentIds: string[];     // 연결된 부모 IDs
  createdAt: string;

  // 추가 프로필 정보
  profileImage?: string;      // 프로필 사진 URL
  birthDate?: string;         // 생년월일 (YYYY-MM-DD)
  gender?: 'male' | 'female'; // 성별
  school?: string;            // 학교명
  grade?: GradeLevel;         // 학년
  address?: string;           // 주소
  emergencyContact?: string;  // 긴급연락처
  notes?: string;             // 메모/특이사항

  // 상태 관리
  status: StudentStatus;      // 재원/휴원/퇴원
  enrolledAt?: string;        // 입학일
  statusHistory?: StatusChange[]; // 상태 변경 이력
}

export interface Parent {
  id: string;
  userId: string;          // Firebase Auth UID
  name: string;
  email: string;
  phone?: string;
  relationType?: 'father' | 'mother' | 'guardian';  // 관계 유형
  studentIds: string[];    // 연결된 자녀 IDs
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorId: string;        // 작성자 (관리자 ID)
  authorName?: string;     // 작성자 이름
  targetType: 'all' | 'class' | 'student';
  classIds?: string[];     // targetType이 'class'일 때
  studentIds?: string[];   // targetType이 'student'일 때
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;          // 수신자 Firebase Auth UID
  type: 'checkin' | 'absent' | 'late' | 'announcement';
  title: string;
  message: string;
  isRead: boolean;
  relatedId?: string;      // 관련 출석/공지 ID
  createdAt: string;
}

export interface Attendance {
  id: string;
  classId: string;
  studentId: string;
  date: string;
  status: 'present' | 'late' | 'absent' | 'excused';
  checkInTime?: string;
  checkInMethod: 'qr' | 'manual' | 'gps';
  absentReason?: string;  // 결석 사유
  createdAt?: string;
  updatedAt?: string;
}
