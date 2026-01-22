import { useState, useMemo, useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useStore } from '../../store/useStore';
import { statisticsService, deduplicateAttendances, parseHourFromTimeString } from '../../services/statisticsService';
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
  BarChart2Icon,
  GaugeIcon,
  LineChartIcon,
  PieChartIcon,
  ListIcon,
  TargetIcon,
  ZapIcon,
  ActivityIcon
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
  const [selectedHeatmapCell, setSelectedHeatmapCell] = useState<{ dayOfWeek: number; hour: number } | null>(null);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

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
        const hour = parseHourFromTimeString(a.checkInTime);

        if (hour !== null && !isNaN(hour)) {
          const existing = data.find(d => d.dayOfWeek === dayOfWeek && d.hour === hour);
          if (existing) {
            existing.value++;
          } else {
            data.push({ dayOfWeek, hour, value: 1 });
          }
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
          <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <GaugeIcon size={18} className="text-indigo-500" />
              핵심 출석 지표
            </h3>
            <p className="text-sm text-gray-600">
              선택한 기간 동안의 전체 출석 현황을 한눈에 보여줍니다.
              <span className="font-medium text-indigo-600"> 출석률 85% 이상</span>이 권장 목표입니다.
            </p>
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="card flex flex-col items-center justify-center">
              <AttendanceGauge
                value={basicStats.attendanceRate}
                target={85}
                size={200}
                label="전체 출석률"
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                출석 + 지각을 합한 비율입니다<br/>
                목표선(85%)을 넘으면 좋아요!
              </p>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <CalendarIcon size={18} className="text-indigo-500" />
              출석 현황 캘린더
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              날짜별 출석률을 색상으로 표현합니다. <span className="text-green-600 font-medium">초록색</span>일수록 출석률이 높고,
              <span className="text-red-500 font-medium"> 빨간색</span>일수록 출석률이 낮습니다.
              <span className="text-indigo-600"> 날짜를 클릭</span>하면 해당 날의 상세 출석 기록을 확인할 수 있어요.
            </p>
            <CalendarHeatmap
              data={calendarData}
              startDate={new Date(dateRange.start)}
              endDate={new Date(dateRange.end)}
              onDateClick={(date) => setSelectedCalendarDate(date)}
            />
          </div>

          {/* Charts Row */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <BarChart2Icon size={18} className="text-indigo-500" />
                주간 출석률
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                최근 7일간의 일별 출석률 변화를 보여줍니다.
                막대가 높을수록 해당 날의 출석률이 높습니다.
              </p>
              <BarChart
                data={weeklyChartData}
                maxValue={100}
                height={180}
              />
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <PieChartIcon size={18} className="text-indigo-500" />
                출석 현황 분포
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                전체 출석 기록을 출석/지각/결석/사유결석으로 나눈 비율입니다.
                <span className="text-green-600 font-medium"> 초록색(출석)</span> 비율이 클수록 좋습니다.
              </p>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <LineChartIcon size={18} className="text-indigo-500" />
              월별 출석률 추세
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              최근 6개월간 출석률이 어떻게 변화했는지 보여줍니다.
              <span className="text-indigo-600 font-medium"> 선이 위로 올라가면</span> 출석률이 개선되고 있는 것이고,
              <span className="text-red-500 font-medium"> 아래로 내려가면</span> 관리가 필요합니다.
            </p>
            <TrendChart
              data={trendComparisonData}
              title=""
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
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <AlertTriangleIcon size={18} className="text-red-500" />
                    주의 필요 학생
                  </h3>
                  <span className="text-sm text-red-500 font-medium">{alertStudents.length}명</span>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  연속 결석, 출석률 저하 등의 이유로 관심이 필요한 학생들입니다.
                  <span className="text-indigo-600"> 클릭하면</span> 해당 학생의 상세 출석 현황을 확인할 수 있어요.
                </p>
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <TrophyIcon size={18} className="text-yellow-500" />
                출석 우수 학생 TOP 5
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                출석률이 가장 높은 학생 순위입니다. 연속 출석 일수도 함께 표시됩니다.
                <span className="text-indigo-600"> 학생을 클릭</span>하면 상세 정보를 볼 수 있어요.
              </p>
              <RankingTable
                title=""
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
          <div className="card bg-gradient-to-r from-green-50 to-emerald-50 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <UserIcon size={18} className="text-green-500" />
              원생별 출석 요약
            </h3>
            <p className="text-sm text-gray-600">
              각 원생의 출석 현황을 한눈에 파악할 수 있습니다.
              <span className="font-medium text-green-600"> 출석 우수</span>는 90% 이상,
              <span className="font-medium text-red-500"> 관리 필요</span>는 70% 미만인 원생입니다.
            </p>
          </div>
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
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ListIcon size={18} className="text-indigo-500" />
                원생별 출석 현황
              </h3>
              <span className="text-sm text-gray-500">{studentStats.length}명</span>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              출석률 순으로 정렬되어 있습니다. <span className="font-medium text-green-600">↑</span>는 출석률 상승,
              <span className="font-medium text-red-500"> ↓</span>는 하락 추세입니다.
              <span className="text-indigo-600"> 행을 클릭</span>하면 해당 원생의 상세 출석 리포트를 확인할 수 있어요.
            </p>
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
          <div className="card bg-gradient-to-r from-purple-50 to-pink-50 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <UsersIcon size={18} className="text-purple-500" />
              반별 출석 요약
            </h3>
            <p className="text-sm text-gray-600">
              각 반의 출석 현황을 비교할 수 있습니다. 반별로 출석률이 다르면 수업 시간대나 난이도 등을 점검해보세요.
              <span className="font-medium text-purple-600"> 관리 필요</span>는 출석률 80% 미만인 반입니다.
            </p>
          </div>
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
          <div className="card bg-white mb-2">
            <p className="text-sm text-gray-500">
              각 반 카드에서 <span className="text-green-600 font-medium">초록</span>=출석,
              <span className="text-yellow-500 font-medium"> 노랑</span>=지각,
              <span className="text-red-500 font-medium"> 빨강</span>=결석,
              <span className="text-blue-500 font-medium"> 파랑</span>=사유결석 비율을 막대로 보여줍니다.
              <span className="text-indigo-600"> 카드를 클릭</span>하면 해당 반의 상세 정보를 볼 수 있어요.
            </p>
          </div>
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
          <div className="card bg-gradient-to-r from-indigo-50 to-purple-50 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <SearchIcon size={18} className="text-indigo-500" />
              출석 패턴 분석
            </h3>
            <p className="text-sm text-gray-600">
              언제, 어떤 요일에 출석이 많은지 패턴을 분석합니다.
              이 정보를 활용하면 <span className="font-medium text-indigo-600">수업 시간 조정</span>이나
              <span className="font-medium text-indigo-600"> 결석 예방</span>에 도움이 됩니다.
            </p>
          </div>
          {patterns && (
            <>
              <p className="text-sm text-gray-500 mb-2 flex items-center gap-2">
                <ZapIcon size={14} className="text-yellow-500" />
                <span className="font-medium">핵심 인사이트:</span> 아래 3가지 카드는 출석 패턴의 핵심 정보를 보여줍니다.
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="card bg-gradient-to-br from-green-50 to-emerald-50">
                  <h4 className="text-sm text-gray-500 mb-2 flex items-center gap-1">
                    <TrendingUpIcon size={14} className="text-green-500" />
                    출석 최고 요일
                  </h4>
                  <p className="text-2xl font-bold text-green-600">{patterns.bestDay.dayName}요일</p>
                  <p className="text-sm text-green-700">{patterns.bestDay.rate.toFixed(1)}% 출석률</p>
                  <p className="text-xs text-gray-500 mt-1">이 요일에 출석률이 가장 좋아요!</p>
                </div>
                <div className="card bg-gradient-to-br from-red-50 to-rose-50">
                  <h4 className="text-sm text-gray-500 mb-2 flex items-center gap-1">
                    <TrendingDownIcon size={14} className="text-red-500" />
                    출석 저조 요일
                  </h4>
                  <p className="text-2xl font-bold text-red-600">{patterns.worstDay.dayName}요일</p>
                  <p className="text-sm text-red-700">{patterns.worstDay.rate.toFixed(1)}% 출석률</p>
                  <p className="text-xs text-gray-500 mt-1">이 요일은 관리가 필요해요</p>
                </div>
                <div className="card bg-gradient-to-br from-indigo-50 to-purple-50">
                  <h4 className="text-sm text-gray-500 mb-2 flex items-center gap-1">
                    <ClockIcon size={14} className="text-indigo-500" />
                    출석 집중 시간
                  </h4>
                  <p className="text-2xl font-bold text-indigo-600">{patterns.peakHour.hour}시</p>
                  <p className="text-sm text-indigo-700">{patterns.peakHour.count}건 체크인</p>
                  <p className="text-xs text-gray-500 mt-1">가장 많이 출석하는 시간대</p>
                </div>
              </div>
            </>
          )}

          {/* Weekday-Hour Heatmap */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <CalendarDaysIcon size={18} className="text-indigo-500" />
              요일-시간대별 출석 분포
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              각 셀의 색상이 <span className="text-indigo-600 font-medium">진할수록</span> 해당 요일/시간에 출석이 많습니다.
              어느 시간대에 학생들이 많이 오는지 파악할 수 있어요.
              <span className="text-indigo-600"> 셀을 클릭</span>하면 상세 기록을 볼 수 있습니다.
            </p>
            <WeekdayHeatmap
              data={weekdayHeatmapData}
              onCellClick={(dayOfWeek, hour) => setSelectedHeatmapCell({ dayOfWeek, hour })}
            />
          </div>

          {/* Day of Week Stats */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <BarChart2Icon size={18} className="text-indigo-500" />
              요일별 출석 현황
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              요일별 출석률을 비교합니다. <span className="text-green-600 font-medium">초록</span>=90% 이상(우수),
              <span className="text-indigo-600 font-medium"> 보라</span>=80~90%,
              <span className="text-red-500 font-medium"> 빨강</span>=80% 미만(관리 필요)
            </p>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <ClockIcon size={18} className="text-indigo-500" />
              시간대별 출석 분포
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              시간대별로 몇 명이 출석했는지 보여줍니다. 막대 아래에 출석/지각 건수가 표시됩니다.
              수업 시간 조정이나 피크 시간 파악에 활용하세요.
            </p>
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
                showPercent={false}
              />
            </div>
          </div>

          {/* Check-in Method Stats */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <ActivityIcon size={18} className="text-indigo-500" />
              출석 체크 방법
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              학생들이 어떤 방법으로 출석 체크를 했는지 보여줍니다.
              <span className="text-indigo-600 font-medium"> QR 체크</span>는 QR코드 스캔,
              <span className="text-violet-600 font-medium"> 수동 체크</span>는 관리자가 직접 체크,
              <span className="text-purple-600 font-medium"> GPS 체크</span>는 위치 기반 자동 체크입니다.
            </p>
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
          {/* Analysis Intro */}
          <div className="card bg-gradient-to-r from-orange-50 to-amber-50 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <TargetIcon size={18} className="text-orange-500" />
              심층 분석
            </h3>
            <p className="text-sm text-gray-600">
              이전 기간과 비교하여 출석 현황이 어떻게 변화했는지 분석합니다.
              <span className="font-medium text-orange-600"> 관리 필요 학생</span>과
              <span className="font-medium text-orange-600"> 관리 필요 반</span>을 빠르게 파악하고 조치를 취하세요.
            </p>
          </div>

          {/* Comparison Cards */}
          <div className="card bg-white mb-2">
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <TrendingUpIcon size={14} className="text-green-500" />
              <span className="font-medium">기간 비교 분석:</span> 현재 선택한 기간과 바로 이전 동일 기간을 비교합니다.
              예를 들어 최근 30일을 선택하면, 그 전 30일과 비교합니다.
            </p>
          </div>
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <AlertCircleIcon size={18} className="text-red-500" />
                관리 필요 학생
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                출석률, 연속 결석, 추세를 종합하여 <span className="font-medium text-red-600">관리 필요도(0~100)</span>를 계산합니다.
                숫자가 높을수록 즉각적인 관심이 필요한 학생입니다.
                <span className="text-indigo-600"> 클릭</span>하면 해당 학생의 상세 리포트를 볼 수 있어요.
              </p>
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
                        관리 필요도 {student.riskScore}
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <BarChart2Icon size={18} className="text-indigo-500" />
              이전 기간 대비 변화
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              각 항목별로 이전 기간 대비 변화량을 보여줍니다.
              <span className="text-green-600 font-medium"> 초록색(+)</span>은 개선,
              <span className="text-red-500 font-medium"> 빨간색(-)</span>은 악화를 의미합니다.
              (단, 지각/결석은 줄어야 좋으므로 반대입니다)
            </p>
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
          <div className="card bg-white mb-2">
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <TrophyIcon size={14} className="text-yellow-500" />
              <span className="font-medium">반별 순위:</span> 출석률이 높은 반과 낮은 반을 한눈에 비교할 수 있습니다.
              <span className="text-indigo-600"> 반을 클릭</span>하면 해당 반의 상세 리포트를 볼 수 있어요.
            </p>
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <TrophyIcon size={18} className="text-yellow-500" />
                반별 출석률 순위
              </h3>
              <p className="text-xs text-gray-500 mb-3">출석률이 높은 상위 5개 반</p>
              <RankingTable
                title=""
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <AlertTriangleIcon size={18} className="text-red-500" />
                관리 필요 반
              </h3>
              <p className="text-xs text-gray-500 mb-3">출석률 90% 미만인 반 (낮은 순)</p>
              <RankingTable
                title=""
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

      {/* Calendar Date Detail Modal */}
      {selectedCalendarDate && (() => {
        const dateAttendances = filteredAttendances.filter(a => a.date === selectedCalendarDate);
        const presentCount = dateAttendances.filter(a => a.status === 'present').length;
        const lateCount = dateAttendances.filter(a => a.status === 'late').length;
        const absentCount = dateAttendances.filter(a => a.status === 'absent').length;
        const excusedCount = dateAttendances.filter(a => a.status === 'excused').length;
        const attendanceRate = dateAttendances.length > 0
          ? ((presentCount + lateCount) / dateAttendances.length * 100).toFixed(1)
          : '0';

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={20} className="text-indigo-500" />
                  <span className="text-lg font-bold text-gray-800">
                    {new Date(selectedCalendarDate).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      weekday: 'short'
                    })}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedCalendarDate(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <span className="text-gray-500 text-xl">✕</span>
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(80vh-70px)]">
                {dateAttendances.length > 0 ? (
                  <>
                    <div className="grid grid-cols-5 gap-3 mb-4">
                      <div className="text-center p-3 bg-gray-50 rounded-xl">
                        <div className="text-2xl font-bold text-indigo-600">{dateAttendances.length}</div>
                        <div className="text-xs text-gray-500">전체</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-xl">
                        <div className="text-2xl font-bold text-green-600">{presentCount}</div>
                        <div className="text-xs text-gray-500">출석</div>
                      </div>
                      <div className="text-center p-3 bg-yellow-50 rounded-xl">
                        <div className="text-2xl font-bold text-yellow-600">{lateCount}</div>
                        <div className="text-xs text-gray-500">지각</div>
                      </div>
                      <div className="text-center p-3 bg-red-50 rounded-xl">
                        <div className="text-2xl font-bold text-red-600">{absentCount}</div>
                        <div className="text-xs text-gray-500">결석</div>
                      </div>
                      <div className="text-center p-3 bg-blue-50 rounded-xl">
                        <div className="text-2xl font-bold text-blue-600">{excusedCount}</div>
                        <div className="text-xs text-gray-500">사유결석</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mb-4 p-3 bg-indigo-50 rounded-lg">
                      출석률: <span className="font-bold text-indigo-600 text-lg">{attendanceRate}%</span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-3">출석 기록</div>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {dateAttendances.map((a, i) => {
                          const student = students.find(s => s.id === a.studentId);
                          return (
                            <div key={i} className="flex items-center justify-between text-sm bg-gray-50 p-3 rounded-lg">
                              <span className="font-medium text-gray-800">{student?.name || '알 수 없음'}</span>
                              <span className="text-gray-500">{a.checkInTime || '-'}</span>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                a.status === 'present' ? 'bg-green-100 text-green-700' :
                                a.status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                                a.status === 'absent' ? 'bg-red-100 text-red-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>
                                {a.status === 'present' ? '출석' :
                                 a.status === 'late' ? '지각' :
                                 a.status === 'absent' ? '결석' : '사유결석'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    해당 날짜에 출석 기록이 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Weekday-Hour Heatmap Detail Modal */}
      {selectedHeatmapCell && (() => {
        const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
        const cellData = weekdayHeatmapData.find(
          d => d.dayOfWeek === selectedHeatmapCell.dayOfWeek && d.hour === selectedHeatmapCell.hour
        );
        const cellAttendances = filteredAttendances.filter(a => {
          if (!a.checkInTime) return false;
          const date = new Date(a.date);
          const hour = parseHourFromTimeString(a.checkInTime);
          return date.getDay() === selectedHeatmapCell.dayOfWeek && hour === selectedHeatmapCell.hour;
        });
        const presentCount = cellAttendances.filter(a => a.status === 'present').length;
        const lateCount = cellAttendances.filter(a => a.status === 'late').length;

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClockIcon size={20} className="text-indigo-500" />
                  <span className="text-lg font-bold text-gray-800">
                    {dayLabels[selectedHeatmapCell.dayOfWeek]}요일 {selectedHeatmapCell.hour}시
                  </span>
                </div>
                <button
                  onClick={() => setSelectedHeatmapCell(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <span className="text-gray-500 text-xl">✕</span>
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(80vh-70px)]">
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-indigo-50 rounded-xl">
                    <div className="text-2xl font-bold text-indigo-600">{cellData?.value || 0}</div>
                    <div className="text-xs text-gray-500">총 체크인</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-xl">
                    <div className="text-2xl font-bold text-green-600">{presentCount}</div>
                    <div className="text-xs text-gray-500">정시 출석</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-xl">
                    <div className="text-2xl font-bold text-yellow-600">{lateCount}</div>
                    <div className="text-xs text-gray-500">지각</div>
                  </div>
                </div>

                {cellAttendances.length > 0 ? (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-3">체크인 기록</div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {cellAttendances.map((a, i) => {
                        const student = students.find(s => s.id === a.studentId);
                        return (
                          <div key={i} className="flex items-center justify-between text-sm bg-gray-50 p-3 rounded-lg">
                            <span className="font-medium text-gray-800">{student?.name || '알 수 없음'}</span>
                            <span className="text-gray-500">{a.date} {a.checkInTime}</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              a.status === 'present' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {a.status === 'present' ? '출석' : '지각'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    해당 시간대에 체크인 기록이 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </AdminLayout>
  );
}
