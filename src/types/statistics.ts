import type { Attendance } from './index';

// 출석 상태 타입
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

// 기간 타입
export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

// 기본 출석 통계
export interface AttendanceStats {
  total: number;        // 전체 기록 수
  present: number;      // 출석 수
  late: number;         // 지각 수
  absent: number;       // 결석 수
  excused: number;      // 사유결석 수
  attendanceRate: number;    // 출석률 (출석+지각 / 전체) * 100
  punctualityRate: number;   // 정시 출석률 (출석 / 전체) * 100
}

// 일별 출석 통계
export interface DailyStats extends AttendanceStats {
  date: string;         // YYYY-MM-DD
  dayOfWeek: number;    // 0-6 (일-토)
}

// 주별 출석 통계
export interface WeeklyStats extends AttendanceStats {
  weekNumber: number;   // 주차
  startDate: string;    // 주 시작일
  endDate: string;      // 주 종료일
  dailyBreakdown: DailyStats[];
}

// 월별 출석 통계
export interface MonthlyStats extends AttendanceStats {
  year: number;
  month: number;        // 1-12
  weeklyBreakdown: WeeklyStats[];
  dailyBreakdown: DailyStats[];
}

// 학생별 출석 통계
export interface StudentAttendanceStats extends AttendanceStats {
  studentId: string;
  studentName: string;
  className?: string;
  grade?: string;
  rank?: number;              // 출석률 순위
  consecutivePresent: number; // 연속 출석일
  consecutiveAbsent: number;  // 연속 결석일
  trend: 'improving' | 'declining' | 'stable';  // 출석 추세
  trendPercentage: number;    // 추세 변화율
  monthlyStats?: MonthlyStats[];
  weeklyStats?: WeeklyStats[];
  recentAttendances?: Attendance[];
}

// 반별 출석 통계
export interface ClassAttendanceStats extends AttendanceStats {
  classId: string;
  className: string;
  schedule: string;
  studentCount: number;
  averageAttendanceRate: number;
  topStudents: StudentAttendanceStats[];
  bottomStudents: StudentAttendanceStats[];
  dailyBreakdown?: DailyStats[];
  weeklyBreakdown?: WeeklyStats[];
  monthlyBreakdown?: MonthlyStats[];
}

// 학원 전체 통계
export interface AcademyStats extends AttendanceStats {
  totalStudents: number;
  activeStudents: number;
  totalClasses: number;
  averageAttendanceRate: number;
  todayStats: DailyStats;
  weeklyTrend: WeeklyStats[];
  monthlyTrend: MonthlyStats[];
  classRankings: ClassAttendanceStats[];
  studentRankings: StudentAttendanceStats[];
  alertStudents: StudentAttendanceStats[];  // 주의 필요 학생 (연속 결석 등)
}

// 시간대별 출석 통계 (어느 시간대에 출석이 많은지)
export interface HourlyStats {
  hour: number;         // 0-23
  count: number;
  presentCount: number;
  lateCount: number;
}

// 요일별 출석 통계
export interface DayOfWeekStats {
  dayOfWeek: number;    // 0-6
  dayName: string;      // 일-토
  stats: AttendanceStats;
}

// 출석 체크 방법별 통계
export interface CheckInMethodStats {
  qr: number;
  manual: number;
  gps: number;
}

// 출석률 변화 추세
export interface AttendanceTrend {
  period: string;
  rate: number;
  change: number;       // 이전 기간 대비 변화
  changePercentage: number;
}

// 필터 옵션
export interface StatisticsFilter {
  startDate?: string;
  endDate?: string;
  classIds?: string[];
  studentIds?: string[];
  status?: AttendanceStatus[];
  period?: PeriodType;
}

// 비교 통계 (기간 비교용)
export interface ComparisonStats {
  current: AttendanceStats;
  previous: AttendanceStats;
  change: {
    total: number;
    present: number;
    late: number;
    absent: number;
    attendanceRate: number;
  };
}

// 출석 패턴 분석
export interface AttendancePattern {
  bestDay: { dayOfWeek: number; dayName: string; rate: number };
  worstDay: { dayOfWeek: number; dayName: string; rate: number };
  peakHour: { hour: number; count: number };
  averageCheckInTime: string;
  mostCommonLateTime: string;
}

// 경고/알림용 학생 정보
export interface AlertStudent {
  studentId: string;
  studentName: string;
  className: string;
  alertType: 'consecutive_absent' | 'low_attendance' | 'frequent_late' | 'pattern_change';
  alertMessage: string;
  value: number;        // 연속 결석일 수, 출석률 등
  threshold: number;    // 기준치
}

// 대시보드 요약 카드용
export interface DashboardSummary {
  todayAttendance: {
    checked: number;
    expected: number;
    rate: number;
  };
  weeklyComparison: ComparisonStats;
  monthlyComparison: ComparisonStats;
  alerts: AlertStudent[];
  recentActivity: {
    time: string;
    studentName: string;
    className: string;
    status: AttendanceStatus;
  }[];
}

// 출석 상태별 라벨
export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: '출석',
  late: '지각',
  absent: '결석',
  excused: '사유결석'
};

// 출석 상태별 색상
export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, { bg: string; text: string; border: string }> = {
  present: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-500' },
  late: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-500' },
  absent: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-500' },
  excused: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-500' }
};

// 요일 라벨
export const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
export const DAY_LABELS_FULL = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

// 월 라벨
export const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
