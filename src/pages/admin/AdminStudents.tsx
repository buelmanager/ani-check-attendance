import { useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useStore } from '../../store/useStore';

export default function AdminStudents() {
  const { students, classes, addStudent, updateStudent, deleteStudent } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', parentPhone: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStudentClasses = (studentId: string) => {
    return classes.filter((c) => c.studentIds.includes(studentId));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingStudent) {
        await updateStudent(editingStudent, {
          name: formData.name,
          phone: formData.phone || undefined,
          parentPhone: formData.parentPhone || undefined
        });
      } else {
        await addStudent({
          name: formData.name,
          phone: formData.phone || undefined,
          parentPhone: formData.parentPhone || undefined
        });
      }
      closeModal();
    } catch (error) {
      console.error('Error saving student:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 이 학생을 삭제하시겠습니까?')) return;

    try {
      await deleteStudent(id);
    } catch (error) {
      console.error('Error deleting student:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const openEditModal = (student: typeof students[0]) => {
    setEditingStudent(student.id);
    setFormData({
      name: student.name,
      phone: student.phone || '',
      parentPhone: student.parentPhone || ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingStudent(null);
    setFormData({ name: '', phone: '', parentPhone: '' });
  };

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">학생 관리</h1>
          <p className="text-gray-500">{students.length}명의 학생</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-accent flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          학생 추가
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="학생 검색..."
            className="input-field pl-12"
          />
        </div>
      </div>

      {/* Students Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">이름</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">연락처</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">보호자 연락처</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">등록 클래스</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-gray-500">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStudents.map((student) => {
                const studentClasses = getStudentClasses(student.id);

                return (
                  <tr key={student.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                          <span className="text-primary font-bold text-sm">{student.name.charAt(0)}</span>
                        </div>
                        <span className="font-medium text-gray-900">{student.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{student.phone || '-'}</td>
                    <td className="px-6 py-4 text-gray-500">{student.parentPhone || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {studentClasses.length > 0 ? (
                          studentClasses.map((cls) => (
                            <span
                              key={cls.id}
                              className="px-2 py-1 bg-gray-50 text-gray-600 rounded text-xs"
                            >
                              {cls.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500 text-sm">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(student)}
                          className="p-2 text-gray-500 hover:text-accent rounded-lg hover:bg-accent/10"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(student.id)}
                          className="p-2 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-500/10"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredStudents.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {searchQuery ? '검색 결과가 없습니다.' : '등록된 학생이 없습니다.'}
              </p>
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
              {editingStudent ? '학생 정보 수정' : '새 학생 추가'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500 mb-2 block">이름 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="학생 이름"
                  className="input-field"
                />
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-2 block">연락처</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="010-0000-0000"
                  className="input-field"
                />
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-2 block">보호자 연락처</label>
                <input
                  type="tel"
                  value={formData.parentPhone}
                  onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                  placeholder="010-0000-0000"
                  className="input-field"
                />
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
                {isSubmitting ? '저장 중...' : editingStudent ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
