import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { useStore } from '../../store/useStore';
import { studentService } from '../../services/studentService';
import { parentService } from '../../services/parentService';
import { exportAllStudents, exportFilteredStudents, exportStudentsByStatus, exportFullBackup } from '../../utils/excelExport';
import type { Student, StudentStatus, GradeLevel, Parent } from '../../types';

// 학년 옵션
const GRADE_OPTIONS: GradeLevel[] = [
  '미취학',
  '초1', '초2', '초3', '초4', '초5', '초6',
  '중1', '중2', '중3',
  '고1', '고2', '고3',
  '성인'
];

// 상태 라벨
const STATUS_LABELS: Record<StudentStatus, string> = {
  active: '재원',
  inactive: '휴원',
  withdrawn: '퇴원'
};

// 상태 색상
const STATUS_COLORS: Record<StudentStatus, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-yellow-100 text-yellow-700',
  withdrawn: 'bg-red-100 text-red-700'
};

interface FormData {
  name: string;
  phone: string;
  parentPhone: string;
  birthDate: string;
  gender: 'male' | 'female' | '';
  school: string;
  grade: GradeLevel | '';
  address: string;
  emergencyContact: string;
  notes: string;
  enrolledAt: string;
}

const initialFormData: FormData = {
  name: '',
  phone: '',
  parentPhone: '',
  birthDate: '',
  gender: '',
  school: '',
  grade: '',
  address: '',
  emergencyContact: '',
  notes: '',
  enrolledAt: new Date().toISOString().split('T')[0]
};

export default function AdminStudents() {
  const navigate = useNavigate();
  const { students, classes, addStudent, updateStudent, deleteStudent } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // 필터 상태
  const [statusFilter, setStatusFilter] = useState<StudentStatus | 'all'>('all');
  const [gradeFilter, setGradeFilter] = useState<GradeLevel | 'all'>('all');

  // 부모 데이터 (백업용)
  const [parents, setParents] = useState<Parent[]>([]);

  // 부모 데이터 구독
  useEffect(() => {
    const unsubscribe = parentService.subscribe(setParents);
    return () => unsubscribe();
  }, []);

  // 상태 변경 폼
  const [newStatus, setNewStatus] = useState<StudentStatus>('active');
  const [statusReason, setStatusReason] = useState('');

  // 필터링된 학생 목록
  const filteredStudents = students.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchesGrade = gradeFilter === 'all' || s.grade === gradeFilter;
    return matchesSearch && matchesStatus && matchesGrade;
  });

  // 상태별 카운트
  const statusCounts = {
    all: students.length,
    active: students.filter(s => s.status === 'active' || !s.status).length,
    inactive: students.filter(s => s.status === 'inactive').length,
    withdrawn: students.filter(s => s.status === 'withdrawn').length
  };

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

  // 상태 변경 모달 열기
  const openStatusModal = (student: Student) => {
    setSelectedStudent(student);
    setNewStatus(student.status || 'active');
    setStatusReason('');
    setShowStatusModal(true);
  };

  // 상태 변경 처리
  const handleStatusChange = async () => {
    if (!selectedStudent) return;

    setIsSubmitting(true);
    try {
      await studentService.changeStatus(selectedStudent.id, newStatus, statusReason || undefined);
      setShowStatusModal(false);
      setSelectedStudent(null);
    } catch (error) {
      console.error('Error changing status:', error);
      alert('상태 변경 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      const studentData = {
        name: formData.name,
        phone: formData.phone || undefined,
        parentPhone: formData.parentPhone || undefined,
        birthDate: formData.birthDate || undefined,
        gender: formData.gender || undefined,
        school: formData.school || undefined,
        grade: formData.grade || undefined,
        address: formData.address || undefined,
        emergencyContact: formData.emergencyContact || undefined,
        notes: formData.notes || undefined,
        enrolledAt: formData.enrolledAt || undefined
      };

      if (editingStudent) {
        await updateStudent(editingStudent, studentData);
      } else {
        await addStudent(studentData);
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

  const openEditModal = (student: Student) => {
    setEditingStudent(student.id);
    setFormData({
      name: student.name,
      phone: student.phone || '',
      parentPhone: student.parentPhone || '',
      birthDate: student.birthDate || '',
      gender: student.gender || '',
      school: student.school || '',
      grade: student.grade || '',
      address: student.address || '',
      emergencyContact: student.emergencyContact || '',
      notes: student.notes || '',
      enrolledAt: student.enrolledAt?.split('T')[0] || ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingStudent(null);
    setFormData(initialFormData);
  };

  // 나이 계산
  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">학생 관리</h1>
          <p className="text-gray-500">{students.length}명의 학생</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 엑셀 내보내기 드롭다운 */}
          <div className="relative group">
            <button
              className="btn-outline flex items-center justify-center gap-2 px-4 py-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              엑셀 내보내기
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <button
                onClick={() => exportAllStudents(students, classes)}
                className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                전체 학생 ({students.length}명)
              </button>
              <button
                onClick={() => exportFilteredStudents(filteredStudents, classes, statusFilter !== 'all' ? STATUS_LABELS[statusFilter] : undefined)}
                className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                현재 필터 ({filteredStudents.length}명)
              </button>
              <div className="border-t border-gray-100">
                <button
                  onClick={() => exportStudentsByStatus(students, classes, 'active')}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  재원 학생 ({statusCounts.active}명)
                </button>
                <button
                  onClick={() => exportStudentsByStatus(students, classes, 'inactive')}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full bg-yellow-500" />
                  휴원 학생 ({statusCounts.inactive}명)
                </button>
                <button
                  onClick={() => exportStudentsByStatus(students, classes, 'withdrawn')}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  퇴원 학생 ({statusCounts.withdrawn}명)
                </button>
              </div>
              <div className="border-t border-gray-100">
                <button
                  onClick={() => exportFullBackup(students, classes, parents)}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  전체 백업 (학생+학부모)
                </button>
              </div>
            </div>
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
      </div>

      {/* 상태 필터 탭 */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            statusFilter === 'all'
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          전체 ({statusCounts.all})
        </button>
        <button
          onClick={() => setStatusFilter('active')}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            statusFilter === 'active'
              ? 'bg-green-500 text-white'
              : 'bg-green-50 text-green-700 hover:bg-green-100'
          }`}
        >
          재원 ({statusCounts.active})
        </button>
        <button
          onClick={() => setStatusFilter('inactive')}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            statusFilter === 'inactive'
              ? 'bg-yellow-500 text-white'
              : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
          }`}
        >
          휴원 ({statusCounts.inactive})
        </button>
        <button
          onClick={() => setStatusFilter('withdrawn')}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            statusFilter === 'withdrawn'
              ? 'bg-red-500 text-white'
              : 'bg-red-50 text-red-700 hover:bg-red-100'
          }`}
        >
          퇴원 ({statusCounts.withdrawn})
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
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
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value as GradeLevel | 'all')}
          className="input-field w-full sm:w-40"
        >
          <option value="all">전체 학년</option>
          {GRADE_OPTIONS.map((grade) => (
            <option key={grade} value={grade}>{grade}</option>
          ))}
        </select>
      </div>

      {/* Students Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">이름</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">상태</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">학년</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">연락처</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">등록 클래스</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">계정</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-gray-500">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStudents.map((student) => {
                const studentClasses = getStudentClasses(student.id);
                const hasAccount = !!student.userId;
                const hasParents = student.parentIds && student.parentIds.length > 0;
                const status = student.status || 'active';

                return (
                  <tr key={student.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => navigate(`/admin/students/${student.id}`)}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                      >
                        {student.profileImage ? (
                          <img
                            src={student.profileImage}
                            alt={student.name}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                            <span className="text-primary font-bold text-sm">{student.name.charAt(0)}</span>
                          </div>
                        )}
                        <div className="text-left">
                          <span className="font-medium text-gray-900 block">{student.name}</span>
                          {student.birthDate && (
                            <span className="text-xs text-gray-500">
                              만 {calculateAge(student.birthDate)}세
                            </span>
                          )}
                        </div>
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => openStatusModal(student)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[status]} hover:opacity-80 transition-opacity`}
                      >
                        {STATUS_LABELS[status]}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      {student.grade ? (
                        <span className="text-gray-700">{student.grade}</span>
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
                          {hasAccount ? '연결됨' : '미연결'}
                        </span>
                        {hasParents && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                            부모 {student.parentIds?.length}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/admin/students/${student.id}`)}
                          className="p-2 text-gray-500 hover:text-primary rounded-lg hover:bg-primary/10"
                          title="상세보기"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
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
                {searchQuery || statusFilter !== 'all' || gradeFilter !== 'all'
                  ? '검색 결과가 없습니다.'
                  : '등록된 학생이 없습니다.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeModal} />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              {editingStudent ? '학생 정보 수정' : '새 학생 추가'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 기본 정보 */}
              <div className="md:col-span-2">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">기본 정보</h3>
              </div>

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
                <label className="text-sm text-gray-500 mb-2 block">생년월일</label>
                <input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-2 block">성별</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'male' | 'female' | '' })}
                  className="input-field"
                >
                  <option value="">선택 안함</option>
                  <option value="male">남</option>
                  <option value="female">여</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-2 block">학년</label>
                <select
                  value={formData.grade}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value as GradeLevel | '' })}
                  className="input-field"
                >
                  <option value="">선택 안함</option>
                  {GRADE_OPTIONS.map((grade) => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-2 block">학교</label>
                <input
                  type="text"
                  value={formData.school}
                  onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                  placeholder="학교명"
                  className="input-field"
                />
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-2 block">입학일</label>
                <input
                  type="date"
                  value={formData.enrolledAt}
                  onChange={(e) => setFormData({ ...formData, enrolledAt: e.target.value })}
                  className="input-field"
                />
              </div>

              {/* 연락처 정보 */}
              <div className="md:col-span-2 mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">연락처 정보</h3>
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-2 block">학생 연락처</label>
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

              <div>
                <label className="text-sm text-gray-500 mb-2 block">긴급연락처</label>
                <input
                  type="tel"
                  value={formData.emergencyContact}
                  onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                  placeholder="010-0000-0000"
                  className="input-field"
                />
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-2 block">주소</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="주소"
                  className="input-field"
                />
              </div>

              {/* 메모 */}
              <div className="md:col-span-2 mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">메모</h3>
              </div>

              <div className="md:col-span-2">
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="특이사항, 알레르기, 주의사항 등"
                  rows={3}
                  className="input-field resize-none"
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

      {/* Status Change Modal */}
      {showStatusModal && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowStatusModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">상태 변경</h2>
            <p className="text-gray-500 mb-6">
              <span className="font-semibold text-gray-900">{selectedStudent.name}</span> 학생의 상태를 변경합니다.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500 mb-2 block">변경할 상태</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['active', 'inactive', 'withdrawn'] as StudentStatus[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => setNewStatus(status)}
                      className={`py-3 rounded-lg text-sm font-medium transition-colors ${
                        newStatus === status
                          ? STATUS_COLORS[status].replace('bg-', 'bg-').replace('-100', '-500') + ' text-white'
                          : STATUS_COLORS[status]
                      }`}
                    >
                      {STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              </div>

              {(newStatus === 'inactive' || newStatus === 'withdrawn') && (
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">
                    {newStatus === 'inactive' ? '휴원' : '퇴원'} 사유
                  </label>
                  <textarea
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="사유를 입력하세요 (선택)"
                    rows={3}
                    className="input-field resize-none"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowStatusModal(false)}
                className="flex-1 btn-outline"
              >
                취소
              </button>
              <button
                onClick={handleStatusChange}
                disabled={isSubmitting}
                className="flex-1 btn-accent disabled:opacity-50"
              >
                {isSubmitting ? '변경 중...' : '변경'}
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
