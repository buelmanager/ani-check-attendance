import { useState, useMemo } from 'react';
import Layout from '../components/Layout';
import { useStore } from '../store/useStore';
import { deduplicateAttendances } from '../services/statisticsService';

export default function Reports() {
  const { classes, students, attendances } = useStore();
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'all'>('week');

  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let filteredAttendances = attendances;
    if (selectedPeriod === 'week') {
      filteredAttendances = attendances.filter((a) => new Date(a.date) >= weekAgo);
    } else if (selectedPeriod === 'month') {
      filteredAttendances = attendances.filter((a) => new Date(a.date) >= monthAgo);
    }

    // 중복 제거: 같은 학생이 같은 날 여러번 출석 체크해도 마지막 것만 카운트
    const deduplicated = deduplicateAttendances(filteredAttendances);

    const total = deduplicated.length;
    const present = deduplicated.filter((a) => a.status === 'present').length;
    const late = deduplicated.filter((a) => a.status === 'late').length;
    const absent = deduplicated.filter((a) => a.status === 'absent').length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return { total, present, late, absent, rate, filteredAttendances: deduplicated };
  }, [attendances, selectedPeriod]);

  const classStats = useMemo(() => {
    return classes.map((cls) => {
      const classAttendances = stats.filteredAttendances.filter((a) => a.classId === cls.id);
      const total = classAttendances.length;
      const present = classAttendances.filter((a) => a.status === 'present').length;
      const late = classAttendances.filter((a) => a.status === 'late').length;
      const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
      return { ...cls, total, present, late, rate };
    }).sort((a, b) => b.rate - a.rate);
  }, [classes, stats.filteredAttendances]);

  const topStudents = useMemo(() => {
    return students.map((student) => {
      const studentAttendances = stats.filteredAttendances.filter((a) => a.studentId === student.id);
      const total = studentAttendances.length;
      const present = studentAttendances.filter((a) => a.status === 'present').length;
      const late = studentAttendances.filter((a) => a.status === 'late').length;
      const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;
      return { ...student, total, rate };
    }).sort((a, b) => b.rate - a.rate).slice(0, 5);
  }, [students, stats.filteredAttendances]);

  const weeklyData = useMemo(() => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const data = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayAttendances = attendances.filter((a) => a.date === dateStr);
      // 중복 제거 적용
      const deduplicated = deduplicateAttendances(dayAttendances);
      const present = deduplicated.filter((a) => a.status === 'present' || a.status === 'late').length;
      const total = deduplicated.length || 1;

      data.push({
        day: days[date.getDay()],
        rate: Math.round((present / total) * 100) || 0,
      });
    }

    return data;
  }, [attendances]);

  const medalColors = ['#F8A035', '#8E9AAB', '#CD7F32'];

  return (
    <Layout>
      <div className="px-5 pt-6 pb-4">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-primary">통계 리포트</h1>
          <p className="text-gray-400 text-sm">출석 현황을 분석합니다</p>
        </header>

        {/* Period Selector */}
        <div className="tab-container mb-6">
          {[
            { value: 'week', label: '이번 주' },
            { value: 'month', label: '이번 달' },
            { value: 'all', label: '전체' },
          ].map((period) => (
            <button
              key={period.value}
              onClick={() => setSelectedPeriod(period.value as typeof selectedPeriod)}
              className={`tab-item ${selectedPeriod === period.value ? 'active' : ''}`}
            >
              {period.label}
            </button>
          ))}
        </div>

        {/* Main Stats */}
        <div className="gradient-primary rounded-3xl p-6 mb-6 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />

          <div className="relative z-10">
            <p className="text-white/70 text-sm mb-1">전체 출석률</p>
            <div className="flex items-end gap-2 mb-6">
              <span className="text-5xl font-bold text-white">{stats.rate}</span>
              <span className="text-2xl text-white/70 mb-1">%</span>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-success">{stats.present}</p>
                <p className="text-xs text-white/70">출석</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-warning">{stats.late}</p>
                <p className="text-xs text-white/70">지각</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-danger">{stats.absent}</p>
                <p className="text-xs text-white/70">결석</p>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Chart */}
        <div className="card mb-6">
          <h3 className="text-primary font-semibold mb-4">주간 출석률</h3>
          <div className="flex items-end justify-between gap-2 h-32">
            {weeklyData.map((day, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-gray-100 rounded-full overflow-hidden h-24 flex flex-col justify-end">
                  <div
                    className="gradient-accent transition-all duration-500 rounded-full"
                    style={{ height: `${day.rate}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400">{day.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Class Rankings */}
        <div className="mb-6">
          <h3 className="text-primary font-semibold mb-4">클래스별 출석률</h3>
          <div className="space-y-3">
            {classStats.map((cls, index) => (
              <div key={cls.id} className="card">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      backgroundColor: index < 3 ? `${medalColors[index]}20` : '#EEF0F5',
                      color: index < 3 ? medalColors[index] : '#8E9AAB'
                    }}
                  >
                    <span className="font-bold text-sm">{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-primary font-medium">{cls.name}</p>
                    <p className="text-sm text-gray-400">{cls.studentIds.length}명</p>
                  </div>
                  <p className="text-xl font-bold text-primary">{cls.rate}%</p>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full gradient-accent transition-all duration-500 rounded-full"
                    style={{ width: `${cls.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Students */}
        <div>
          <h3 className="text-primary font-semibold mb-4">우수 학생 TOP 5</h3>
          <div className="space-y-3">
            {topStudents.map((student, index) => (
              <div key={student.id} className="card flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: index < 3 ? `${medalColors[index]}20` : '#EEF0F5',
                    color: index < 3 ? medalColors[index] : '#8E9AAB'
                  }}
                >
                  <span className="font-bold">{index + 1}</span>
                </div>
                <div className="flex-1">
                  <p className="text-primary font-medium">{student.name}</p>
                  <p className="text-sm text-gray-400">{student.total}회 출석</p>
                </div>
                <p className="text-lg font-bold text-primary">{student.rate}%</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
