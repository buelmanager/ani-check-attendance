import { useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useStore } from '../store/useStore';

export default function Classes() {
  const { classes, addClass, attendances } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [newClass, setNewClass] = useState({ name: '', schedule: '', time: '' });

  const today = new Date().toISOString().split('T')[0];
  const todayAttendances = attendances.filter((a) => a.date === today);

  const handleAdd = () => {
    if (!newClass.name.trim()) return;

    addClass({
      name: newClass.name,
      schedule: newClass.schedule || '매일',
      time: newClass.time || '09:00',
      studentIds: [],
    });

    setNewClass({ name: '', schedule: '', time: '' });
    setShowModal(false);
  };

  const iconColors = ['#E85D4C', '#1E3A5F', '#F8A035', '#2ECC71'];

  return (
    <Layout>
      <div className="px-5 pt-6 pb-4">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-primary">클래스 관리</h1>
            <p className="text-gray-400 text-sm">{classes.length}개의 클래스</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="w-11 h-11 gradient-accent rounded-xl flex items-center justify-center shadow-lg"
            style={{ boxShadow: '0 4px 12px rgba(232, 93, 76, 0.3)' }}
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        </header>

        {/* Classes List */}
        <div className="space-y-3">
          {classes.length > 0 ? (
            classes.map((cls, index) => {
              const classAttendances = todayAttendances.filter((a) => a.classId === cls.id);
              const classPresent = classAttendances.filter((a) => a.status === 'present' || a.status === 'late').length;
              const classRate = cls.studentIds.length > 0
                ? Math.round((classPresent / cls.studentIds.length) * 100)
                : 0;

              return (
                <Link
                  key={cls.id}
                  to={`/classes/${cls.id}`}
                  className="card card-hover block"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ backgroundColor: `${iconColors[index % iconColors.length]}15` }}
                    >
                      <svg className="w-7 h-7" style={{ color: iconColors[index % iconColors.length] }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-primary mb-1">{cls.name}</h3>
                      <div className="flex items-center gap-3 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {cls.schedule}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {cls.time}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">{classRate}%</p>
                      <p className="text-xs text-gray-400">{cls.studentIds.length}명</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all duration-500 rounded-full"
                        style={{
                          width: `${classRate}%`,
                          backgroundColor: iconColors[index % iconColors.length]
                        }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="card text-center py-12">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <p className="text-gray-400 mb-4">등록된 클래스가 없습니다</p>
              <button
                onClick={() => setShowModal(true)}
                className="btn-accent"
              >
                첫 클래스 추가하기
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-[430px] bg-white rounded-t-3xl p-6 animate-slide-up">
            <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6" />

            <h2 className="text-xl font-bold text-primary mb-6">새 클래스 추가</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500 mb-2 block font-medium">클래스 이름</label>
                <input
                  type="text"
                  value={newClass.name}
                  onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                  placeholder="예: 수학 기초반"
                  className="input-field"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-500 mb-2 block font-medium">수업 일정</label>
                  <input
                    type="text"
                    value={newClass.schedule}
                    onChange={(e) => setNewClass({ ...newClass, schedule: e.target.value })}
                    placeholder="예: 월, 수, 금"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-500 mb-2 block font-medium">수업 시간</label>
                  <input
                    type="time"
                    value={newClass.time}
                    onChange={(e) => setNewClass({ ...newClass, time: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 btn-outline">
                취소
              </button>
              <button onClick={handleAdd} className="flex-1 btn-accent">
                추가하기
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
