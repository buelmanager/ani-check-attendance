import { useState, useMemo } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useStore } from '../../store/useStore';
import TimePicker, { CompactTimePicker } from '../../components/TimePicker';

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

export default function AdminClasses() {
  const { classes, students, addClass, updateClass, deleteClass } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', time: '' });
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [timeByDay, setTimeByDay] = useState<Record<string, string>>({});
  const [showStudentModal, setShowStudentModal] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [pendingStudentIds, setPendingStudentIds] = useState<string[]>([]);

  const toggleDay = (day: string) => {
    setSelectedDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b))
    );
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;
    if (selectedDays.length === 0) {
      alert('수업 요일을 선택해주세요.');
      return;
    }

    const schedule = selectedDays.join(', ');
    const defaultTime = formData.time || '09:00';

    // 기본 시간과 다른 요일만 timeByDay에 저장
    const filteredTimeByDay: Record<string, string> = {};
    for (const day of selectedDays) {
      if (timeByDay[day] && timeByDay[day] !== defaultTime) {
        filteredTimeByDay[day] = timeByDay[day];
      }
    }

    setIsSubmitting(true);
    try {
      if (editingClass) {
        await updateClass(editingClass, {
          name: formData.name,
          schedule,
          time: defaultTime,
          timeByDay: Object.keys(filteredTimeByDay).length > 0 ? filteredTimeByDay : undefined
        });
      } else {
        await addClass({
          name: formData.name,
          schedule,
          time: defaultTime,
          timeByDay: Object.keys(filteredTimeByDay).length > 0 ? filteredTimeByDay : undefined,
          studentIds: []
        });
      }
      closeModal();
    } catch (error) {
      console.error('Error saving class:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 이 클래스를 삭제하시겠습니까?')) return;

    try {
      await deleteClass(id);
    } catch (error) {
      console.error('Error deleting class:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const openEditModal = (cls: typeof classes[0]) => {
    setEditingClass(cls.id);
    setFormData({ name: cls.name, time: cls.time });
    // 기존 schedule에서 요일 추출 (예: "월, 수, 금" -> ["월", "수", "금"])
    const days = cls.schedule.split(',').map(d => d.trim()).filter(d => DAYS.includes(d));
    setSelectedDays(days);
    // 요일별 시간 설정
    setTimeByDay(cls.timeByDay || {});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingClass(null);
    setFormData({ name: '', time: '' });
    setSelectedDays([]);
    setTimeByDay({});
  };

  // 학생 모달 열기
  const openStudentModal = (classId: string) => {
    const cls = classes.find(c => c.id === classId);
    setPendingStudentIds(cls?.studentIds || []);
    setStudentSearch('');
    setShowStudentModal(classId);
  };

  // 학생 선택 토글 (로컬 상태만)
  const toggleStudentSelection = (studentId: string) => {
    setPendingStudentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  // 학생 배정 저장
  const saveStudentAssignments = async () => {
    if (!showStudentModal) return;
    setIsSubmitting(true);
    try {
      await updateClass(showStudentModal, {
        studentIds: pendingStudentIds
      });
      setShowStudentModal(null);
    } catch (error) {
      console.error('Error updating students:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 전체 선택/해제
  const toggleAllStudents = (selectAll: boolean) => {
    if (selectAll) {
      setPendingStudentIds(filteredStudents.map(s => s.id));
    } else {
      setPendingStudentIds([]);
    }
  };

  // 검색된 학생 목록
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const search = studentSearch.toLowerCase();
    return students.filter(s =>
      s.name.toLowerCase().includes(search) ||
      s.phone?.includes(search)
    );
  }, [students, studentSearch]);

  // 선택된 학생 수
  const selectedCount = pendingStudentIds.length;
  const isAllSelected = filteredStudents.length > 0 && filteredStudents.every(s => pendingStudentIds.includes(s.id));

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">클래스 관리</h1>
          <p className="text-gray-500">{classes.length}개의 클래스</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-accent flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          클래스 추가
        </button>
      </div>

      {/* Classes Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">클래스명</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">일정</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">시간</th>
                <th className="px-6 py-4 text-center text-sm font-medium text-gray-500">학생 수</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-gray-500">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {classes.map((cls) => (
                <tr key={cls.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-900">{cls.name}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{cls.schedule}</td>
                  <td className="px-6 py-4 text-gray-500">
                    {cls.timeByDay && Object.keys(cls.timeByDay).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {cls.schedule.split(',').map(d => d.trim()).map((day) => {
                          const dayTime = cls.timeByDay?.[day] || cls.time;
                          const isDifferent = cls.timeByDay?.[day] && cls.timeByDay[day] !== cls.time;
                          return (
                            <span
                              key={day}
                              className={`text-xs px-2 py-1 rounded ${
                                isDifferent ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {day} {dayTime}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      cls.time
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => openStudentModal(cls.id)}
                      className="px-3 py-1 bg-accent/20 text-accent rounded-lg text-sm hover:bg-accent/30"
                    >
                      {cls.studentIds.length}명
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(cls)}
                        className="p-2 text-gray-500 hover:text-accent rounded-lg hover:bg-accent/10"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(cls.id)}
                        className="p-2 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-500/10"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {classes.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">등록된 클래스가 없습니다.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeModal} />
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              {editingClass ? '클래스 수정' : '새 클래스 추가'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500 mb-2 block">클래스 이름</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="예: 초등 미술반"
                  className="input-field"
                />
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-2 block">수업 요일</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`w-10 h-10 rounded-xl font-medium transition-all ${
                        selectedDays.includes(day)
                          ? 'bg-accent text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                {selectedDays.length > 0 && (
                  <p className="text-sm text-accent mt-2">
                    선택: {selectedDays.join(', ')}
                  </p>
                )}
              </div>

              <TimePicker
                label="기본 수업 시간"
                value={formData.time}
                onChange={(time) => setFormData({ ...formData, time })}
              />

              {/* 요일별 다른 시간 설정 */}
              {selectedDays.length > 1 && (
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">
                    요일별 시간 설정 <span className="text-xs text-gray-400">(다를 경우만 변경)</span>
                  </label>
                  <div className="space-y-2">
                    {selectedDays.map((day) => (
                      <div key={day} className="flex items-center gap-3">
                        <span className="w-8 text-center font-medium text-gray-700">{day}</span>
                        <CompactTimePicker
                          value={timeByDay[day] || formData.time || ''}
                          onChange={(newTime) => {
                            setTimeByDay(prev => ({
                              ...prev,
                              [day]: newTime
                            }));
                          }}
                          placeholder={formData.time || '09:00'}
                        />
                        {timeByDay[day] && timeByDay[day] !== formData.time && (
                          <button
                            type="button"
                            onClick={() => {
                              setTimeByDay(prev => {
                                const updated = { ...prev };
                                delete updated[day];
                                return updated;
                              });
                            }}
                            className="p-2 text-gray-400 hover:text-gray-600"
                            title="기본 시간으로 초기화"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={closeModal} className="flex-1 btn-outline">
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 btn-accent disabled:opacity-50"
              >
                {isSubmitting ? '저장 중...' : editingClass ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Assignment Modal */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowStudentModal(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl overflow-hidden max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">학생 배정</h2>
                <button
                  onClick={() => setShowStudentModal(null)}
                  className="p-2 hover:bg-gray-200 rounded-lg"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="학생 이름 또는 전화번호 검색..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>

              {/* Select All / Deselect All */}
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-gray-500">
                  {selectedCount}명 선택됨 (전체 {students.length}명)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleAllStudents(true)}
                    disabled={isAllSelected}
                    className="text-sm text-accent hover:underline disabled:text-gray-400 disabled:no-underline"
                  >
                    전체 선택
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => toggleAllStudents(false)}
                    disabled={selectedCount === 0}
                    className="text-sm text-gray-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                  >
                    전체 해제
                  </button>
                </div>
              </div>
            </div>

            {/* Student List */}
            <div className="flex-1 overflow-auto p-4">
              <div className="space-y-2">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => {
                    const isSelected = pendingStudentIds.includes(student.id);

                    return (
                      <button
                        key={student.id}
                        onClick={() => toggleStudentSelection(student.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                          isSelected
                            ? 'bg-accent/10 border-2 border-accent'
                            : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isSelected ? 'bg-accent border-accent' : 'border-gray-300'
                        }`}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                          isSelected ? 'bg-accent text-white' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {student.name.charAt(0)}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-gray-900">{student.name}</p>
                          {student.phone && (
                            <p className="text-sm text-gray-500">{student.phone}</p>
                          )}
                        </div>
                      </button>
                    );
                  })
                ) : studentSearch ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">검색 결과가 없습니다.</p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">등록된 학생이 없습니다.</p>
                    <p className="text-sm text-gray-400 mt-1">학생 관리 메뉴에서 학생을 먼저 등록해주세요.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t bg-gray-50 flex gap-3">
              <button
                onClick={() => setShowStudentModal(null)}
                className="flex-1 btn-outline"
              >
                취소
              </button>
              <button
                onClick={saveStudentAssignments}
                disabled={isSubmitting}
                className="flex-1 btn-accent disabled:opacity-50"
              >
                {isSubmitting ? '저장 중...' : `${selectedCount}명 저장`}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
