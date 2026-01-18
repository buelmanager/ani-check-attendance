import { useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useStore } from '../../store/useStore';

export default function AdminClasses() {
  const { classes, students, addClass, updateClass, deleteClass } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', schedule: '', time: '' });
  const [showStudentModal, setShowStudentModal] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingClass) {
        await updateClass(editingClass, {
          name: formData.name,
          schedule: formData.schedule || '매일',
          time: formData.time || '09:00'
        });
      } else {
        await addClass({
          name: formData.name,
          schedule: formData.schedule || '매일',
          time: formData.time || '09:00',
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
    setFormData({ name: cls.name, schedule: cls.schedule, time: cls.time });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingClass(null);
    setFormData({ name: '', schedule: '', time: '' });
  };

  const toggleStudent = async (classId: string, studentId: string, isEnrolled: boolean) => {
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;

    try {
      if (isEnrolled) {
        await updateClass(classId, {
          studentIds: cls.studentIds.filter(id => id !== studentId)
        });
      } else {
        await updateClass(classId, {
          studentIds: [...cls.studentIds, studentId]
        });
      }
    } catch (error) {
      console.error('Error updating students:', error);
    }
  };

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
                  <td className="px-6 py-4 text-gray-500">{cls.time}</td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => setShowStudentModal(cls.id)}
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">수업 일정</label>
                  <input
                    type="text"
                    value={formData.schedule}
                    onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                    placeholder="예: 월, 수, 금"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">수업 시간</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>
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
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6 max-h-[80vh] overflow-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-6">학생 배정</h2>

            <div className="space-y-2">
              {students.length > 0 ? (
                students.map((student) => {
                  const cls = classes.find(c => c.id === showStudentModal);
                  const isEnrolled = cls?.studentIds.includes(student.id) || false;

                  return (
                    <button
                      key={student.id}
                      onClick={() => toggleStudent(showStudentModal, student.id, isEnrolled)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                        isEnrolled
                          ? 'bg-accent/20 border border-accent'
                          : 'bg-gray-50 hover:bg-gray-50/80 border border-transparent'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                        isEnrolled ? 'bg-accent text-primary' : 'bg-gray-200 text-gray-900'
                      }`}>
                        {student.name.charAt(0)}
                      </div>
                      <span className="flex-1 text-left text-gray-900">{student.name}</span>
                      {isEnrolled && (
                        <svg className="w-5 h-5 text-accent" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  );
                })
              ) : (
                <p className="text-gray-500 text-center py-8">등록된 학생이 없습니다.</p>
              )}
            </div>

            <button
              onClick={() => setShowStudentModal(null)}
              className="w-full btn-accent mt-6"
            >
              완료
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
