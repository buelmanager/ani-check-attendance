import type { Attendance, Student, Class } from '../types';
import type {
  AttendanceStats,
  DailyStats,
  WeeklyStats,
  MonthlyStats,
  StudentAttendanceStats,
  ClassAttendanceStats,
  AcademyStats,
  HourlyStats,
  DayOfWeekStats,
  CheckInMethodStats,
  AttendanceTrend,
  ComparisonStats,
  AttendancePattern,
  AlertStudent,
  DashboardSummary,
  StatisticsFilter,
  AttendanceStatus
} from '../types/statistics';
import { DAY_LABELS } from '../types/statistics';

// 유틸리티 함수들
const getDateString = (date: Date): string => date.toISOString().split('T')[0];

const getWeekNumber = (date: Date): number => {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

const getWeekRange = (date: Date): { start: Date; end: Date } => {
  const day = date.getDay();
  const start = new Date(date);
  start.setDate(date.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
};

// 기본 출석 통계 계산
const calculateBasicStats = (attendances: Attendance[]): AttendanceStats => {
  const total = attendances.length;
  const present = attendances.filter(a => a.status === 'present').length;
  const late = attendances.filter(a => a.status === 'late').length;
  const absent = attendances.filter(a => a.status === 'absent').length;
  const excused = attendances.filter(a => a.status === 'excused').length;

  return {
    total,
    present,
    late,
    absent,
    excused,
    attendanceRate: total > 0 ? Math.round(((present + late) / total) * 100 * 10) / 10 : 0,
    punctualityRate: total > 0 ? Math.round((present / total) * 100 * 10) / 10 : 0
  };
};

// 연속 출석/결석 계산
const calculateConsecutive = (
  attendances: Attendance[],
  status: 'present' | 'absent'
): number => {
  if (attendances.length === 0) return 0;

  const sorted = [...attendances].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  let consecutive = 0;
  for (const attendance of sorted) {
    if (status === 'present') {
      if (attendance.status === 'present' || attendance.status === 'late') {
        consecutive++;
      } else {
        break;
      }
    } else {
      if (attendance.status === 'absent') {
        consecutive++;
      } else {
        break;
      }
    }
  }

  return consecutive;
};

// 추세 계산 (최근 vs 이전)
const calculateTrend = (
  recentAttendances: Attendance[],
  previousAttendances: Attendance[]
): { trend: 'improving' | 'declining' | 'stable'; percentage: number } => {
  const recentStats = calculateBasicStats(recentAttendances);
  const previousStats = calculateBasicStats(previousAttendances);

  const diff = recentStats.attendanceRate - previousStats.attendanceRate;

  if (Math.abs(diff) < 5) {
    return { trend: 'stable', percentage: diff };
  } else if (diff > 0) {
    return { trend: 'improving', percentage: diff };
  } else {
    return { trend: 'declining', percentage: diff };
  }
};

export const statisticsService = {
  // ==================== 기본 통계 ====================

  // 기간별 출석 필터링
  filterByPeriod(
    attendances: Attendance[],
    filter: StatisticsFilter
  ): Attendance[] {
    let filtered = [...attendances];

    if (filter.startDate) {
      filtered = filtered.filter(a => a.date >= filter.startDate!);
    }

    if (filter.endDate) {
      filtered = filtered.filter(a => a.date <= filter.endDate!);
    }

    if (filter.classIds && filter.classIds.length > 0) {
      filtered = filtered.filter(a => filter.classIds!.includes(a.classId));
    }

    if (filter.studentIds && filter.studentIds.length > 0) {
      filtered = filtered.filter(a => filter.studentIds!.includes(a.studentId));
    }

    if (filter.status && filter.status.length > 0) {
      filtered = filtered.filter(a => filter.status!.includes(a.status as AttendanceStatus));
    }

    return filtered;
  },

  // 일별 통계
  getDailyStats(attendances: Attendance[], date: string): DailyStats {
    const dayAttendances = attendances.filter(a => a.date === date);
    const stats = calculateBasicStats(dayAttendances);
    const dateObj = new Date(date);

    return {
      ...stats,
      date,
      dayOfWeek: dateObj.getDay()
    };
  },

  // 날짜 범위의 일별 통계
  getDailyStatsRange(
    attendances: Attendance[],
    startDate: string,
    endDate: string
  ): DailyStats[] {
    const stats: DailyStats[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = getDateString(d);
      stats.push(this.getDailyStats(attendances, dateStr));
    }

    return stats;
  },

  // 주별 통계
  getWeeklyStats(attendances: Attendance[], date: Date): WeeklyStats {
    const { start, end } = getWeekRange(date);
    const startStr = getDateString(start);
    const endStr = getDateString(end);

    const weekAttendances = attendances.filter(
      a => a.date >= startStr && a.date <= endStr
    );

    const stats = calculateBasicStats(weekAttendances);
    const dailyBreakdown = this.getDailyStatsRange(attendances, startStr, endStr);

    return {
      ...stats,
      weekNumber: getWeekNumber(date),
      startDate: startStr,
      endDate: endStr,
      dailyBreakdown
    };
  },

  // 월별 통계
  getMonthlyStats(attendances: Attendance[], year: number, month: number): MonthlyStats {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    const monthAttendances = attendances.filter(
      a => a.date >= startDate && a.date <= endDate
    );

    const stats = calculateBasicStats(monthAttendances);
    const dailyBreakdown = this.getDailyStatsRange(attendances, startDate, endDate);

    // 주별 통계 계산
    const weeklyBreakdown: WeeklyStats[] = [];
    const weekMap = new Map<number, Attendance[]>();

    monthAttendances.forEach(a => {
      const weekNum = getWeekNumber(new Date(a.date));
      if (!weekMap.has(weekNum)) {
        weekMap.set(weekNum, []);
      }
      weekMap.get(weekNum)!.push(a);
    });

    weekMap.forEach((weekAttendances) => {
      if (weekAttendances.length > 0) {
        const firstDate = new Date(weekAttendances[0].date);
        weeklyBreakdown.push(this.getWeeklyStats(attendances, firstDate));
      }
    });

    return {
      ...stats,
      year,
      month,
      weeklyBreakdown: weeklyBreakdown.sort((a, b) => a.weekNumber - b.weekNumber),
      dailyBreakdown
    };
  },

  // ==================== 학생별 통계 ====================

  getStudentStats(
    student: Student,
    attendances: Attendance[],
    classes: Class[],
    options?: { includeMonthly?: boolean; includeWeekly?: boolean; recentDays?: number }
  ): StudentAttendanceStats {
    const studentAttendances = attendances.filter(a => a.studentId === student.id);
    const stats = calculateBasicStats(studentAttendances);

    // 소속 반 찾기
    const studentClass = classes.find(c => c.studentIds.includes(student.id));

    // 연속 출석/결석 계산
    const consecutivePresent = calculateConsecutive(studentAttendances, 'present');
    const consecutiveAbsent = calculateConsecutive(studentAttendances, 'absent');

    // 추세 계산 (최근 2주 vs 그 전 2주)
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const recentAttendances = studentAttendances.filter(
      a => new Date(a.date) >= twoWeeksAgo
    );
    const previousAttendances = studentAttendances.filter(
      a => new Date(a.date) >= fourWeeksAgo && new Date(a.date) < twoWeeksAgo
    );

    const { trend, percentage } = calculateTrend(recentAttendances, previousAttendances);

    const result: StudentAttendanceStats = {
      ...stats,
      studentId: student.id,
      studentName: student.name,
      className: studentClass?.name,
      grade: student.grade,
      consecutivePresent,
      consecutiveAbsent,
      trend,
      trendPercentage: percentage
    };

    // 월별 통계 (옵션)
    if (options?.includeMonthly) {
      const monthlyStats: MonthlyStats[] = [];
      const now = new Date();
      for (let i = 0; i < 6; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthlyStats.push(
          this.getMonthlyStats(studentAttendances, date.getFullYear(), date.getMonth() + 1)
        );
      }
      result.monthlyStats = monthlyStats.reverse();
    }

    // 주별 통계 (옵션)
    if (options?.includeWeekly) {
      const weeklyStats: WeeklyStats[] = [];
      const now = new Date();
      for (let i = 0; i < 8; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i * 7);
        weeklyStats.push(this.getWeeklyStats(studentAttendances, date));
      }
      result.weeklyStats = weeklyStats.reverse();
    }

    // 최근 출석 기록 (옵션)
    if (options?.recentDays) {
      result.recentAttendances = studentAttendances
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, options.recentDays);
    }

    return result;
  },

  // 전체 학생 통계 (랭킹 포함)
  getAllStudentStats(
    students: Student[],
    attendances: Attendance[],
    classes: Class[],
    filter?: StatisticsFilter
  ): StudentAttendanceStats[] {
    const filteredAttendances = filter
      ? this.filterByPeriod(attendances, filter)
      : attendances;

    const stats = students
      .filter(s => s.status === 'active')
      .map(student => this.getStudentStats(student, filteredAttendances, classes));

    // 출석률로 정렬하고 순위 부여
    stats.sort((a, b) => b.attendanceRate - a.attendanceRate);
    stats.forEach((s, index) => {
      s.rank = index + 1;
    });

    return stats;
  },

  // ==================== 반별 통계 ====================

  getClassStats(
    cls: Class,
    students: Student[],
    attendances: Attendance[],
    options?: { includeDaily?: boolean; includeWeekly?: boolean; includeMonthly?: boolean }
  ): ClassAttendanceStats {
    const classAttendances = attendances.filter(a => a.classId === cls.id);
    const classStudents = students.filter(s => cls.studentIds.includes(s.id));
    const stats = calculateBasicStats(classAttendances);

    // 학생별 통계
    const studentStats = classStudents.map(student =>
      this.getStudentStats(student, classAttendances, [cls])
    );
    studentStats.sort((a, b) => b.attendanceRate - a.attendanceRate);

    const result: ClassAttendanceStats = {
      ...stats,
      classId: cls.id,
      className: cls.name,
      schedule: cls.schedule,
      studentCount: classStudents.length,
      averageAttendanceRate: stats.attendanceRate,
      topStudents: studentStats.slice(0, 5),
      bottomStudents: studentStats.slice(-5).reverse()
    };

    // 일별 통계 (최근 30일)
    if (options?.includeDaily) {
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      result.dailyBreakdown = this.getDailyStatsRange(
        classAttendances,
        getDateString(thirtyDaysAgo),
        getDateString(now)
      );
    }

    // 주별 통계 (최근 8주)
    if (options?.includeWeekly) {
      const weeklyBreakdown: WeeklyStats[] = [];
      const now = new Date();
      for (let i = 0; i < 8; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i * 7);
        weeklyBreakdown.push(this.getWeeklyStats(classAttendances, date));
      }
      result.weeklyBreakdown = weeklyBreakdown.reverse();
    }

    // 월별 통계 (최근 6개월)
    if (options?.includeMonthly) {
      const monthlyBreakdown: MonthlyStats[] = [];
      const now = new Date();
      for (let i = 0; i < 6; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthlyBreakdown.push(
          this.getMonthlyStats(classAttendances, date.getFullYear(), date.getMonth() + 1)
        );
      }
      result.monthlyBreakdown = monthlyBreakdown.reverse();
    }

    return result;
  },

  // 전체 반 통계 (랭킹)
  getAllClassStats(
    classes: Class[],
    students: Student[],
    attendances: Attendance[],
    filter?: StatisticsFilter
  ): ClassAttendanceStats[] {
    const filteredAttendances = filter
      ? this.filterByPeriod(attendances, filter)
      : attendances;

    return classes
      .map(cls => this.getClassStats(cls, students, filteredAttendances))
      .sort((a, b) => b.attendanceRate - a.attendanceRate);
  },

  // ==================== 학원 전체 통계 ====================

  getAcademyStats(
    students: Student[],
    classes: Class[],
    attendances: Attendance[]
  ): AcademyStats {
    const activeStudents = students.filter(s => s.status === 'active');
    const stats = calculateBasicStats(attendances);

    // 오늘 통계
    const today = getDateString(new Date());
    const todayStats = this.getDailyStats(attendances, today);

    // 주별 추세 (8주)
    const weeklyTrend: WeeklyStats[] = [];
    const now = new Date();
    for (let i = 0; i < 8; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i * 7);
      weeklyTrend.push(this.getWeeklyStats(attendances, date));
    }

    // 월별 추세 (6개월)
    const monthlyTrend: MonthlyStats[] = [];
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyTrend.push(
        this.getMonthlyStats(attendances, date.getFullYear(), date.getMonth() + 1)
      );
    }

    // 반별 랭킹
    const classRankings = this.getAllClassStats(classes, students, attendances);

    // 학생별 랭킹
    const studentRankings = this.getAllStudentStats(students, attendances, classes);

    // 주의 필요 학생 (연속 결석 2일 이상 또는 출석률 70% 미만)
    const alertStudents = studentRankings.filter(
      s => s.consecutiveAbsent >= 2 || s.attendanceRate < 70
    );

    return {
      ...stats,
      totalStudents: students.length,
      activeStudents: activeStudents.length,
      totalClasses: classes.length,
      averageAttendanceRate: stats.attendanceRate,
      todayStats,
      weeklyTrend: weeklyTrend.reverse(),
      monthlyTrend: monthlyTrend.reverse(),
      classRankings,
      studentRankings,
      alertStudents
    };
  },

  // ==================== 특수 통계 ====================

  // 시간대별 출석 통계
  getHourlyStats(attendances: Attendance[]): HourlyStats[] {
    const hourly = new Map<number, { total: number; present: number; late: number }>();

    for (let i = 0; i < 24; i++) {
      hourly.set(i, { total: 0, present: 0, late: 0 });
    }

    attendances.forEach(a => {
      if (a.checkInTime) {
        const hour = parseInt(a.checkInTime.split(':')[0], 10);
        // 유효한 시간 범위인지 확인 (0-23)
        if (!isNaN(hour) && hour >= 0 && hour < 24) {
          const data = hourly.get(hour);
          if (data) {
            data.total++;
            if (a.status === 'present') data.present++;
            if (a.status === 'late') data.late++;
          }
        }
      }
    });

    return Array.from(hourly.entries()).map(([hour, data]) => ({
      hour,
      count: data.total,
      presentCount: data.present,
      lateCount: data.late
    }));
  },

  // 요일별 출석 통계
  getDayOfWeekStats(attendances: Attendance[]): DayOfWeekStats[] {
    const dayStats = new Map<number, Attendance[]>();

    for (let i = 0; i < 7; i++) {
      dayStats.set(i, []);
    }

    attendances.forEach(a => {
      const dayOfWeek = new Date(a.date).getDay();
      dayStats.get(dayOfWeek)!.push(a);
    });

    return Array.from(dayStats.entries()).map(([dayOfWeek, dayAttendances]) => ({
      dayOfWeek,
      dayName: DAY_LABELS[dayOfWeek],
      stats: calculateBasicStats(dayAttendances)
    }));
  },

  // 체크인 방법별 통계
  getCheckInMethodStats(attendances: Attendance[]): CheckInMethodStats {
    return {
      qr: attendances.filter(a => a.checkInMethod === 'qr').length,
      manual: attendances.filter(a => a.checkInMethod === 'manual').length,
      gps: attendances.filter(a => a.checkInMethod === 'gps').length
    };
  },

  // 출석률 변화 추세
  getAttendanceTrends(attendances: Attendance[], periods: number = 12): AttendanceTrend[] {
    const trends: AttendanceTrend[] = [];
    const now = new Date();

    for (let i = 0; i < periods; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStats = this.getMonthlyStats(
        attendances,
        date.getFullYear(),
        date.getMonth() + 1
      );

      const prevMonthStats = i < periods - 1
        ? this.getMonthlyStats(
            attendances,
            i + 1 === 12 ? date.getFullYear() - 1 : date.getFullYear(),
            i + 1 === 12 ? 12 : date.getMonth()
          )
        : null;

      trends.push({
        period: `${date.getFullYear()}년 ${date.getMonth() + 1}월`,
        rate: monthStats.attendanceRate,
        change: prevMonthStats
          ? monthStats.attendanceRate - prevMonthStats.attendanceRate
          : 0,
        changePercentage: prevMonthStats && prevMonthStats.attendanceRate > 0
          ? ((monthStats.attendanceRate - prevMonthStats.attendanceRate) / prevMonthStats.attendanceRate) * 100
          : 0
      });
    }

    return trends.reverse();
  },

  // 기간 비교 통계
  getComparisonStats(
    attendances: Attendance[],
    currentStart: string,
    currentEnd: string,
    previousStart: string,
    previousEnd: string
  ): ComparisonStats {
    const current = this.filterByPeriod(attendances, {
      startDate: currentStart,
      endDate: currentEnd
    });
    const previous = this.filterByPeriod(attendances, {
      startDate: previousStart,
      endDate: previousEnd
    });

    const currentStats = calculateBasicStats(current);
    const previousStats = calculateBasicStats(previous);

    return {
      current: currentStats,
      previous: previousStats,
      change: {
        total: currentStats.total - previousStats.total,
        present: currentStats.present - previousStats.present,
        late: currentStats.late - previousStats.late,
        absent: currentStats.absent - previousStats.absent,
        attendanceRate: Math.round((currentStats.attendanceRate - previousStats.attendanceRate) * 10) / 10
      }
    };
  },

  // 출석 패턴 분석
  getAttendancePattern(attendances: Attendance[]): AttendancePattern | null {
    // 출석 데이터가 없으면 null 반환
    if (!attendances || attendances.length === 0) {
      return null;
    }

    const dayStats = this.getDayOfWeekStats(attendances);
    const hourStats = this.getHourlyStats(attendances);

    // 데이터가 없는 경우 대비
    if (!dayStats || dayStats.length === 0 || !hourStats || hourStats.length === 0) {
      return null;
    }

    // 최고/최저 요일
    const sortedDays = [...dayStats].sort(
      (a, b) => b.stats.attendanceRate - a.stats.attendanceRate
    );
    const bestDay = sortedDays[0];
    const worstDay = sortedDays[sortedDays.length - 1];

    // 데이터가 없는 경우 대비
    if (!bestDay || !worstDay) {
      return null;
    }

    // 피크 시간
    const peakHour = hourStats.reduce(
      (max, h) => (h.count > max.count ? h : max),
      hourStats[0]
    );

    // 평균 체크인 시간 계산
    const checkInTimes = attendances
      .filter(a => a.checkInTime)
      .map(a => {
        const [h, m] = a.checkInTime!.split(':').map(Number);
        return h * 60 + m;
      });

    const avgMinutes = checkInTimes.length > 0
      ? Math.round(checkInTimes.reduce((a, b) => a + b, 0) / checkInTimes.length)
      : 0;
    const avgHour = Math.floor(avgMinutes / 60);
    const avgMin = avgMinutes % 60;

    // 지각 시 평균 시간
    const lateTimes = attendances
      .filter(a => a.status === 'late' && a.checkInTime)
      .map(a => a.checkInTime!);

    return {
      bestDay: {
        dayOfWeek: bestDay.dayOfWeek,
        dayName: bestDay.dayName,
        rate: bestDay.stats.attendanceRate
      },
      worstDay: {
        dayOfWeek: worstDay.dayOfWeek,
        dayName: worstDay.dayName,
        rate: worstDay.stats.attendanceRate
      },
      peakHour: {
        hour: peakHour?.hour ?? 0,
        count: peakHour?.count ?? 0
      },
      averageCheckInTime: `${String(avgHour).padStart(2, '0')}:${String(avgMin).padStart(2, '0')}`,
      mostCommonLateTime: lateTimes.length > 0 ? lateTimes[0] : 'N/A'
    };
  },

  // 경고 학생 목록
  getAlertStudents(
    students: Student[],
    attendances: Attendance[],
    classes: Class[]
  ): AlertStudent[] {
    const alerts: AlertStudent[] = [];
    const activeStudents = students.filter(s => s.status === 'active');

    activeStudents.forEach(student => {
      const stats = this.getStudentStats(student, attendances, classes);
      const studentClass = classes.find(c => c.studentIds.includes(student.id));

      // 연속 결석 2일 이상
      if (stats.consecutiveAbsent >= 2) {
        alerts.push({
          studentId: student.id,
          studentName: student.name,
          className: studentClass?.name || '미배정',
          alertType: 'consecutive_absent',
          alertMessage: `${stats.consecutiveAbsent}일 연속 결석`,
          value: stats.consecutiveAbsent,
          threshold: 2
        });
      }

      // 출석률 70% 미만
      if (stats.total >= 5 && stats.attendanceRate < 70) {
        alerts.push({
          studentId: student.id,
          studentName: student.name,
          className: studentClass?.name || '미배정',
          alertType: 'low_attendance',
          alertMessage: `출석률 ${stats.attendanceRate}%`,
          value: stats.attendanceRate,
          threshold: 70
        });
      }

      // 잦은 지각 (지각률 30% 이상)
      if (stats.total >= 5) {
        const lateRate = (stats.late / stats.total) * 100;
        if (lateRate >= 30) {
          alerts.push({
            studentId: student.id,
            studentName: student.name,
            className: studentClass?.name || '미배정',
            alertType: 'frequent_late',
            alertMessage: `지각률 ${Math.round(lateRate)}%`,
            value: lateRate,
            threshold: 30
          });
        }
      }

      // 급격한 출석률 하락
      if (stats.trend === 'declining' && stats.trendPercentage < -20) {
        alerts.push({
          studentId: student.id,
          studentName: student.name,
          className: studentClass?.name || '미배정',
          alertType: 'pattern_change',
          alertMessage: `출석률 ${Math.abs(stats.trendPercentage).toFixed(1)}% 하락`,
          value: stats.trendPercentage,
          threshold: -20
        });
      }
    });

    return alerts.sort((a, b) => {
      // 심각도 순 정렬
      const severityOrder = {
        consecutive_absent: 1,
        low_attendance: 2,
        pattern_change: 3,
        frequent_late: 4
      };
      return severityOrder[a.alertType] - severityOrder[b.alertType];
    });
  },

  // 대시보드 요약
  getDashboardSummary(
    students: Student[],
    classes: Class[],
    attendances: Attendance[]
  ): DashboardSummary {
    const today = getDateString(new Date());
    const todayAttendances = attendances.filter(a => a.date === today);
    const activeStudents = students.filter(s => s.status === 'active');

    // 오늘 예상 출석 수 (활성 학생 수)
    const expectedToday = activeStudents.length;
    const checkedToday = todayAttendances.length;

    // 이번 주 vs 지난 주 비교
    const now = new Date();
    const { start: weekStart, end: weekEnd } = getWeekRange(now);
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(weekEnd);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

    const weeklyComparison = this.getComparisonStats(
      attendances,
      getDateString(weekStart),
      getDateString(weekEnd),
      getDateString(lastWeekStart),
      getDateString(lastWeekEnd)
    );

    // 이번 달 vs 지난 달 비교
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const monthlyComparison = this.getComparisonStats(
      attendances,
      getDateString(monthStart),
      getDateString(monthEnd),
      getDateString(lastMonthStart),
      getDateString(lastMonthEnd)
    );

    // 경고 학생
    const alerts = this.getAlertStudents(students, attendances, classes);

    // 최근 활동 (오늘 출석 기록)
    const recentActivity = todayAttendances
      .sort((a, b) => {
        const timeA = a.checkInTime || '00:00';
        const timeB = b.checkInTime || '00:00';
        return timeB.localeCompare(timeA);
      })
      .slice(0, 10)
      .map(a => {
        const student = students.find(s => s.id === a.studentId);
        const cls = classes.find(c => c.id === a.classId);
        return {
          time: a.checkInTime || 'N/A',
          studentName: student?.name || 'Unknown',
          className: cls?.name || 'Unknown',
          status: a.status as AttendanceStatus
        };
      });

    return {
      todayAttendance: {
        checked: checkedToday,
        expected: expectedToday,
        rate: expectedToday > 0 ? Math.round((checkedToday / expectedToday) * 100) : 0
      },
      weeklyComparison,
      monthlyComparison,
      alerts,
      recentActivity
    };
  }
};
