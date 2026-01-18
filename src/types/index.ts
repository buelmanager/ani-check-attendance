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

export interface Student {
  id: string;
  name: string;
  phone?: string;
  parentPhone?: string;
  inviteCode: string;      // 6자리 연결 코드 (ABC123)
  userId?: string;         // Firebase Auth UID (학생 계정 연결)
  parentIds: string[];     // 연결된 부모 IDs
  createdAt: string;
}

export interface Parent {
  id: string;
  userId: string;          // Firebase Auth UID
  name: string;
  email: string;
  phone?: string;
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
