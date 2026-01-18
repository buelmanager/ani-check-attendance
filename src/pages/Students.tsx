import { useState } from 'react';
import Layout from '../components/Layout';
import { useStore } from '../store/useStore';

export default function Students() {
  const { students, addStudent, classes, attendances } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', phone: '', parentPhone: '' });
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAdd = () => {
    if (!newStudent.name.trim()) return;

    addStudent({
      name: newStudent.name,
      phone: newStudent.phone || undefined,
      parentPhone: newStudent.parentPhone || undefined,
    });

    setNewStudent({ name: '', phone: '', parentPhone: '' });
    setShowModal(false);
  };

  const getStudentStats = (studentId: string) => {
    const studentAttendances = attendances.filter((a) => a.studentId === studentId);
    const total = studentAttendances.length;
    const present = studentAttendances.filter((a) => a.status === 'present').length;
    const late = studentAttendances.filter((a) => a.status === 'late').length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;
    return { rate };
  };

  const getStudentClasses = (studentId: string) => {
    return classes.filter((c) => c.studentIds.includes(studentId));
  };

  const avatarColors = ['#E85D4C', '#1E3A5F', '#F8A035', '#2ECC71', '#9B59B6'];

  return (
    <Layout>
      <div className="px-5 pt-6 pb-4">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-primary">학생 관리</h1>
            <p className="text-gray-400 text-sm">{students.length}명의 학생</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="w-11 h-11 gradient-accent rounded-xl flex items-center justify-center shadow-lg"
            style={{ boxShadow: '0 4px 12px rgba(232, 93, 76, 0.3)' }}
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </button>
        </header>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="학생 검색..."
              className="w-full bg-white border-2 border-gray-100 rounded-2xl pl-12 pr-4 py-3 text-primary placeholder-gray-400 focus:outline-none focus:border-primary shadow-sm"
            />
          </div>
        </div>

        {/* Students List */}
        <div className="space-y-3">
          {filteredStudents.length > 0 ? (
            filteredStudents.map((student, index) => {
              const stats = getStudentStats(student.id);
              const studentClasses = getStudentClasses(student.id);

              return (
                <div key={student.id} className="card card-hover">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: avatarColors[index % avatarColors.length] }}
                    >
                      {student.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-primary">{student.name}</h3>
                      <p className="text-sm text-gray-400">
                        {studentClasses.length > 0
                          ? studentClasses.map((c) => c.name).join(', ')
                          : '클래스 없음'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">{stats.rate}%</p>
                      <p className="text-xs text-gray-400">출석률</p>
                    </div>
                  </div>

                  {student.phone && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4 text-sm">
                      <a
                        href={`tel:${student.phone}`}
                        className="flex items-center gap-2 text-gray-500 hover:text-accent transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {student.phone}
                      </a>
                      {student.parentPhone && (
                        <a
                          href={`tel:${student.parentPhone}`}
                          className="flex items-center gap-2 text-gray-500 hover:text-warning transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          보호자
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="card text-center py-12">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <p className="text-gray-400 mb-4">
                {searchQuery ? '검색 결과가 없습니다' : '등록된 학생이 없습니다'}
              </p>
              {!searchQuery && (
                <button onClick={() => setShowModal(true)} className="btn-accent">
                  첫 학생 추가하기
                </button>
              )}
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

            <h2 className="text-xl font-bold text-primary mb-6">새 학생 추가</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500 mb-2 block font-medium">이름 *</label>
                <input
                  type="text"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  placeholder="학생 이름"
                  className="input-field"
                />
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-2 block font-medium">연락처</label>
                <input
                  type="tel"
                  value={newStudent.phone}
                  onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                  placeholder="010-0000-0000"
                  className="input-field"
                />
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-2 block font-medium">보호자 연락처</label>
                <input
                  type="tel"
                  value={newStudent.parentPhone}
                  onChange={(e) => setNewStudent({ ...newStudent, parentPhone: e.target.value })}
                  placeholder="010-0000-0000"
                  className="input-field"
                />
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
