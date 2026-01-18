import { useState, useMemo } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useStore } from '../../store/useStore';

export default function AdminReports() {
  const { classes, students, attendances } = useStore();
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [selectedClass, setSelectedClass] = useState('');

  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let filteredAttendances = attendances;

    if (selectedClass) {
      filteredAttendances = filteredAttendances.filter((a) => a.classId === selectedClass);
    }

    if (selectedPeriod === 'week') {
      filteredAttendances = filteredAttendances.filter((a) => new Date(a.date) >= weekAgo);
    } else if (selectedPeriod === 'month') {
      filteredAttendances = filteredAttendances.filter((a) => new Date(a.date) >= monthAgo);
    }

    const total = filteredAttendances.length;
    const present = filteredAttendances.filter((a) => a.status === 'present').length;
    const late = filteredAttendances.filter((a) => a.status === 'late').length;
    const absent = filteredAttendances.filter((a) => a.status === 'absent').length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return { total, present, late, absent, rate, filteredAttendances };
  }, [attendances, selectedPeriod, selectedClass]);

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

  const studentStats = useMemo(() => {
    return students.map((student) => {
      const studentAttendances = stats.filteredAttendances.filter((a) => a.studentId === student.id);
      const total = studentAttendances.length;
      const present = studentAttendances.filter((a) => a.status === 'present').length;
      const late = studentAttendances.filter((a) => a.status === 'late').length;
      const absent = studentAttendances.filter((a) => a.status === 'absent').length;
      const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;
      return { ...student, total, present, late, absent, rate };
    }).sort((a, b) => b.rate - a.rate);
  }, [students, stats.filteredAttendances]);

  const weeklyData = useMemo(() => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const data = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      let dayAttendances = attendances.filter((a) => a.date === dateStr);
      if (selectedClass) {
        dayAttendances = dayAttendances.filter((a) => a.classId === selectedClass);
      }

      const present = dayAttendances.filter((a) => a.status === 'present' || a.status === 'late').length;
      const total = dayAttendances.length || 1;

      data.push({
        day: days[date.getDay()],
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        rate: Math.round((present / total) * 100) || 0,
        count: dayAttendances.length
      });
    }

    return data;
  }, [attendances, selectedClass]);

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">통계 리포트</h1>
        <p className="text-gray-500">출석 현황을 분석합니다</p>
      </div>

      {/* Filters */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-sm text-gray-500 mb-2 block">기간</label>
          <div className="flex gap-2">
            {[
              { value: 'week', label: '이번 주' },
              { value: 'month', label: '이번 달' },
              { value: 'all', label: '전체' }
            ].map((period) => (
              <button
                key={period.value}
                onClick={() => setSelectedPeriod(period.value as typeof selectedPeriod)}
                className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${
                  selectedPeriod === period.value
                    ? 'bg-accent text-primary'
                    : 'bg-gray-100 text-gray-500 hover:text-gray-900'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm text-gray-500 mb-2 block">클래스</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="input-field"
          >
            <option value="">전체 클래스</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card text-center">
          <p className="text-4xl font-bold text-accent mb-1">{stats.rate}%</p>
          <p className="text-sm text-gray-500">출석률</p>
        </div>
        <div className="card text-center">
          <p className="text-4xl font-bold text-green-400 mb-1">{stats.present}</p>
          <p className="text-sm text-gray-500">출석</p>
        </div>
        <div className="card text-center">
          <p className="text-4xl font-bold text-amber-400 mb-1">{stats.late}</p>
          <p className="text-sm text-gray-500">지각</p>
        </div>
        <div className="card text-center">
          <p className="text-4xl font-bold text-red-400 mb-1">{stats.absent}</p>
          <p className="text-sm text-gray-500">결석</p>
        </div>
      </div>

      {/* Weekly Chart */}
      <div className="card mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">주간 출석률</h3>
        <div className="flex items-end justify-between gap-2 h-40">
          {weeklyData.map((day, index) => (
            <div key={index} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full bg-gray-100 rounded-t-lg overflow-hidden h-32 flex flex-col justify-end">
                <div
                  className="bg-accent transition-all duration-500 rounded-t-lg"
                  style={{ height: `${day.rate}%` }}
                />
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">{day.day}</p>
                <p className="text-xs text-gray-500">{day.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Class & Student Stats */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Class Rankings */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">클래스별 출석률</h3>
          <div className="space-y-4">
            {classStats.slice(0, 5).map((cls, index) => (
              <div key={cls.id}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                      index === 1 ? 'bg-gray-400/20 text-gray-500' :
                      index === 2 ? 'bg-orange-600/20 text-orange-400' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="text-gray-900">{cls.name}</span>
                  </div>
                  <span className="font-bold text-accent">{cls.rate}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-500"
                    style={{ width: `${cls.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Student Rankings */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">학생별 출석률 TOP 10</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500">
                  <th className="pb-3">순위</th>
                  <th className="pb-3">학생</th>
                  <th className="pb-3 text-center">출석</th>
                  <th className="pb-3 text-center">지각</th>
                  <th className="pb-3 text-center">결석</th>
                  <th className="pb-3 text-right">출석률</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {studentStats.slice(0, 10).map((student, index) => (
                  <tr key={student.id}>
                    <td className="py-3">
                      <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                        index === 1 ? 'bg-gray-400/20 text-gray-500' :
                        index === 2 ? 'bg-orange-600/20 text-orange-400' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="py-3 text-gray-900">{student.name}</td>
                    <td className="py-3 text-center text-green-400">{student.present}</td>
                    <td className="py-3 text-center text-amber-400">{student.late}</td>
                    <td className="py-3 text-center text-red-400">{student.absent}</td>
                    <td className="py-3 text-right font-bold text-accent">{student.rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
