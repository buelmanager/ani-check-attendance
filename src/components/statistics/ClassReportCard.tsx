import { useMemo } from 'react';
import type { ClassAttendanceStats, StudentAttendanceStats } from '../../types/statistics';
import type { Attendance } from '../../types';
import AttendanceGauge from './AttendanceGauge';
import TrendChart from './TrendChart';
import { statisticsService } from '../../services/statisticsService';

interface ClassReportCardProps {
  classStats: ClassAttendanceStats;
  attendances: Attendance[];
  onStudentClick?: (studentId: string) => void;
  onClose?: () => void;
}

export default function ClassReportCard({
  classStats,
  attendances,
  onStudentClick,
  onClose
}: ClassReportCardProps) {
  // 반별 주간 추세 데이터
  const weeklyTrendData = useMemo(() => {
    if (!classStats.weeklyBreakdown) return [];

    return classStats.weeklyBreakdown.slice(-8).map((week, i, arr) => ({
      label: `${week.weekNumber}주`,
      value: week.attendanceRate,
      previousValue: i > 0 ? arr[i - 1].attendanceRate : undefined
    }));
  }, [classStats.weeklyBreakdown]);

  // 시간대별 분포
  const hourlyStats = useMemo(() => {
    const classAttendances = attendances.filter(a => a.classId === classStats.classId);
    return statisticsService.getHourlyStats(classAttendances);
  }, [attendances, classStats.classId]);

  // 피크 시간 계산
  const peakHour = useMemo(() => {
    const peak = hourlyStats.reduce((max, h) => h.count > max.count ? h : max, hourlyStats[0] || { hour: 0, count: 0 });
    return peak;
  }, [hourlyStats]);

  // 스케줄 문자열 생성
  const scheduleStr = useMemo(() => {
    if (!classStats.schedule || !Array.isArray(classStats.schedule)) return '';
    return classStats.schedule.map((s: { day: string }) => s.day).join(', ');
  }, [classStats.schedule]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{classStats.className}</h2>
            <p className="text-sm text-gray-500">
              {classStats.studentCount}명 · {scheduleStr}
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
          {/* 상단: 게이지와 요약 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 flex flex-col items-center">
              <AttendanceGauge
                value={classStats.attendanceRate}
                target={85}
                size={200}
                label="반 평균 출석률"
              />
            </div>

            <div className="space-y-4">
              {/* 출석 분포 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">출석 현황 분포</h4>
                <div className="h-6 bg-gray-200 rounded-full overflow-hidden flex">
                  {classStats.total > 0 && (
                    <>
                      <div
                        className="bg-green-500 transition-all"
                        style={{ width: `${(classStats.present / classStats.total) * 100}%` }}
                        title={`출석 ${classStats.present}`}
                      />
                      <div
                        className="bg-yellow-500 transition-all"
                        style={{ width: `${(classStats.late / classStats.total) * 100}%` }}
                        title={`지각 ${classStats.late}`}
                      />
                      <div
                        className="bg-red-500 transition-all"
                        style={{ width: `${(classStats.absent / classStats.total) * 100}%` }}
                        title={`결석 ${classStats.absent}`}
                      />
                      <div
                        className="bg-blue-500 transition-all"
                        style={{ width: `${(classStats.excused / classStats.total) * 100}%` }}
                        title={`사유결석 ${classStats.excused}`}
                      />
                    </>
                  )}
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded" /> 출석</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-500 rounded" /> 지각</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded" /> 결석</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded" /> 사유</span>
                </div>
              </div>

              {/* 핵심 지표 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">정시 출석률</div>
                  <div className="text-xl font-bold text-gray-800">
                    {classStats.punctualityRate?.toFixed(1) || 0}%
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">피크 시간</div>
                  <div className="text-xl font-bold text-gray-800">
                    {peakHour?.hour || 0}시
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 통계 카드들 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-600">{classStats.present}</div>
              <div className="text-sm text-green-700">출석</div>
              <div className="text-xs text-green-600 mt-1">
                {classStats.total > 0 ? ((classStats.present / classStats.total) * 100).toFixed(1) : 0}%
              </div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-yellow-600">{classStats.late}</div>
              <div className="text-sm text-yellow-700">지각</div>
              <div className="text-xs text-yellow-600 mt-1">
                {classStats.total > 0 ? ((classStats.late / classStats.total) * 100).toFixed(1) : 0}%
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-red-600">{classStats.absent}</div>
              <div className="text-sm text-red-700">결석</div>
              <div className="text-xs text-red-600 mt-1">
                {classStats.total > 0 ? ((classStats.absent / classStats.total) * 100).toFixed(1) : 0}%
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{classStats.excused}</div>
              <div className="text-sm text-blue-700">사유결석</div>
              <div className="text-xs text-blue-600 mt-1">
                {classStats.total > 0 ? ((classStats.excused / classStats.total) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>

          {/* 주간 추세 차트 */}
          {weeklyTrendData.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <TrendChart
                data={weeklyTrendData}
                title="주간 출석률 추세"
                height={180}
                showComparison={false}
              />
            </div>
          )}

          {/* 학생 목록 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 우수 학생 */}
            {classStats.topStudents && classStats.topStudents.length > 0 && (
              <div className="bg-green-50 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                  🏆 출석 우수 학생
                </h4>
                <div className="space-y-2">
                  {classStats.topStudents.slice(0, 5).map((student: StudentAttendanceStats, i: number) => (
                    <div
                      key={student.studentId}
                      className="flex items-center justify-between py-2 px-3 bg-white rounded-lg cursor-pointer hover:bg-green-100 transition-colors"
                      onClick={() => onStudentClick?.(student.studentId)}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          i === 0 ? 'bg-yellow-400 text-yellow-900' :
                          i === 1 ? 'bg-gray-300 text-gray-700' :
                          i === 2 ? 'bg-amber-600 text-amber-100' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-800">{student.studentName}</span>
                      </div>
                      <span className="text-sm font-semibold text-green-600">
                        {student.attendanceRate.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 관리 필요 학생 */}
            {classStats.bottomStudents && classStats.bottomStudents.length > 0 && (
              <div className="bg-red-50 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">
                  ⚠️ 관리 필요 학생
                </h4>
                <div className="space-y-2">
                  {classStats.bottomStudents.slice(0, 5).map((student: StudentAttendanceStats) => (
                    <div
                      key={student.studentId}
                      className="flex items-center justify-between py-2 px-3 bg-white rounded-lg cursor-pointer hover:bg-red-100 transition-colors"
                      onClick={() => onStudentClick?.(student.studentId)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">{student.studentName}</span>
                        {student.consecutiveAbsent > 0 && (
                          <span className="text-xs bg-red-200 text-red-700 px-1.5 py-0.5 rounded">
                            {student.consecutiveAbsent}일 연속 결석
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-red-600">
                        {student.attendanceRate.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
