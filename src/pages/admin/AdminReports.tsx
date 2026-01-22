import { useState, useMemo, useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useStore } from '../../store/useStore';
import { statisticsService, deduplicateAttendances } from '../../services/statisticsService';
import {
  StatCard,
  BarChart,
  DonutChart,
  DonutChartLegend,
  AlertStudentCard,
  RankingTable,
  CalendarHeatmap,
  TrendChart,
  AttendanceGauge,
  ComparisonCard,
  WeekdayHeatmap,
  StudentReportCard,
  ClassReportCard,
  ChartBarIcon,
  UserIcon,
  UsersIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  SearchIcon,
  AlertTriangleIcon,
  TrophyIcon,
  AlertCircleIcon,
  CalendarIcon,
  ClockIcon,
  CalendarDaysIcon,
  BarChart2Icon
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

type TabType = 'overview' | 'students' | 'classes' | 'patterns' | 'analysis';

export default function AdminReports() {
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

  // 모달 상태
  const [selectedStudent, setSelectedStudent] = useState<StudentAttendanceStats | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassAttendanceStats | null>(null);

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

  // 기본 통계 (중복 제거 적용)
  const basicStats = useMemo(() => {
    // 중복 제거: 같은 학생이 같은 날 여러번 출석 체크해도 마지막 것만 카운트
    const deduplicated = deduplicateAttendances(filteredAttendances);
    const total = deduplicated.length;
    const present = deduplicated.filter(a => a.status === 'present').length;
    const late = deduplicated.filter(a => a.status === 'late').length;
    const absent = deduplicated.filter(a => a.status === 'absent').length;
    const excused = deduplicated.filter(a => a.status === 'excused').length;

    return {
      total,
      present,
      late,
      absent,
      excused,
      attendanceRate: total > 0 ? Math.round(((present + late) / total) * 100 * 10) / 10 : 0,
      punctualityRate: total > 0 ? Math.round((present / total) * 100 * 10) / 10 : 0
    };
  }, [filteredAttendances]);

  // 비교 통계
  const comparisonStats = useMemo((): ComparisonStats => {
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

  // 일별 통계
  const dailyStats = useMemo((): DailyStats[] => {
    return statisticsService.getDailyStatsRange(filteredAttendances, dateRange.start, dateRange.end);
  }, [filteredAttendances, dateRange]);

  // 캘린더 히트맵 데이터
  const calendarData = useMemo(() => {
    return dailyStats.map(d => ({
      date: d.date,
      value: d.attendanceRate
    }));
  }, [dailyStats]);

  // 주간 차트 데이터 (최근 7일)
  const weeklyChartData = useMemo(() => {
    const last7Days = dailyStats.slice(-7);
    return last7Days.map(day => ({
      label: day.date.slice(5).replace('-', '/'),
      value: day.attendanceRate,
      subLabel: DAY_LABELS[day.dayOfWeek]
    }));
  }, [dailyStats]);

  // 추세 비교 차트 데이터 (현재 vs 이전)
  const trendComparisonData = useMemo(() => {
    const trends = statisticsService.getAttendanceTrends(attendances, 6);
    return trends.map((t, i) => ({
      label: t.period.replace(/\d+년 /, ''),
      value: t.rate,
      previousValue: i > 0 ? trends[i - 1].rate : undefined
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

  // 요일-시간 히트맵 데이터
  const weekdayHeatmapData = useMemo(() => {
    const data: { dayOfWeek: number; hour: number; value: number }[] = [];

    filteredAttendances.forEach(a => {
      if (a.checkInTime) {
        const dayOfWeek = new Date(a.date).getDay();
        const hour = parseInt(a.checkInTime.split(':')[0], 10);

        const existing = data.find(d => d.dayOfWeek === dayOfWeek && d.hour === hour);
        if (existing) {
          existing.value++;
        } else {
          data.push({ dayOfWeek, hour, value: 1 });
        }
      }
    });

    return data;
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

  // 반별 통계 (상세 옵션 포함)
  const classStats = useMemo((): ClassAttendanceStats[] => {
    return classes.map(cls =>
      statisticsService.getClassStats(cls, students, filteredAttendances, {
        includeWeekly: true,
        includeMonthly: true
      })
    ).sort((a, b) => b.attendanceRate - a.attendanceRate);
  }, [filteredAttendances, classes, students]);

  // 주의 필요 학생
  const alertStudents = useMemo((): AlertStudent[] => {
    return statisticsService.getAlertStudents(students, attendances, classes);
  }, [attendances, students, classes]);

  // 위험도 높은 학생 (상위 5명)
  // 출석 기록이 최소 5개 이상인 학생만 대상으로 함 (데이터 부족시 위험도 계산 제외)
  const riskStudents = useMemo(() => {
    return studentStats
      .filter(s => s.total >= 5) // 출석 기록이 5개 미만이면 위험도 계산에서 제외
      .map(s => {
        let riskScore = 0;
        if (s.attendanceRate < 70) riskScore += 40;
        else if (s.attendanceRate < 80) riskScore += 25;
        else if (s.attendanceRate < 90) riskScore += 10;
        if (s.consecutiveAbsent >= 5) riskScore += 30;
        else if (s.consecutiveAbsent >= 3) riskScore += 20;
        else if (s.consecutiveAbsent >= 2) riskScore += 10;
        if (s.trend === 'declining') riskScore += 15;
        return { ...s, riskScore };
      })
      .filter(s => s.riskScore > 20)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 5);
  }, [studentStats]);

  // 탭 목록
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: '전체 현황', icon: <ChartBarIcon size={16} /> },
    { id: 'students', label: '원생별', icon: <UserIcon size={16} /> },
    { id: 'classes', label: '반별', icon: <UsersIcon size={16} /> },
    { id: 'patterns', label: '패턴 분석', icon: <TrendingUpIcon size={16} /> },
    { id: 'analysis', label: '심층 분석', icon: <SearchIcon size={16} /> }
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
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ChartBarIcon size={24} className="text-indigo-500" />
          출석 통계 대시보드
        </h1>
        <p className="text-gray-500">상세한 출석 데이터를 분석하고 인사이트를 얻으세요</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-accent text-primary'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          {/* Main Stats with Gauge */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="card flex flex-col items-center justify-center">
              <AttendanceGauge
                value={basicStats.attendanceRate}
                target={85}
                size={200}
                label="전체 출석률"
              />
            </div>

            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
              <StatCard
                title="총 출석 기록"
                value={basicStats.total}
                subtitle={`${dateRange.start} ~ ${dateRange.end}`}
                color="blue"
                trend={comparisonStats.change.total !== 0 ? {
                  value: comparisonStats.change.total,
                  isPositive: comparisonStats.change.total > 0
                } : undefined}
              />
              <StatCard
                title="정시 출석"
                value={basicStats.present}
                subtitle={`${basicStats.punctualityRate}%`}
                color="green"
              />
              <StatCard
                title="지각"
                value={basicStats.late}
                subtitle={`${basicStats.total > 0 ? ((basicStats.late / basicStats.total) * 100).toFixed(1) : 0}%`}
                color="yellow"
              />
              <StatCard
                title="결석"
                value={basicStats.absent + basicStats.excused}
                subtitle={`결석 ${basicStats.absent} / 사유 ${basicStats.excused}`}
                color="red"
              />
            </div>
          </div>

          {/* Calendar Heatmap */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CalendarIcon size={18} className="text-indigo-500" />
              출석 현황 캘린더
            </h3>
            <CalendarHeatmap
              data={calendarData}
              startDate={new Date(dateRange.start)}
              endDate={new Date(dateRange.end)}
            />
          </div>

          {/* Charts Row */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">주간 출석률</h3>
              <BarChart
                data={weeklyChartData}
                maxValue={100}
                height={180}
              />
            </div>

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

          {/* Trend Chart */}
          <div className="card">
            <TrendChart
              data={trendComparisonData}
              title="월별 출석률 추세"
              height={200}
              showComparison={true}
              valueLabel="현재"
              comparisonLabel="이전"
            />
          </div>

          {/* Alert Students & Rankings */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Alert Students */}
            {alertStudents.length > 0 && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <AlertTriangleIcon size={18} className="text-red-500" />
                    주의 필요 학생
                  </h3>
                  <span className="text-sm text-red-500 font-medium">{alertStudents.length}명</span>
                </div>
                <div className="space-y-3">
                  {alertStudents.slice(0, 5).map(student => (
                    <AlertStudentCard
                      key={`${student.studentId}-${student.alertType}`}
                      student={student}
                      onClick={() => {
                        const fullStudent = studentStats.find(s => s.studentId === student.studentId);
                        if (fullStudent) setSelectedStudent(fullStudent);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Top Students */}
            <div className="card">
              <RankingTable
                title="출석 우수 학생 TOP 5"
                icon={<TrophyIcon size={18} className="text-yellow-500" />}
                items={studentStats.slice(0, 5).map((s, i) => ({
                  id: s.studentId,
                  rank: s.rank || i + 1,
                  name: s.studentName,
                  subtitle: s.className,
                  value: s.attendanceRate,
                  subValues: [
                    { label: '출석', value: s.present, color: 'text-green-500' },
                    { label: '연속', value: s.consecutivePresent, color: 'text-blue-500' }
                  ]
                }))}
                onItemClick={(id) => {
                  const student = studentStats.find(s => s.studentId === id);
                  if (student) setSelectedStudent(student);
                }}
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
                ? (studentStats.reduce((sum, s) => sum + s.attendanceRate, 0) / studentStats.length).toFixed(1)
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
              value={studentStats.filter(s => s.total >= 5 && s.attendanceRate < 70).length}
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
                    <th className="pb-3 pl-2">순위</th>
                    <th className="pb-3">이름</th>
                    <th className="pb-3">반</th>
                    <th className="pb-3 text-center">출석</th>
                    <th className="pb-3 text-center">지각</th>
                    <th className="pb-3 text-center">결석</th>
                    <th className="pb-3 text-center">출석률</th>
                    <th className="pb-3 text-center">추세</th>
                    <th className="pb-3 text-center">상세</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {studentStats.map((student, index) => (
                    <tr
                      key={student.studentId}
                      className="hover:bg-accent/5 cursor-pointer transition-colors"
                      onClick={() => setSelectedStudent(student)}
                    >
                      <td className="py-3 pl-2">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
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
                      <td className="py-3 text-center text-green-600 font-medium">{student.present}</td>
                      <td className="py-3 text-center text-yellow-600 font-medium">{student.late}</td>
                      <td className="py-3 text-center text-red-600 font-medium">{student.absent}</td>
                      <td className="py-3 text-center">
                        <span className={`font-bold ${
                          student.attendanceRate >= 90 ? 'text-green-500' :
                          student.attendanceRate >= 70 ? 'text-accent' :
                          'text-red-500'
                        }`}>
                          {student.attendanceRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                          student.trend === 'improving' ? 'bg-green-100 text-green-700' :
                          student.trend === 'declining' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {student.trend === 'improving' ? '↑' :
                           student.trend === 'declining' ? '↓' : '→'}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span className="text-xs text-accent font-medium">
                          상세보기 →
                        </span>
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
                ? (classStats.reduce((sum, c) => sum + c.attendanceRate, 0) / classStats.length).toFixed(1)
                : 0}%`}
              color="accent"
            />
            <StatCard
              title="최고 출석률"
              value={classStats.length > 0 ? `${classStats[0]?.attendanceRate.toFixed(1) || 0}%` : '-'}
              subtitle={classStats[0]?.className || ''}
              color="green"
            />
            <StatCard
              title="관리 필요"
              value={classStats.filter(c => c.total >= 5 && c.attendanceRate < 80).length}
              subtitle="80% 미만"
              color="red"
            />
          </div>

          {/* Class Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            {classStats.map((cls, index) => (
              <div
                key={cls.classId}
                className="card cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setSelectedClass(cls)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-yellow-500/20 text-yellow-600' :
                      index === 1 ? 'bg-gray-400/20 text-gray-600' :
                      index === 2 ? 'bg-orange-500/20 text-orange-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{cls.className}</h3>
                      <p className="text-sm text-gray-500">{cls.studentCount}명</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${
                      cls.attendanceRate >= 90 ? 'text-green-500' :
                      cls.attendanceRate >= 80 ? 'text-accent' :
                      'text-red-500'
                    }`}>
                      {cls.attendanceRate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500">출석률</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex mb-3">
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

                <div className="flex justify-between text-xs text-gray-500">
                  <span>출석 {cls.present}</span>
                  <span>지각 {cls.late}</span>
                  <span>결석 {cls.absent}</span>
                  <span>사유 {cls.excused}</span>
                </div>
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
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="card bg-gradient-to-br from-green-50 to-emerald-50">
                <h4 className="text-sm text-gray-500 mb-2 flex items-center gap-1">
                  <TrendingUpIcon size={14} className="text-green-500" />
                  출석 최고 요일
                </h4>
                <p className="text-2xl font-bold text-green-600">{patterns.bestDay.dayName}요일</p>
                <p className="text-sm text-green-700">{patterns.bestDay.rate.toFixed(1)}% 출석률</p>
              </div>
              <div className="card bg-gradient-to-br from-red-50 to-rose-50">
                <h4 className="text-sm text-gray-500 mb-2 flex items-center gap-1">
                  <TrendingDownIcon size={14} className="text-red-500" />
                  출석 저조 요일
                </h4>
                <p className="text-2xl font-bold text-red-600">{patterns.worstDay.dayName}요일</p>
                <p className="text-sm text-red-700">{patterns.worstDay.rate.toFixed(1)}% 출석률</p>
              </div>
              <div className="card bg-gradient-to-br from-indigo-50 to-purple-50">
                <h4 className="text-sm text-gray-500 mb-2 flex items-center gap-1">
                  <ClockIcon size={14} className="text-indigo-500" />
                  출석 집중 시간
                </h4>
                <p className="text-2xl font-bold text-indigo-600">{patterns.peakHour.hour}시</p>
                <p className="text-sm text-indigo-700">{patterns.peakHour.count}건 체크인</p>
              </div>
            </div>
          )}

          {/* Weekday-Hour Heatmap */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CalendarDaysIcon size={18} className="text-indigo-500" />
              요일-시간대별 출석 분포
            </h3>
            <WeekdayHeatmap data={weekdayHeatmapData} />
          </div>

          {/* Day of Week Stats */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">요일별 출석 현황</h3>
            <BarChart
              data={dayOfWeekStats.map(d => ({
                label: d.dayName,
                value: d.stats.attendanceRate,
                color: d.stats.attendanceRate >= 90 ? '#22c55e' :
                       d.stats.attendanceRate >= 80 ? '#6366f1' : '#ef4444'
              }))}
              maxValue={100}
              height={200}
            />
          </div>

          {/* Hourly Stats */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">시간대별 출석 분포</h3>
            <div className="overflow-x-auto">
              <BarChart
                data={hourlyStats
                  .filter(h => h.count > 0)
                  .map(h => ({
                    label: `${h.hour}시`,
                    value: h.count,
                    subLabel: `출석 ${h.presentCount} / 지각 ${h.lateCount}`
                  }))}
                height={180}
              />
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
                centerLabel="전체"
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
        </div>
      )}

      {/* Analysis Tab */}
      {activeTab === 'analysis' && (
        <div className="space-y-6">
          {/* Comparison Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            <ComparisonCard
              title="출석률 비교"
              current={{
                label: '현재 기간',
                value: comparisonStats.current.attendanceRate,
                subValue: `${comparisonStats.current.total}건`
              }}
              previous={{
                label: '이전 기간',
                value: comparisonStats.previous.attendanceRate,
                subValue: `${comparisonStats.previous.total}건`
              }}
            />
            <ComparisonCard
              title="결석률 비교"
              current={{
                label: '현재 기간',
                value: comparisonStats.current.total > 0
                  ? (comparisonStats.current.absent / comparisonStats.current.total) * 100
                  : 0,
                subValue: `${comparisonStats.current.absent}건`
              }}
              previous={{
                label: '이전 기간',
                value: comparisonStats.previous.total > 0
                  ? (comparisonStats.previous.absent / comparisonStats.previous.total) * 100
                  : 0,
                subValue: `${comparisonStats.previous.absent}건`
              }}
              higherIsBetter={false}
            />
          </div>

          {/* Risk Students */}
          {riskStudents.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertCircleIcon size={18} className="text-red-500" />
                이탈 위험 학생
              </h3>
              <p className="text-sm text-gray-500 mb-4">출석률, 연속 결석, 추세를 종합하여 위험도를 분석합니다</p>
              <div className="space-y-3">
                {riskStudents.map(student => (
                  <div
                    key={student.studentId}
                    className="flex items-center gap-4 p-4 bg-red-50 rounded-xl cursor-pointer hover:bg-red-100 transition-colors"
                    onClick={() => setSelectedStudent(student)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{student.studentName}</span>
                        <span className="text-sm text-gray-500">{student.className}</span>
                      </div>
                      <div className="flex gap-4 mt-1 text-xs text-gray-600">
                        <span>출석률: {student.attendanceRate.toFixed(1)}%</span>
                        {student.consecutiveAbsent > 0 && (
                          <span className="text-red-600">연속결석: {student.consecutiveAbsent}일</span>
                        )}
                        {student.trend === 'declining' && (
                          <span className="text-orange-600">추세 하락</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${
                        student.riskScore >= 60 ? 'text-red-600' :
                        student.riskScore >= 40 ? 'text-orange-600' : 'text-yellow-600'
                      }`}>
                        위험도 {student.riskScore}
                      </div>
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            student.riskScore >= 60 ? 'bg-red-500' :
                            student.riskScore >= 40 ? 'bg-orange-500' : 'bg-yellow-500'
                          }`}
                          style={{ width: `${student.riskScore}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Period Comparison Stats */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart2Icon size={18} className="text-indigo-500" />
              이전 기간 대비 변화
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">전체 기록</p>
                <p className="text-xl font-bold text-gray-900">{comparisonStats.current.total}</p>
                <p className={`text-sm font-medium ${comparisonStats.change.total >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {comparisonStats.change.total >= 0 ? '+' : ''}{comparisonStats.change.total}
                </p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">출석</p>
                <p className="text-xl font-bold text-green-600">{comparisonStats.current.present}</p>
                <p className={`text-sm font-medium ${comparisonStats.change.present >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {comparisonStats.change.present >= 0 ? '+' : ''}{comparisonStats.change.present}
                </p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">지각</p>
                <p className="text-xl font-bold text-yellow-600">{comparisonStats.current.late}</p>
                <p className={`text-sm font-medium ${comparisonStats.change.late <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {comparisonStats.change.late >= 0 ? '+' : ''}{comparisonStats.change.late}
                </p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">결석</p>
                <p className="text-xl font-bold text-red-600">{comparisonStats.current.absent}</p>
                <p className={`text-sm font-medium ${comparisonStats.change.absent <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {comparisonStats.change.absent >= 0 ? '+' : ''}{comparisonStats.change.absent}
                </p>
              </div>
              <div className="text-center p-4 bg-indigo-50 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">출석률 변화</p>
                <p className={`text-xl font-bold ${comparisonStats.change.attendanceRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {comparisonStats.change.attendanceRate >= 0 ? '+' : ''}{comparisonStats.change.attendanceRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {/* Class Ranking Comparison */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card">
              <RankingTable
                title="반별 출석률 순위"
                icon={<TrophyIcon size={18} className="text-yellow-500" />}
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
                  const cls = classStats.find(c => c.classId === id);
                  if (cls) setSelectedClass(cls);
                }}
              />
            </div>

            <div className="card">
              <RankingTable
                title="관리 필요 반"
                icon={<AlertTriangleIcon size={18} className="text-red-500" />}
                items={[...classStats]
                  .reverse()
                  .filter(c => c.attendanceRate < 90)
                  .slice(0, 5)
                  .map((cls, i) => ({
                    id: cls.classId,
                    rank: i + 1,
                    name: cls.className,
                    subtitle: `${cls.studentCount}명`,
                    value: cls.attendanceRate,
                    subValues: [
                      { label: '결석', value: cls.absent, color: 'text-red-500' },
                      { label: '지각', value: cls.late, color: 'text-yellow-500' }
                    ]
                  }))}
                onItemClick={(id) => {
                  const cls = classStats.find(c => c.classId === id);
                  if (cls) setSelectedClass(cls);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Student Report Modal */}
      {selectedStudent && (
        <StudentReportCard
          student={selectedStudent}
          attendances={attendances}
          onClose={() => setSelectedStudent(null)}
        />
      )}

      {/* Class Report Modal */}
      {selectedClass && (
        <ClassReportCard
          classStats={selectedClass}
          attendances={attendances}
          onStudentClick={(studentId) => {
            const student = studentStats.find(s => s.studentId === studentId);
            if (student) {
              setSelectedClass(null);
              setSelectedStudent(student);
            }
          }}
          onClose={() => setSelectedClass(null)}
        />
      )}
    </AdminLayout>
  );
}
