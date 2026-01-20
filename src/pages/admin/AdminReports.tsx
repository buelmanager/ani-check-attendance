import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { useStore } from '../../store/useStore';
import { statisticsService } from '../../services/statisticsService';
import {
  StatCard,
  BarChart,
  DonutChart,
  DonutChartLegend,
  LineChart,
  AlertStudentCard,
  RankingTable
} from '../../components/statistics';
import type {
  PeriodType,
  DailyStats,
  StudentAttendanceStats,
  ClassAttendanceStats,
  AlertStudent,
  ComparisonStats,
  AttendancePattern,
  DayOfWeekStats,
  HourlyStats,
  CheckInMethodStats
} from '../../types/statistics';
import { DAY_LABELS } from '../../types/statistics';

type TabType = 'overview' | 'students' | 'classes' | 'patterns';

export default function AdminReports() {
  const navigate = useNavigate();
  const { classes, students, attendances } = useStore();

  // 필터 상태
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [periodType, setPeriodType] = useState<PeriodType>('monthly');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  });

  // 기간 선택 시 날짜 범위 자동 설정
  useEffect(() => {
    const end = new Date();
    const start = new Date();

    switch (periodType) {
      case 'daily':
        start.setDate(start.getDate() - 1);
        break;
      case 'weekly':
        start.setDate(start.getDate() - 7);
        break;
      case 'monthly':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'quarterly':
        start.setMonth(start.getMonth() - 3);
        break;
      case 'yearly':
        start.setFullYear(start.getFullYear() - 1);
        break;
    }

    if (periodType !== 'custom') {
      setDateRange({
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      });
    }
  }, [periodType]);

  // 필터 적용
  const filter = useMemo(() => ({
    startDate: dateRange.start,
    endDate: dateRange.end,
    classIds: selectedClassId ? [selectedClassId] : undefined
  }), [dateRange, selectedClassId]);

  // 필터링된 출석 데이터
  const filteredAttendances = useMemo(() =>
    statisticsService.filterByPeriod(attendances, filter),
    [attendances, filter]
  );

  // 기본 통계
  const basicStats = useMemo(() => {
    const total = filteredAttendances.length;
    const present = filteredAttendances.filter(a => a.status === 'present').length;
    const late = filteredAttendances.filter(a => a.status === 'late').length;
    const absent = filteredAttendances.filter(a => a.status === 'absent').length;
    const excused = filteredAttendances.filter(a => a.status === 'excused').length;

    return {
      total,
      present,
      late,
      absent,
      excused,
      attendanceRate: total > 0 ? Math.round(((present + late) / total) * 100) : 0,
      punctualityRate: total > 0 ? Math.round((present / total) * 100) : 0
    };
  }, [filteredAttendances]);

  // 비교 통계
  const comparisonStats = useMemo((): ComparisonStats => {
    // 이전 기간 계산
    const currentStart = dateRange.start;
    const currentEnd = dateRange.end;
    const startDate = new Date(currentStart);
    const endDate = new Date(currentEnd);
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const prevEnd = new Date(startDate);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - daysDiff);

    return statisticsService.getComparisonStats(
      attendances,
      currentStart,
      currentEnd,
      prevStart.toISOString().split('T')[0],
      prevEnd.toISOString().split('T')[0]
    );
  }, [attendances, dateRange]);

  // 일별 통계 (주간 차트용)
  const dailyStats = useMemo((): DailyStats[] => {
    return statisticsService.getDailyStatsRange(filteredAttendances, dateRange.start, dateRange.end);
  }, [filteredAttendances, dateRange]);

  // 주간 차트 데이터 (최근 7일)
  const weeklyChartData = useMemo(() => {
    const last7Days = dailyStats.slice(-7);
    return last7Days.map(day => ({
      label: DAY_LABELS[day.dayOfWeek],
      value: day.attendanceRate,
      subLabel: day.date.slice(5).replace('-', '/')
    }));
  }, [dailyStats]);

  // 월별 차트 데이터
  const monthlyChartData = useMemo(() => {
    const trends = statisticsService.getAttendanceTrends(attendances, 6);
    return trends.map(t => ({
      label: t.period,
      value: t.rate
    }));
  }, [attendances]);

  // 출석 상태별 도넛 차트 데이터
  const statusDonutData = useMemo(() => [
    { label: '출석', value: basicStats.present, color: '#22c55e' },
    { label: '지각', value: basicStats.late, color: '#eab308' },
    { label: '결석', value: basicStats.absent, color: '#ef4444' },
    { label: '사유결석', value: basicStats.excused, color: '#3b82f6' }
  ], [basicStats]);

  // 요일별 통계
  const dayOfWeekStats = useMemo((): DayOfWeekStats[] => {
    return statisticsService.getDayOfWeekStats(filteredAttendances);
  }, [filteredAttendances]);

  // 시간대별 통계
  const hourlyStats = useMemo((): HourlyStats[] => {
    return statisticsService.getHourlyStats(filteredAttendances);
  }, [filteredAttendances]);

  // 출석 방법별 통계
  const checkInMethodStats = useMemo((): CheckInMethodStats => {
    return statisticsService.getCheckInMethodStats(filteredAttendances);
  }, [filteredAttendances]);

  // 출석 패턴 분석
  const patterns = useMemo((): AttendancePattern | null => {
    return statisticsService.getAttendancePattern(filteredAttendances);
  }, [filteredAttendances]);

  // 학생별 통계
  const studentStats = useMemo((): StudentAttendanceStats[] => {
    return statisticsService.getAllStudentStats(students, filteredAttendances, classes, filter);
  }, [filteredAttendances, students, classes, filter]);

  // 반별 통계
  const classStats = useMemo((): ClassAttendanceStats[] => {
    return statisticsService.getAllClassStats(classes, students, filteredAttendances, filter);
  }, [filteredAttendances, classes, students, filter]);

  // 주의 필요 학생
  const alertStudents = useMemo((): AlertStudent[] => {
    return statisticsService.getAlertStudents(students, attendances, classes);
  }, [attendances, students, classes]);

  // 탭 목록
  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: '전체 현황' },
    { id: 'students', label: '원생별 통계' },
    { id: 'classes', label: '반별 통계' },
    { id: 'patterns', label: '출석 패턴' }
  ];

  // 기간 옵션
  const periodOptions: { value: PeriodType; label: string }[] = [
    { value: 'daily', label: '어제' },
    { value: 'weekly', label: '최근 7일' },
    { value: 'monthly', label: '최근 30일' },
    { value: 'quarterly', label: '최근 3개월' },
    { value: 'yearly', label: '최근 1년' },
    { value: 'custom', label: '직접 선택' }
  ];

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">출석 통계</h1>
        <p className="text-gray-500">상세한 출석 데이터를 분석합니다</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-accent text-primary'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Period Filter */}
          <div>
            <label className="text-sm text-gray-500 mb-2 block">기간</label>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as PeriodType)}
              className="input-field"
            >
              {periodOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Custom Date Range */}
          {periodType === 'custom' && (
            <>
              <div>
                <label className="text-sm text-gray-500 mb-2 block">시작일</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-2 block">종료일</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="input-field"
                />
              </div>
            </>
          )}

          {/* Class Filter */}
          <div>
            <label className="text-sm text-gray-500 mb-2 block">반 선택</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="input-field"
            >
              <option value="">전체 반</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Main Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="출석률"
              value={`${basicStats.attendanceRate}%`}
              subtitle={`전체 ${basicStats.total}건`}
              color="accent"
              trend={comparisonStats.change.attendanceRate !== 0 ? {
                value: comparisonStats.change.attendanceRate,
                isPositive: comparisonStats.change.attendanceRate > 0
              } : undefined}
            />
            <StatCard
              title="출석"
              value={basicStats.present}
              subtitle={`${basicStats.punctualityRate}% 정시 출석`}
              color="green"
            />
            <StatCard
              title="지각"
              value={basicStats.late}
              subtitle={`${basicStats.total > 0 ? Math.round((basicStats.late / basicStats.total) * 100) : 0}%`}
              color="yellow"
            />
            <StatCard
              title="결석"
              value={basicStats.absent + basicStats.excused}
              subtitle={`결석 ${basicStats.absent} / 사유 ${basicStats.excused}`}
              color="red"
            />
          </div>

          {/* Charts Row */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Weekly Chart */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">주간 출석률</h3>
              <BarChart
                data={weeklyChartData}
                maxValue={100}
                height={180}
              />
            </div>

            {/* Status Distribution */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">출석 현황 분포</h3>
              <div className="flex items-center justify-center gap-8">
                <DonutChart
                  data={statusDonutData}
                  size={150}
                  centerValue={`${basicStats.attendanceRate}%`}
                  centerLabel="출석률"
                />
                <DonutChartLegend data={statusDonutData} />
              </div>
            </div>
          </div>

          {/* Monthly Trend */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">월별 출석률 추이</h3>
            <LineChart
              data={monthlyChartData}
              height={200}
              showDots={true}
              showValues={true}
              showGrid={true}
            />
          </div>

          {/* Alert Students */}
          {alertStudents.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">주의 필요 학생</h3>
                <span className="text-sm text-red-500 font-medium">{alertStudents.length}명</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {alertStudents.slice(0, 6).map(student => (
                  <AlertStudentCard
                    key={`${student.studentId}-${student.alertType}`}
                    student={student}
                    onClick={() => navigate(`/admin/students/${student.studentId}`)}
                  />
                ))}
              </div>
              {alertStudents.length > 6 && (
                <button className="w-full mt-4 py-2 text-sm text-accent hover:text-primary font-medium">
                  +{alertStudents.length - 6}명 더 보기
                </button>
              )}
            </div>
          )}

          {/* Rankings */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Class Rankings */}
            <div className="card">
              <RankingTable
                title="반별 출석률 순위"
                items={classStats.slice(0, 5).map((cls, i) => ({
                  id: cls.classId,
                  rank: i + 1,
                  name: cls.className,
                  subtitle: `${cls.studentCount}명`,
                  value: cls.attendanceRate,
                  subValues: [
                    { label: '출석', value: cls.present, color: 'text-green-500' },
                    { label: '결석', value: cls.absent, color: 'text-red-500' }
                  ]
                }))}
                onItemClick={(id) => {
                  setSelectedClassId(id);
                  setActiveTab('classes');
                }}
              />
            </div>

            {/* Student Rankings */}
            <div className="card">
              <RankingTable
                title="원생 출석률 TOP 10"
                items={studentStats.slice(0, 10).map((s, i) => ({
                  id: s.studentId,
                  rank: s.rank || i + 1,
                  name: s.studentName,
                  subtitle: s.className,
                  value: s.attendanceRate,
                  subValues: [
                    { label: '출석', value: s.present, color: 'text-green-500' },
                    { label: '지각', value: s.late, color: 'text-yellow-500' },
                    { label: '결석', value: s.absent, color: 'text-red-500' }
                  ]
                }))}
                onItemClick={(id) => navigate(`/admin/students/${id}`)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Students Tab */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          {/* Student Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="전체 원생"
              value={students.length}
              subtitle="등록 인원"
              color="blue"
            />
            <StatCard
              title="평균 출석률"
              value={`${studentStats.length > 0
                ? Math.round(studentStats.reduce((sum, s) => sum + s.attendanceRate, 0) / studentStats.length)
                : 0}%`}
              color="accent"
            />
            <StatCard
              title="출석 우수"
              value={studentStats.filter(s => s.attendanceRate >= 90).length}
              subtitle="90% 이상"
              color="green"
            />
            <StatCard
              title="관리 필요"
              value={studentStats.filter(s => s.attendanceRate < 70).length}
              subtitle="70% 미만"
              color="red"
            />
          </div>

          {/* Student List */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">원생별 출석 현황</h3>
              <span className="text-sm text-gray-500">{studentStats.length}명</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                    <th className="pb-3">순위</th>
                    <th className="pb-3">이름</th>
                    <th className="pb-3">반</th>
                    <th className="pb-3 text-center">출석</th>
                    <th className="pb-3 text-center">지각</th>
                    <th className="pb-3 text-center">결석</th>
                    <th className="pb-3 text-center">출석률</th>
                    <th className="pb-3 text-center">추세</th>
                    <th className="pb-3 text-center">연속출석</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {studentStats.map((student, index) => (
                    <tr
                      key={student.studentId}
                      onClick={() => navigate(`/admin/students/${student.studentId}`)}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <td className="py-3">
                        <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-500/20 text-yellow-600' :
                          index === 1 ? 'bg-gray-400/20 text-gray-600' :
                          index === 2 ? 'bg-orange-500/20 text-orange-600' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {student.rank || index + 1}
                        </span>
                      </td>
                      <td className="py-3 font-medium text-gray-900">{student.studentName}</td>
                      <td className="py-3 text-gray-500 text-sm">{student.className || '-'}</td>
                      <td className="py-3 text-center text-green-500">{student.present}</td>
                      <td className="py-3 text-center text-yellow-500">{student.late}</td>
                      <td className="py-3 text-center text-red-500">{student.absent}</td>
                      <td className="py-3 text-center">
                        <span className={`font-bold ${
                          student.attendanceRate >= 90 ? 'text-green-500' :
                          student.attendanceRate >= 70 ? 'text-accent' :
                          'text-red-500'
                        }`}>
                          {student.attendanceRate}%
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span className={`text-sm ${
                          student.trend === 'improving' ? 'text-green-500' :
                          student.trend === 'declining' ? 'text-red-500' :
                          'text-gray-400'
                        }`}>
                          {student.trend === 'improving' ? '↑ 상승' :
                           student.trend === 'declining' ? '↓ 하락' : '- 유지'}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        {student.consecutivePresent > 0 && (
                          <span className="text-sm text-green-500">
                            {student.consecutivePresent}일
                          </span>
                        )}
                        {student.consecutiveAbsent > 0 && (
                          <span className="text-sm text-red-500">
                            결석 {student.consecutiveAbsent}일
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Classes Tab */}
      {activeTab === 'classes' && (
        <div className="space-y-6">
          {/* Class Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="전체 반"
              value={classes.length}
              subtitle="운영 중"
              color="blue"
            />
            <StatCard
              title="평균 출석률"
              value={`${classStats.length > 0
                ? Math.round(classStats.reduce((sum, c) => sum + c.attendanceRate, 0) / classStats.length)
                : 0}%`}
              color="accent"
            />
            <StatCard
              title="최고 출석률"
              value={classStats.length > 0 ? `${classStats[0]?.attendanceRate || 0}%` : '-'}
              subtitle={classStats[0]?.className || ''}
              color="green"
            />
            <StatCard
              title="관리 필요"
              value={classStats.filter(c => c.attendanceRate < 80).length}
              subtitle="80% 미만"
              color="red"
            />
          </div>

          {/* Class List */}
          <div className="grid gap-6">
            {classStats.map((cls, index) => (
              <div key={cls.classId} className="card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-yellow-500/20 text-yellow-600' :
                      index === 1 ? 'bg-gray-400/20 text-gray-600' :
                      index === 2 ? 'bg-orange-500/20 text-orange-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{cls.className}</h3>
                      <p className="text-sm text-gray-500">{cls.schedule} · {cls.studentCount}명</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${
                      cls.attendanceRate >= 90 ? 'text-green-500' :
                      cls.attendanceRate >= 80 ? 'text-accent' :
                      'text-red-500'
                    }`}>
                      {cls.attendanceRate}%
                    </p>
                    <p className="text-sm text-gray-500">출석률</p>
                  </div>
                </div>

                {/* Class Stats */}
                <div className="grid grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-xl">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-500">{cls.present}</p>
                    <p className="text-xs text-gray-500">출석</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-500">{cls.late}</p>
                    <p className="text-xs text-gray-500">지각</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-500">{cls.absent}</p>
                    <p className="text-xs text-gray-500">결석</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-500">{cls.excused}</p>
                    <p className="text-xs text-gray-500">사유결석</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                  <div
                    className="bg-green-500 transition-all"
                    style={{ width: `${cls.total > 0 ? (cls.present / cls.total) * 100 : 0}%` }}
                  />
                  <div
                    className="bg-yellow-500 transition-all"
                    style={{ width: `${cls.total > 0 ? (cls.late / cls.total) * 100 : 0}%` }}
                  />
                  <div
                    className="bg-red-500 transition-all"
                    style={{ width: `${cls.total > 0 ? (cls.absent / cls.total) * 100 : 0}%` }}
                  />
                  <div
                    className="bg-blue-500 transition-all"
                    style={{ width: `${cls.total > 0 ? (cls.excused / cls.total) * 100 : 0}%` }}
                  />
                </div>

                {/* Top/Bottom Students */}
                {(cls.topStudents.length > 0 || cls.bottomStudents.length > 0) && (
                  <div className="grid sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                    {cls.topStudents.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">출석 우수</h4>
                        <div className="space-y-1">
                          {cls.topStudents.slice(0, 3).map(s => (
                            <div
                              key={s.studentId}
                              className="flex items-center justify-between text-sm cursor-pointer hover:bg-gray-50 p-1 rounded"
                              onClick={() => navigate(`/admin/students/${s.studentId}`)}
                            >
                              <span className="text-gray-600">{s.studentName}</span>
                              <span className="text-green-500 font-medium">{s.attendanceRate}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {cls.bottomStudents.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">관리 필요</h4>
                        <div className="space-y-1">
                          {cls.bottomStudents.slice(0, 3).map(s => (
                            <div
                              key={s.studentId}
                              className="flex items-center justify-between text-sm cursor-pointer hover:bg-gray-50 p-1 rounded"
                              onClick={() => navigate(`/admin/students/${s.studentId}`)}
                            >
                              <span className="text-gray-600">{s.studentName}</span>
                              <span className="text-red-500 font-medium">{s.attendanceRate}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Patterns Tab */}
      {activeTab === 'patterns' && (
        <div className="space-y-6">
          {/* Pattern Insights */}
          {patterns && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card">
                <h4 className="text-sm text-gray-500 mb-2">출석 최고 요일</h4>
                <p className="text-2xl font-bold text-green-500">{patterns.bestDay.dayName}</p>
                <p className="text-sm text-gray-500">{patterns.bestDay.rate}% 출석률</p>
              </div>
              <div className="card">
                <h4 className="text-sm text-gray-500 mb-2">출석 저조 요일</h4>
                <p className="text-2xl font-bold text-red-500">{patterns.worstDay.dayName}</p>
                <p className="text-sm text-gray-500">{patterns.worstDay.rate}% 출석률</p>
              </div>
              <div className="card">
                <h4 className="text-sm text-gray-500 mb-2">출석 집중 시간</h4>
                <p className="text-2xl font-bold text-accent">{patterns.peakHour.hour}시</p>
                <p className="text-sm text-gray-500">{patterns.peakHour.count}건</p>
              </div>
              <div className="card">
                <h4 className="text-sm text-gray-500 mb-2">평균 출석 시간</h4>
                <p className="text-2xl font-bold text-blue-500">{patterns.averageCheckInTime}</p>
                <p className="text-sm text-gray-500">일반 지각: {patterns.mostCommonLateTime}</p>
              </div>
            </div>
          )}

          {/* Day of Week Stats */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">요일별 출석 현황</h3>
            <BarChart
              data={dayOfWeekStats.map(d => ({
                label: d.dayName,
                value: d.stats.attendanceRate,
                color: d.stats.attendanceRate >= 90 ? 'bg-green-500' :
                       d.stats.attendanceRate >= 80 ? 'bg-accent' : 'bg-red-500'
              }))}
              maxValue={100}
              height={200}
            />
          </div>

          {/* Hourly Stats */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">시간대별 출석 분포</h3>
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                <BarChart
                  data={hourlyStats
                    .filter(h => h.count > 0)
                    .map(h => ({
                      label: `${h.hour}시`,
                      value: h.count,
                      subLabel: `출석 ${h.presentCount}`
                    }))}
                  height={180}
                  showValues={false}
                />
              </div>
            </div>
          </div>

          {/* Check-in Method Stats */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">출석 체크 방법</h3>
            <div className="flex items-center justify-center gap-8">
              <DonutChart
                data={[
                  { label: 'QR 체크', value: checkInMethodStats.qr, color: '#6366f1' },
                  { label: '수동 체크', value: checkInMethodStats.manual, color: '#8b5cf6' },
                  { label: 'GPS 체크', value: checkInMethodStats.gps, color: '#a855f7' }
                ]}
                size={150}
                centerValue={basicStats.total}
                centerLabel="전체 건수"
              />
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-indigo-500" />
                  <span className="text-sm text-gray-600">QR 체크</span>
                  <span className="text-sm font-medium ml-auto">{checkInMethodStats.qr}건</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-violet-500" />
                  <span className="text-sm text-gray-600">수동 체크</span>
                  <span className="text-sm font-medium ml-auto">{checkInMethodStats.manual}건</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-purple-500" />
                  <span className="text-sm text-gray-600">GPS 체크</span>
                  <span className="text-sm font-medium ml-auto">{checkInMethodStats.gps}건</span>
                </div>
              </div>
            </div>
          </div>

          {/* Comparison Stats */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">이전 기간 대비 변화</h3>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">전체 기록</p>
                <p className="text-xl font-bold text-gray-900">{comparisonStats.current.total}</p>
                <p className={`text-sm ${comparisonStats.change.total >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {comparisonStats.change.total >= 0 ? '+' : ''}{comparisonStats.change.total}
                </p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">출석</p>
                <p className="text-xl font-bold text-green-500">{comparisonStats.current.present}</p>
                <p className={`text-sm ${comparisonStats.change.present >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {comparisonStats.change.present >= 0 ? '+' : ''}{comparisonStats.change.present}
                </p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">지각</p>
                <p className="text-xl font-bold text-yellow-500">{comparisonStats.current.late}</p>
                <p className={`text-sm ${comparisonStats.change.late <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {comparisonStats.change.late >= 0 ? '+' : ''}{comparisonStats.change.late}
                </p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">결석</p>
                <p className="text-xl font-bold text-red-500">{comparisonStats.current.absent}</p>
                <p className={`text-sm ${comparisonStats.change.absent <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {comparisonStats.change.absent >= 0 ? '+' : ''}{comparisonStats.change.absent}
                </p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">출석률 변화</p>
                <p className={`text-xl font-bold ${comparisonStats.change.attendanceRate >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {comparisonStats.change.attendanceRate >= 0 ? '+' : ''}{comparisonStats.change.attendanceRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
