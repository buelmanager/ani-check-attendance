import { useMemo } from 'react';
import type { StudentAttendanceStats } from '../../types/statistics';
import type { Attendance } from '../../types';
import AttendanceGauge from './AttendanceGauge';
import RiskIndicator from './RiskIndicator';
import CalendarHeatmap from './CalendarHeatmap';
import MonthlyTrendChart from './MonthlyTrendChart';
import DayPatternChart from './DayPatternChart';
import TimeDistributionChart from './TimeDistributionChart';
import AttendanceStreakChart from './AttendanceStreakChart';
import PersonalComparisonChart from './PersonalComparisonChart';
import {
  XIcon,
  CalendarDaysIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ArrowRightIcon,
  TrophyIcon,
  AlertTriangleIcon,
  ClockIcon,
  ActivityIcon,
  TargetIcon,
  ListIcon
} from './Icons';

interface StudentReportCardProps {
  student: StudentAttendanceStats;
  attendances: Attendance[];
  classAvgRate?: number;
  overallAvgRate?: number;
  onClose?: () => void;
}

export default function StudentReportCard({
  student,
  attendances,
  classAvgRate = 85,
  overallAvgRate = 82,
  onClose
}: StudentReportCardProps) {
  // 학생의 출석 기록으로 캘린더 데이터 생성
  const calendarData = useMemo(() => {
    const studentAttendances = attendances.filter(a => a.studentId === student.studentId);

    // 날짜별로 그룹화
    const dateMap = new Map<string, Attendance[]>();
    studentAttendances.forEach(a => {
      if (!dateMap.has(a.date)) {
        dateMap.set(a.date, []);
      }
      dateMap.get(a.date)!.push(a);
    });

    return Array.from(dateMap.entries()).map(([date, records]) => {
      const present = records.filter(r => r.status === 'present' || r.status === 'late').length;
      const total = records.length;
      return {
        date,
        value: total > 0 ? Math.round((present / total) * 100) : -1,
        status: records[0]?.status
      };
    });
  }, [attendances, student.studentId]);

  // 월별 데이터
  const monthlyData = useMemo(() => {
    const studentAttendances = attendances.filter(a => a.studentId === student.studentId);
    const monthMap = new Map<string, { present: number; late: number; absent: number; total: number }>();

    studentAttendances.forEach(a => {
      const month = a.date.substring(0, 7); // YYYY-MM
      if (!monthMap.has(month)) {
        monthMap.set(month, { present: 0, late: 0, absent: 0, total: 0 });
      }
      const data = monthMap.get(month)!;
      data.total++;
      if (a.status === 'present') data.present++;
      else if (a.status === 'late') data.late++;
      else if (a.status === 'absent') data.absent++;
    });

    return Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, data]) => ({
        month: month.replace('-', '.').substring(2), // '24.01'
        ...data,
        attendanceRate: data.total > 0 ? ((data.present + data.late) / data.total) * 100 : 0
      }));
  }, [attendances, student.studentId]);

  // 요일별 데이터
  const dayPatternData = useMemo(() => {
    const studentAttendances = attendances.filter(a => a.studentId === student.studentId);
    const dayMap = new Map<number, { present: number; late: number; absent: number; total: number }>();

    studentAttendances.forEach(a => {
      const day = new Date(a.date).getDay();
      if (!dayMap.has(day)) {
        dayMap.set(day, { present: 0, late: 0, absent: 0, total: 0 });
      }
      const data = dayMap.get(day)!;
      data.total++;
      if (a.status === 'present') data.present++;
      else if (a.status === 'late') data.late++;
      else if (a.status === 'absent') data.absent++;
    });

    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    return Array.from(dayMap.entries()).map(([day, data]) => ({
      day,
      dayName: dayNames[day],
      ...data,
      attendanceRate: data.total > 0 ? ((data.present + data.late) / data.total) * 100 : 0
    }));
  }, [attendances, student.studentId]);

  // 시간대별 데이터
  const timeDistributionData = useMemo(() => {
    const studentAttendances = attendances.filter(a => a.studentId === student.studentId);
    const hourMap = new Map<number, { count: number; presentCount: number; lateCount: number }>();

    studentAttendances.forEach(a => {
      if (a.checkInTime) {
        const hour = parseInt(a.checkInTime.split(':')[0], 10);
        if (!hourMap.has(hour)) {
          hourMap.set(hour, { count: 0, presentCount: 0, lateCount: 0 });
        }
        const data = hourMap.get(hour)!;
        data.count++;
        if (a.status === 'present') data.presentCount++;
        else if (a.status === 'late') data.lateCount++;
      }
    });

    return Array.from(hourMap.entries()).map(([hour, data]) => ({
      hour,
      ...data
    }));
  }, [attendances, student.studentId]);

  // 연속 출석 데이터
  const streakData = useMemo(() => {
    const studentAttendances = attendances
      .filter(a => a.studentId === student.studentId)
      .sort((a, b) => a.date.localeCompare(b.date));

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    const streakHistory: Array<{ startDate: string; endDate: string; length: number }> = [];
    let streakStart = '';

    studentAttendances.forEach((a, i) => {
      const isPresent = a.status === 'present' || a.status === 'late';

      if (isPresent) {
        if (tempStreak === 0) {
          streakStart = a.date;
        }
        tempStreak++;
      } else {
        if (tempStreak > 0) {
          streakHistory.push({
            startDate: streakStart,
            endDate: studentAttendances[i - 1]?.date || streakStart,
            length: tempStreak
          });
          if (tempStreak > longestStreak) longestStreak = tempStreak;
        }
        tempStreak = 0;
      }

      if (i === studentAttendances.length - 1 && tempStreak > 0) {
        currentStreak = tempStreak;
        streakHistory.push({
          startDate: streakStart,
          endDate: a.date,
          length: tempStreak
        });
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      }
    });

    const totalDays = studentAttendances.filter(a =>
      a.status === 'present' || a.status === 'late'
    ).length;

    return {
      currentStreak,
      longestStreak,
      totalDays,
      streakHistory: streakHistory.sort((a, b) => b.length - a.length).slice(0, 5)
    };
  }, [attendances, student.studentId]);

  // 비교 데이터
  const comparisonData = useMemo(() => {
    return [
      {
        label: '출석률',
        studentValue: student.attendanceRate,
        classAvg: classAvgRate,
        overallAvg: overallAvgRate
      },
      {
        label: '정시 출석률',
        studentValue: student.total > 0 ? (student.present / student.total) * 100 : 0,
        classAvg: classAvgRate * 0.9,
        overallAvg: overallAvgRate * 0.88
      }
    ];
  }, [student, classAvgRate, overallAvgRate]);

  // 위험도 계산
  const riskScore = useMemo(() => {
    let score = 0;

    if (student.attendanceRate < 70) score += 40;
    else if (student.attendanceRate < 80) score += 25;
    else if (student.attendanceRate < 90) score += 10;

    if (student.consecutiveAbsent >= 5) score += 30;
    else if (student.consecutiveAbsent >= 3) score += 20;
    else if (student.consecutiveAbsent >= 2) score += 10;

    if (student.trend === 'declining') {
      if (student.trendPercentage < -20) score += 20;
      else if (student.trendPercentage < -10) score += 10;
    }

    const lateRate = student.total > 0 ? (student.late / student.total) * 100 : 0;
    if (lateRate > 30) score += 10;
    else if (lateRate > 20) score += 5;

    return Math.min(score, 100);
  }, [student]);

  const riskFactors = useMemo(() => {
    const factors = [];

    if (student.attendanceRate < 85) {
      factors.push({
        name: '낮은 출석률',
        impact: Math.min(100, (85 - student.attendanceRate) * 3)
      });
    }

    if (student.consecutiveAbsent > 0) {
      factors.push({
        name: '연속 결석',
        impact: Math.min(100, student.consecutiveAbsent * 20)
      });
    }

    if (student.trend === 'declining') {
      factors.push({
        name: '출석률 하락 추세',
        impact: Math.min(100, Math.abs(student.trendPercentage) * 2)
      });
    }

    const lateRate = student.total > 0 ? (student.late / student.total) * 100 : 0;
    if (lateRate > 10) {
      factors.push({
        name: '잦은 지각',
        impact: Math.min(100, lateRate * 2)
      });
    }

    return factors.sort((a, b) => b.impact - a.impact);
  }, [student]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{student.studentName}</h2>
            <p className="text-sm text-gray-500">
              {student.className || '미배정'} · {student.grade}학년
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          {/* 상단: 게이지와 위험도 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-50 rounded-xl p-4 flex flex-col items-center">
              <AttendanceGauge
                value={student.attendanceRate}
                target={85}
                size={180}
                label="전체 출석률"
              />
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <RiskIndicator
                score={riskScore}
                label="이탈 위험도"
                size="lg"
                showDetails
                factors={riskFactors}
              />
            </div>
          </div>

          {/* 통계 카드들 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{student.present}</div>
              <div className="text-xs text-green-700">출석</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-600">{student.late}</div>
              <div className="text-xs text-yellow-700">지각</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-600">{student.absent}</div>
              <div className="text-xs text-red-700">결석</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{student.excused}</div>
              <div className="text-xs text-blue-700">사유결석</div>
            </div>
          </div>

          {/* 추가 정보 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <TrophyIcon size={12} className="text-green-500" />
                연속 출석
              </div>
              <div className="text-lg font-semibold text-gray-800">{student.consecutivePresent}일</div>
            </div>
            <div className="border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <AlertTriangleIcon size={12} className="text-red-500" />
                연속 결석
              </div>
              <div className={`text-lg font-semibold ${student.consecutiveAbsent > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                {student.consecutiveAbsent}일
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <ActivityIcon size={12} className="text-indigo-500" />
                출석 추세
              </div>
              <div className={`text-lg font-semibold flex items-center gap-1 ${
                student.trend === 'improving' ? 'text-green-600' :
                student.trend === 'declining' ? 'text-red-600' : 'text-gray-600'
              }`}>
                {student.trend === 'improving' ? <TrendingUpIcon size={16} /> :
                 student.trend === 'declining' ? <TrendingDownIcon size={16} /> :
                 <ArrowRightIcon size={16} />}
                {student.trend === 'improving' ? '상승' : student.trend === 'declining' ? '하락' : '유지'}
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <TargetIcon size={12} className="text-indigo-500" />
                순위
              </div>
              <div className="text-lg font-semibold text-gray-800">
                {student.rank ? `${student.rank}위` : '-'}
              </div>
            </div>
          </div>

          {/* 캘린더 히트맵 */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <CalendarDaysIcon size={16} className="text-indigo-500" />
              출석 현황 캘린더
            </h3>
            <CalendarHeatmap data={calendarData} />
          </div>

          {/* 개인화 통계 차트들 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* 월별 추세 */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <ActivityIcon size={16} className="text-indigo-500" />
                <span className="text-sm font-semibold text-gray-700">월별 출석 추세</span>
              </div>
              <MonthlyTrendChart data={monthlyData} title="" height={180} />
            </div>

            {/* 요일별 패턴 */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDaysIcon size={16} className="text-indigo-500" />
                <span className="text-sm font-semibold text-gray-700">요일별 출석 패턴</span>
              </div>
              <DayPatternChart data={dayPatternData} title="" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* 시간대별 분포 */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <ClockIcon size={16} className="text-indigo-500" />
                <span className="text-sm font-semibold text-gray-700">시간대별 출석 분포</span>
              </div>
              <TimeDistributionChart data={timeDistributionData} title="" />
            </div>

            {/* 연속 출석 기록 */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrophyIcon size={16} className="text-yellow-500" />
                <span className="text-sm font-semibold text-gray-700">연속 출석 기록</span>
              </div>
              <AttendanceStreakChart data={streakData} title="" />
            </div>
          </div>

          {/* 비교 분석 */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <TargetIcon size={16} className="text-indigo-500" />
              <span className="text-sm font-semibold text-gray-700">비교 분석</span>
            </div>
            <PersonalComparisonChart
              data={comparisonData}
              studentName={student.studentName}
              title=""
            />
          </div>

          {/* 최근 출석 기록 */}
          {student.recentAttendances && student.recentAttendances.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <ListIcon size={16} className="text-indigo-500" />
                최근 출석 기록
              </h3>
              <div className="space-y-2">
                {student.recentAttendances.slice(0, 10).map((a, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-700">{a.date}</div>
                    <div className={`text-xs font-medium px-2 py-1 rounded ${
                      a.status === 'present' ? 'bg-green-100 text-green-700' :
                      a.status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                      a.status === 'absent' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {a.status === 'present' ? '출석' :
                       a.status === 'late' ? '지각' :
                       a.status === 'absent' ? '결석' : '사유결석'}
                    </div>
                    {a.checkInTime && (
                      <div className="text-xs text-gray-500">{a.checkInTime}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
