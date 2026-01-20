import { useMemo } from 'react';
import type { StudentAttendanceStats } from '../../types/statistics';
import type { Attendance } from '../../types';
import AttendanceGauge from './AttendanceGauge';
import RiskIndicator from './RiskIndicator';
import CalendarHeatmap from './CalendarHeatmap';

interface StudentReportCardProps {
  student: StudentAttendanceStats;
  attendances: Attendance[];
  onClose?: () => void;
}

export default function StudentReportCard({
  student,
  attendances,
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

  // 위험도 계산
  const riskScore = useMemo(() => {
    let score = 0;

    // 출석률 기반 (40점)
    if (student.attendanceRate < 70) score += 40;
    else if (student.attendanceRate < 80) score += 25;
    else if (student.attendanceRate < 90) score += 10;

    // 연속 결석 기반 (30점)
    if (student.consecutiveAbsent >= 5) score += 30;
    else if (student.consecutiveAbsent >= 3) score += 20;
    else if (student.consecutiveAbsent >= 2) score += 10;

    // 추세 기반 (20점)
    if (student.trend === 'declining') {
      if (student.trendPercentage < -20) score += 20;
      else if (student.trendPercentage < -10) score += 10;
    }

    // 지각률 기반 (10점)
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
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
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
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
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
              <div className="text-xs text-gray-500 mb-1">연속 출석</div>
              <div className="text-lg font-semibold text-gray-800">{student.consecutivePresent}일</div>
            </div>
            <div className="border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">연속 결석</div>
              <div className={`text-lg font-semibold ${student.consecutiveAbsent > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                {student.consecutiveAbsent}일
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">출석 추세</div>
              <div className={`text-lg font-semibold flex items-center gap-1 ${
                student.trend === 'improving' ? 'text-green-600' :
                student.trend === 'declining' ? 'text-red-600' : 'text-gray-600'
              }`}>
                {student.trend === 'improving' ? '📈' : student.trend === 'declining' ? '📉' : '➡️'}
                {student.trend === 'improving' ? '상승' : student.trend === 'declining' ? '하락' : '유지'}
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">순위</div>
              <div className="text-lg font-semibold text-gray-800">
                {student.rank ? `${student.rank}위` : '-'}
              </div>
            </div>
          </div>

          {/* 캘린더 히트맵 */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">📅 출석 현황 캘린더</h3>
            <CalendarHeatmap data={calendarData} />
          </div>

          {/* 최근 출석 기록 */}
          {student.recentAttendances && student.recentAttendances.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">📋 최근 출석 기록</h3>
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
