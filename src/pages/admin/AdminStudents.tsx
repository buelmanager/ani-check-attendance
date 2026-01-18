import { useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useStore } from '../../store/useStore';
import type { Student } from '../../types';

export default function AdminStudents() {
  const { students, classes, addStudent, updateStudent, deleteStudent } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', parentPhone: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStudentClasses = (studentId: string) => {
    return classes.filter((c) => c.studentIds.includes(studentId));
  };

  // 초대 링크 생성
  const getInviteLink = (inviteCode: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/invite/${inviteCode}`;
  };

  // 클립보드 복사
  const copyToClipboard = async (text: string, type: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(type);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // 초대 모달 열기
  const openInviteModal = (student: Student) => {
    setSelectedStudent(student);
    setShowInviteModal(true);
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
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">초대 코드</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">연락처</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">등록 클래스</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">계정 상태</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-gray-500">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStudents.map((student) => {
                const studentClasses = getStudentClasses(student.id);
                const hasAccount = !!student.userId;
                const hasParents = student.parentIds && student.parentIds.length > 0;

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
                    <td className="px-6 py-4">
                      {student.inviteCode ? (
                        <button
                          onClick={() => openInviteModal(student)}
                          className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-sm font-mono hover:bg-blue-100 transition-colors"
                        >
                          {student.inviteCode}
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500">{student.phone || '-'}</td>
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
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          hasAccount ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {hasAccount ? '학생 연결됨' : '미연결'}
                        </span>
                        {hasParents && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                            부모 {student.parentIds?.length}명
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openInviteModal(student)}
                          className="p-2 text-gray-500 hover:text-blue-500 rounded-lg hover:bg-blue-500/10"
                          title="초대 링크"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openEditModal(student)}
                          className="p-2 text-gray-500 hover:text-accent rounded-lg hover:bg-accent/10"
                          title="수정"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(student.id)}
                          className="p-2 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-500/10"
                          title="삭제"
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

      {/* Invite Link Modal */}
      {showInviteModal && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowInviteModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">초대 링크</h2>
            <p className="text-gray-500 mb-6">
              <span className="font-semibold text-gray-900">{selectedStudent.name}</span> 학생의 초대 정보입니다.
            </p>

            {/* 초대 코드 */}
            <div className="mb-4">
              <label className="text-sm text-gray-500 mb-2 block">초대 코드</label>
              <div className="flex gap-2">
                <div className="flex-1 px-4 py-3 bg-gray-100 rounded-lg font-mono text-lg text-center">
                  {selectedStudent.inviteCode}
                </div>
                <button
                  onClick={() => copyToClipboard(selectedStudent.inviteCode, 'code')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    copiedCode === 'code'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {copiedCode === 'code' ? '복사됨!' : '복사'}
                </button>
              </div>
            </div>

            {/* 초대 링크 */}
            <div className="mb-6">
              <label className="text-sm text-gray-500 mb-2 block">초대 링크</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={getInviteLink(selectedStudent.inviteCode)}
                  className="flex-1 px-4 py-3 bg-gray-100 rounded-lg text-sm text-gray-600 truncate"
                />
                <button
                  onClick={() => copyToClipboard(getInviteLink(selectedStudent.inviteCode), 'link')}
                  className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                    copiedCode === 'link'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {copiedCode === 'link' ? '복사됨!' : '복사'}
                </button>
              </div>
            </div>

            {/* 계정 연결 상태 */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <h4 className="font-medium text-gray-900 mb-3">계정 연결 상태</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">학생 계정</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    selectedStudent.userId
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {selectedStudent.userId ? '연결됨' : '미연결'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">부모 계정</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    selectedStudent.parentIds && selectedStudent.parentIds.length > 0
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {selectedStudent.parentIds && selectedStudent.parentIds.length > 0
                      ? `${selectedStudent.parentIds.length}명 연결됨`
                      : '미연결'}
                  </span>
                </div>
              </div>
            </div>

            {/* 안내 */}
            <div className="bg-blue-50 rounded-xl p-4 mb-6">
              <p className="text-sm text-blue-700">
                이 링크를 학생 또는 학부모에게 전달하세요. 링크를 통해 회원가입하면 자동으로 연결됩니다.
              </p>
            </div>

            <button
              onClick={() => setShowInviteModal(false)}
              className="w-full btn-primary"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
