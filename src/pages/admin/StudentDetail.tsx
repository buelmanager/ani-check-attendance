import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { useStore } from '../../store/useStore';
import { studentService } from '../../services/studentService';
import { attendanceService } from '../../services/attendanceService';
import { consultationService } from '../../services/consultationService';
import { homeworkService } from '../../services/homeworkService';
import { scoreService } from '../../services/scoreService';
import { statisticsService, deduplicateAttendances } from '../../services/statisticsService';
import { parentService } from '../../services/parentService';
import type { Student, StudentStatus, Attendance, Parent } from '../../types';
import type { Consultation, ConsultationType, ConsultationCategory } from '../../types/consultation';
import { CONSULTATION_TYPE_LABELS, CONSULTATION_CATEGORIES } from '../../types/consultation';
import type { Homework } from '../../types/homework';
import { SUBMISSION_STATUS_LABELS, SUBMISSION_STATUS_COLORS } from '../../types/homework';
import type { Exam } from '../../types/score';
import { EXAM_TYPE_LABELS, getGrade, getGradeColor } from '../../types/score';
import { StatCard, BarChart, DonutChart, DonutChartLegend, LineChart } from '../../components/statistics';

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

type TabType = 'info' | 'attendance' | 'statistics' | 'consultation' | 'learning';

interface ConsultationFormData {
  type: ConsultationType;
  category: ConsultationCategory;
  title: string;
  content: string;
  result: string;
  nextAction: string;
  nextDate: string;
}

const initialConsultationForm: ConsultationFormData = {
  type: 'regular',
  category: '학습상담',
  title: '',
  content: '',
  result: '',
  nextAction: '',
  nextDate: ''
};

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { students, classes } = useStore();

  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showConsultationModal, setShowConsultationModal] = useState(false);
  const [newStatus, setNewStatus] = useState<StudentStatus>('active');
  const [statusReason, setStatusReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consultationForm, setConsultationForm] = useState<ConsultationFormData>(initialConsultationForm);
  const [editingConsultation, setEditingConsultation] = useState<Consultation | null>(null);
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [learningSubTab, setLearningSubTab] = useState<'homework' | 'score' | 'progress'>('homework');
  const [allAttendances, setAllAttendances] = useState<Attendance[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [deletingParentId, setDeletingParentId] = useState<string | null>(null);

  // 학생 데이터 로드
  useEffect(() => {
    if (id) {
      const foundStudent = students.find(s => s.id === id);
      if (foundStudent) {
        setStudent(foundStudent);
        setNewStatus(foundStudent.status || 'active');
      }
      setLoading(false);
    }
  }, [id, students]);

  // 출석 데이터 로드
  useEffect(() => {
    if (!id) return;

    const unsubscribe = attendanceService.subscribeAll((allData) => {
      const studentAttendances = allData.filter(a => a.studentId === id);
      studentAttendances.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAllAttendances(studentAttendances);
      setAttendances(studentAttendances.slice(0, 30));
    });

    return () => unsubscribe();
  }, [id]);

  // 상담 데이터 로드
  useEffect(() => {
    if (!id) return;

    const unsubscribe = consultationService.subscribeByStudent(id, (data) => {
      setConsultations(data);
    });

    return () => unsubscribe();
  }, [id]);

  // 숙제 데이터 로드
  useEffect(() => {
    if (!id) return;

    const unsubscribe = homeworkService.subscribeByStudent(id, (data) => {
      setHomeworks(data);
    });

    return () => unsubscribe();
  }, [id]);

  // 성적 데이터 로드
  useEffect(() => {
    if (!id) return;

    const unsubscribe = scoreService.subscribeByStudent(id, (data) => {
      setExams(data);
    });

    return () => unsubscribe();
  }, [id]);

  // 부모 데이터 로드
  useEffect(() => {
    if (!student?.parentIds || student.parentIds.length === 0) {
      setParents([]);
      return;
    }

    const loadParents = async () => {
      try {
        const parentData = await Promise.all(
          student.parentIds.map(parentId => parentService.getById(parentId))
        );
        setParents(parentData.filter((p): p is Parent => p !== null));
      } catch (error) {
        console.error('Error loading parents:', error);
        setParents([]);
      }
    };

    loadParents();
  }, [student?.parentIds]);

  const getStudentClasses = () => {
    return classes.filter(c => c.studentIds.includes(student?.id || ''));
  };

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

  const handleStatusChange = async () => {
    if (!student) return;

    setIsSubmitting(true);
    try {
      await studentService.changeStatus(student.id, newStatus, statusReason || undefined);
      setShowStatusModal(false);
    } catch (error) {
      console.error('Error changing status:', error);
      alert('상태 변경 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 부모 삭제
  const handleDeleteParent = async (parent: Parent) => {
    if (!student) return;

    const confirmMsg = parent.userId
      ? `"${parent.name}" 보호자를 삭제하시겠습니까?\n\n⚠️ 앱 계정도 함께 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`
      : `"${parent.name}" 보호자를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`;

    if (!confirm(confirmMsg)) return;

    setDeletingParentId(parent.id);
    try {
      // 1. 학생의 parentIds에서 제거
      const updatedParentIds = (student.parentIds || []).filter(pid => pid !== parent.id);
      await studentService.update(student.id, { parentIds: updatedParentIds });

      // 2. 부모 문서 및 Auth 삭제
      await parentService.delete(parent.id);

      // 3. 로컬 상태 업데이트
      setParents(prev => prev.filter(p => p.id !== parent.id));

      alert('보호자가 삭제되었습니다.');
    } catch (error) {
      console.error('Error deleting parent:', error);
      alert('보호자 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingParentId(null);
    }
  };

  // 중복 제거된 출석 데이터
  const deduplicatedAttendances = useMemo(() => {
    return deduplicateAttendances(attendances);
  }, [attendances]);

  const calculateAttendanceRate = () => {
    if (deduplicatedAttendances.length === 0) return 0;
    const present = deduplicatedAttendances.filter(a => a.status === 'present').length;
    return Math.round((present / deduplicatedAttendances.length) * 100);
  };

  // 상담 모달 열기
  const openConsultationModal = (consultation?: Consultation) => {
    if (consultation) {
      setEditingConsultation(consultation);
      setConsultationForm({
        type: consultation.type,
        category: consultation.category,
        title: consultation.title,
        content: consultation.content,
        result: consultation.result || '',
        nextAction: consultation.nextAction || '',
        nextDate: consultation.nextDate || ''
      });
    } else {
      setEditingConsultation(null);
      setConsultationForm(initialConsultationForm);
    }
    setShowConsultationModal(true);
  };

  // 상담 저장
  const handleSaveConsultation = async () => {
    if (!student || !consultationForm.title.trim() || !consultationForm.content.trim()) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingConsultation) {
        // undefined 값 제외 (Firestore에서 지원하지 않음)
        const updateData = {
          type: consultationForm.type,
          category: consultationForm.category,
          title: consultationForm.title,
          content: consultationForm.content,
          ...(consultationForm.result && { result: consultationForm.result }),
          ...(consultationForm.nextAction && { nextAction: consultationForm.nextAction }),
          ...(consultationForm.nextDate && { nextDate: consultationForm.nextDate })
        };
        await consultationService.update(editingConsultation.id, updateData);
      } else {
        // undefined 값 제외 (Firestore에서 지원하지 않음)
        const createData = {
          studentId: student.id,
          studentName: student.name,
          counselorId: 'admin', // TODO: 실제 로그인한 관리자 ID
          counselorName: '관리자', // TODO: 실제 로그인한 관리자 이름
          type: consultationForm.type,
          category: consultationForm.category,
          title: consultationForm.title,
          content: consultationForm.content,
          isCompleted: false,
          ...(consultationForm.result && { result: consultationForm.result }),
          ...(consultationForm.nextAction && { nextAction: consultationForm.nextAction }),
          ...(consultationForm.nextDate && { nextDate: consultationForm.nextDate })
        };
        await consultationService.create(createData);
      }
      setShowConsultationModal(false);
      setConsultationForm(initialConsultationForm);
      setEditingConsultation(null);
    } catch (error) {
      console.error('Error saving consultation:', error);
      alert('상담 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 상담 완료 처리
  const handleCompleteConsultation = async (consultation: Consultation) => {
    if (!confirm('이 상담을 완료 처리하시겠습니까?')) return;

    try {
      await consultationService.complete(consultation.id);
    } catch (error) {
      console.error('Error completing consultation:', error);
      alert('상담 완료 처리 중 오류가 발생했습니다.');
    }
  };

  // 상담 삭제
  const handleDeleteConsultation = async (consultation: Consultation) => {
    if (!confirm('이 상담 기록을 삭제하시겠습니까?')) return;

    try {
      await consultationService.delete(consultation.id);
    } catch (error) {
      console.error('Error deleting consultation:', error);
      alert('상담 삭제 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  if (!student) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">학생을 찾을 수 없습니다.</p>
          <button
            onClick={() => navigate('/admin/students')}
            className="btn-primary"
          >
            목록으로 돌아가기
          </button>
        </div>
      </AdminLayout>
    );
  }

  const studentClasses = getStudentClasses();
  const status = student.status || 'active';

  return (
    <AdminLayout>
      {/* 헤더 */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/admin/students')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          학생 목록
        </button>

        {/* 프로필 카드 */}
        <div className="card">
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="flex-shrink-0">
              {student.profileImage ? (
                <img
                  src={student.profileImage}
                  alt={student.name}
                  className="w-24 h-24 rounded-2xl object-cover"
                />
              ) : (
                <div className="w-24 h-24 bg-accent rounded-2xl flex items-center justify-center">
                  <span className="text-primary font-bold text-3xl">{student.name.charAt(0)}</span>
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
                <button
                  onClick={() => setShowStatusModal(true)}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[status]} hover:opacity-80 transition-opacity`}
                >
                  {STATUS_LABELS[status]}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {student.grade && (
                  <div>
                    <span className="text-gray-500">학년</span>
                    <p className="font-medium text-gray-900">{student.grade}</p>
                  </div>
                )}
                {student.birthDate && (
                  <div>
                    <span className="text-gray-500">나이</span>
                    <p className="font-medium text-gray-900">만 {calculateAge(student.birthDate)}세</p>
                  </div>
                )}
                {student.school && (
                  <div>
                    <span className="text-gray-500">학교</span>
                    <p className="font-medium text-gray-900">{student.school}</p>
                  </div>
                )}
                {student.enrolledAt && (
                  <div>
                    <span className="text-gray-500">입학일</span>
                    <p className="font-medium text-gray-900">{new Date(student.enrolledAt).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              {studentClasses.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {studentClasses.map((cls) => (
                    <span
                      key={cls.id}
                      className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm"
                    >
                      {cls.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <div className="text-center px-4 py-3 bg-gray-50 rounded-xl">
                <p className="text-2xl font-bold text-primary">{calculateAttendanceRate()}%</p>
                <p className="text-xs text-gray-500">출석률</p>
              </div>
              <div className="text-center px-4 py-3 bg-gray-50 rounded-xl">
                <p className="text-2xl font-bold text-primary">{consultations.length}</p>
                <p className="text-xs text-gray-500">상담</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { id: 'info', label: '기본 정보' },
          { id: 'attendance', label: '출석 이력' },
          { id: 'statistics', label: '출석 통계' },
          { id: 'consultation', label: `상담 기록 (${consultations.length})` },
          { id: 'learning', label: '학습 관리' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="card">
        {activeTab === 'info' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">연락처 정보</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <span className="text-sm text-gray-500">학생 연락처</span>
                  <p className="font-medium text-gray-900">{student.phone || '-'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <span className="text-sm text-gray-500">긴급연락처</span>
                  <p className="font-medium text-gray-900">{student.emergencyContact || '-'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl md:col-span-2">
                  <span className="text-sm text-gray-500">주소</span>
                  <p className="font-medium text-gray-900">{student.address || '-'}</p>
                </div>
              </div>
            </div>

            {/* 보호자 정보 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">보호자 정보</h3>
              {parents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {parents.map((parent) => (
                    <div key={parent.id} className="p-4 bg-purple-50 rounded-xl border border-purple-100 relative group">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <span className="text-purple-700 font-bold">{parent.name.charAt(0)}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{parent.name}</p>
                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                            {parent.relationType === 'father' ? '아버지' :
                             parent.relationType === 'mother' ? '어머니' : '보호자'}
                          </span>
                        </div>
                        {/* 삭제 버튼 */}
                        <button
                          onClick={() => handleDeleteParent(parent)}
                          disabled={deletingParentId === parent.id}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                          title="보호자 삭제"
                        >
                          {deletingParentId === parent.id ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span className="text-gray-700">{parent.phone || '-'}</span>
                          {parent.phone && (
                            <a
                              href={`tel:${parent.phone}`}
                              className="text-purple-600 hover:text-purple-800"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 3l-8 8m0 0V3m0 8h8" />
                              </svg>
                            </a>
                          )}
                        </div>
                        {parent.userId && (
                          <div className="flex items-center gap-2 text-sm">
                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-green-600 text-xs">앱 계정 연결됨</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 bg-gray-50 rounded-xl text-center">
                  <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-gray-500 mb-1">연결된 보호자가 없습니다</p>
                  <p className="text-sm text-gray-400">엑셀에서 학부모 데이터를 가져오면 자동으로 연결됩니다</p>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">상세 정보</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <span className="text-sm text-gray-500">생년월일</span>
                  <p className="font-medium text-gray-900">
                    {student.birthDate ? new Date(student.birthDate).toLocaleDateString() : '-'}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <span className="text-sm text-gray-500">성별</span>
                  <p className="font-medium text-gray-900">
                    {student.gender === 'male' ? '남' : student.gender === 'female' ? '여' : '-'}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <span className="text-sm text-gray-500">초대 코드</span>
                  <p className="font-medium text-gray-900 font-mono">{student.inviteCode}</p>
                </div>
              </div>
            </div>

            {student.notes && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">메모</h3>
                <div className="p-4 bg-yellow-50 rounded-xl">
                  <p className="text-gray-700 whitespace-pre-wrap">{student.notes}</p>
                </div>
              </div>
            )}

            {student.statusHistory && student.statusHistory.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">상태 변경 이력</h3>
                <div className="space-y-3">
                  {student.statusHistory.slice().reverse().map((history, index) => (
                    <div key={index} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                      <div className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[history.status]}`}>
                        {STATUS_LABELS[history.status]}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-500">
                          {new Date(history.changedAt).toLocaleString()}
                        </p>
                        {history.reason && (
                          <p className="text-gray-700 mt-1">{history.reason}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">계정 연결 상태</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl flex items-center justify-between">
                  <span className="text-gray-600">학생 계정</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    student.userId ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {student.userId ? '연결됨' : '미연결'}
                  </span>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl flex items-center justify-between">
                  <span className="text-gray-600">부모 계정</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    student.parentIds && student.parentIds.length > 0
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {student.parentIds && student.parentIds.length > 0
                      ? `${student.parentIds.length}명 연결됨`
                      : '미연결'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'attendance' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">최근 출석 이력</h3>
            {attendances.length > 0 ? (
              <div className="space-y-2">
                {attendances.map((attendance) => (
                  <div
                    key={attendance.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-gray-900 font-medium">
                        {new Date(attendance.date).toLocaleDateString()}
                      </span>
                      <span className="text-gray-500 text-sm">
                        {classes.find(c => c.id === attendance.classId)?.name || '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {attendance.checkInTime && (
                        <span className="text-sm text-gray-500">{attendance.checkInTime}</span>
                      )}
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        attendance.status === 'present' ? 'bg-green-100 text-green-700' :
                        attendance.status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                        attendance.status === 'absent' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {attendance.status === 'present' ? '출석' :
                         attendance.status === 'late' ? '지각' :
                         attendance.status === 'absent' ? '결석' : '사유결석'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">출석 기록이 없습니다.</p>
            )}
          </div>
        )}

        {activeTab === 'statistics' && (
          <StudentStatisticsTab
            studentId={id || ''}
            studentName={student.name}
            attendances={allAttendances}
            classes={studentClasses}
          />
        )}

        {activeTab === 'consultation' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">상담 기록</h3>
              <button
                onClick={() => openConsultationModal()}
                className="btn-accent flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                상담 등록
              </button>
            </div>

            {consultations.length > 0 ? (
              <div className="space-y-4">
                {consultations.map((consultation) => (
                  <div
                    key={consultation.id}
                    className={`p-4 rounded-xl border-2 ${
                      consultation.isCompleted
                        ? 'bg-gray-50 border-gray-200'
                        : 'bg-white border-blue-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          consultation.isCompleted
                            ? 'bg-gray-200 text-gray-600'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {CONSULTATION_TYPE_LABELS[consultation.type]}
                        </span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                          {consultation.category}
                        </span>
                        {consultation.isCompleted && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                            완료
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {!consultation.isCompleted && (
                          <button
                            onClick={() => handleCompleteConsultation(consultation)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            title="완료 처리"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => openConsultationModal(consultation)}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                          title="수정"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteConsultation(consultation)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                          title="삭제"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <h4 className="font-medium text-gray-900 mb-2">{consultation.title}</h4>
                    <p className="text-gray-600 text-sm mb-3 whitespace-pre-wrap">{consultation.content}</p>

                    {consultation.result && (
                      <div className="mb-2 p-3 bg-green-50 rounded-lg">
                        <p className="text-xs text-green-600 mb-1">조치사항</p>
                        <p className="text-sm text-green-800">{consultation.result}</p>
                      </div>
                    )}

                    {consultation.nextAction && (
                      <div className="mb-2 p-3 bg-yellow-50 rounded-lg">
                        <p className="text-xs text-yellow-600 mb-1">후속 조치</p>
                        <p className="text-sm text-yellow-800">{consultation.nextAction}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-500 mt-3 pt-3 border-t">
                      <span>{consultation.counselorName} · {new Date(consultation.createdAt).toLocaleString()}</span>
                      {consultation.nextDate && (
                        <span className="text-blue-600">
                          다음 상담: {new Date(consultation.nextDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-gray-500 mb-4">등록된 상담 기록이 없습니다.</p>
                <button
                  onClick={() => openConsultationModal()}
                  className="btn-primary"
                >
                  첫 상담 등록하기
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'learning' && (
          <div>
            {/* 서브탭 */}
            <div className="flex gap-2 mb-6 border-b pb-4">
              {[
                { id: 'homework', label: '숙제', count: homeworks.length },
                { id: 'score', label: '성적', count: exams.length },
                { id: 'progress', label: '진도', count: 0 }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setLearningSubTab(tab.id as 'homework' | 'score' | 'progress')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    learningSubTab === tab.id
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {/* 숙제 탭 */}
            {learningSubTab === 'homework' && (
              <div>
                {homeworks.length > 0 ? (
                  <div className="space-y-4">
                    {homeworks.map((homework) => {
                      const submission = homework.submissions.find(s => s.studentId === id);
                      const status = submission?.status || 'pending';
                      const statusColor = SUBMISSION_STATUS_COLORS[status];
                      const isOverdue = new Date(homework.dueDate) < new Date() && status === 'pending';

                      return (
                        <div
                          key={homework.id}
                          className={`p-4 rounded-xl border-2 ${
                            isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm text-gray-500">{homework.className}</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor.bg} ${statusColor.text}`}>
                                  {SUBMISSION_STATUS_LABELS[status]}
                                </span>
                              </div>
                              <h4 className="font-medium text-gray-900">{homework.title}</h4>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                                마감: {new Date(homework.dueDate).toLocaleDateString()}
                              </p>
                              {isOverdue && (
                                <p className="text-xs text-red-500">마감됨</p>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2">{homework.description}</p>
                          {submission?.submittedAt && (
                            <p className="text-xs text-gray-400 mt-2">
                              제출: {new Date(submission.submittedAt).toLocaleString()}
                            </p>
                          )}
                          {submission?.feedback && (
                            <div className="mt-2 p-2 bg-green-50 rounded-lg">
                              <p className="text-xs text-green-600 mb-1">피드백</p>
                              <p className="text-sm text-green-800">{submission.feedback}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <p className="text-gray-500">배정된 숙제가 없습니다.</p>
                  </div>
                )}
              </div>
            )}

            {/* 성적 탭 */}
            {learningSubTab === 'score' && (
              <div>
                {exams.length > 0 ? (
                  <div className="space-y-4">
                    {exams.map((exam) => {
                      const studentScore = exam.scores.find(s => s.studentId === id);
                      if (!studentScore) return null;

                      const grade = getGrade(studentScore.score, exam.maxScore);
                      const gradeColor = getGradeColor(grade);
                      const percentage = Math.round((studentScore.score / exam.maxScore) * 100);

                      return (
                        <div key={exam.id} className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm text-gray-500">{exam.className}</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700`}>
                                  {EXAM_TYPE_LABELS[exam.examType]}
                                </span>
                              </div>
                              <h4 className="font-medium text-gray-900">{exam.examName}</h4>
                              <p className="text-sm text-gray-500">
                                {new Date(exam.examDate).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold text-gray-900">
                                  {studentScore.score}
                                </span>
                                <span className="text-gray-400">/ {exam.maxScore}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-0.5 rounded text-sm font-bold ${gradeColor.bg} ${gradeColor.text}`}>
                                  {grade}
                                </span>
                                <span className="text-sm text-gray-500">({percentage}%)</span>
                              </div>
                              {studentScore.rank && (
                                <p className="text-sm text-gray-400 mt-1">
                                  {studentScore.rank}등 / {exam.scores.length}명
                                </p>
                              )}
                            </div>
                          </div>
                          {studentScore.feedback && (
                            <div className="p-2 bg-blue-50 rounded-lg">
                              <p className="text-xs text-blue-600 mb-1">피드백</p>
                              <p className="text-sm text-blue-800">{studentScore.feedback}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* 성적 통계 요약 */}
                    {exams.length > 0 && (
                      <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                        <h4 className="font-medium text-gray-900 mb-3">성적 요약</h4>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-2xl font-bold text-primary">
                              {Math.round(
                                exams.reduce((sum, exam) => {
                                  const score = exam.scores.find(s => s.studentId === id);
                                  return sum + (score ? (score.score / exam.maxScore) * 100 : 0);
                                }, 0) / exams.length
                              )}%
                            </p>
                            <p className="text-sm text-gray-500">평균 점수</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-green-600">
                              {Math.max(
                                ...exams.map(exam => {
                                  const score = exam.scores.find(s => s.studentId === id);
                                  return score ? Math.round((score.score / exam.maxScore) * 100) : 0;
                                })
                              )}%
                            </p>
                            <p className="text-sm text-gray-500">최고 점수</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-gray-600">{exams.length}</p>
                            <p className="text-sm text-gray-500">응시 횟수</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-gray-500">등록된 성적이 없습니다.</p>
                  </div>
                )}
              </div>
            )}

            {/* 진도 탭 */}
            {learningSubTab === 'progress' && (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <p className="text-gray-500 mb-2">진도 관리는 커리큘럼 설정 후 이용 가능합니다.</p>
                <p className="text-sm text-gray-400">관리자 메뉴에서 반별 커리큘럼을 먼저 설정해주세요.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 상태 변경 모달 */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowStatusModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">상태 변경</h2>
            <p className="text-gray-500 mb-6">
              <span className="font-semibold text-gray-900">{student.name}</span> 학생의 상태를 변경합니다.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500 mb-2 block">변경할 상태</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['active', 'inactive', 'withdrawn'] as StudentStatus[]).map((statusOption) => (
                    <button
                      key={statusOption}
                      onClick={() => setNewStatus(statusOption)}
                      className={`py-3 rounded-lg text-sm font-medium transition-colors ${
                        newStatus === statusOption
                          ? statusOption === 'active' ? 'bg-green-500 text-white' :
                            statusOption === 'inactive' ? 'bg-yellow-500 text-white' :
                            'bg-red-500 text-white'
                          : STATUS_COLORS[statusOption]
                      }`}
                    >
                      {STATUS_LABELS[statusOption]}
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
              <button onClick={() => setShowStatusModal(false)} className="flex-1 btn-outline">
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

      {/* 상담 등록/수정 모달 */}
      {showConsultationModal && student && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowConsultationModal(false)} />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              {editingConsultation ? '상담 수정' : '상담 등록'}
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">상담 유형</label>
                  <select
                    value={consultationForm.type}
                    onChange={(e) => setConsultationForm({ ...consultationForm, type: e.target.value as ConsultationType })}
                    className="input-field"
                  >
                    {Object.entries(CONSULTATION_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">카테고리</label>
                  <select
                    value={consultationForm.category}
                    onChange={(e) => setConsultationForm({ ...consultationForm, category: e.target.value as ConsultationCategory })}
                    className="input-field"
                  >
                    {CONSULTATION_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-2 block">제목 *</label>
                <input
                  type="text"
                  value={consultationForm.title}
                  onChange={(e) => setConsultationForm({ ...consultationForm, title: e.target.value })}
                  placeholder="상담 제목"
                  className="input-field"
                />
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-2 block">상담 내용 *</label>
                <textarea
                  value={consultationForm.content}
                  onChange={(e) => setConsultationForm({ ...consultationForm, content: e.target.value })}
                  placeholder="상담 내용을 상세히 작성해주세요"
                  rows={4}
                  className="input-field resize-none"
                />
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-2 block">조치사항/결과</label>
                <textarea
                  value={consultationForm.result}
                  onChange={(e) => setConsultationForm({ ...consultationForm, result: e.target.value })}
                  placeholder="상담 후 조치사항이나 결과"
                  rows={2}
                  className="input-field resize-none"
                />
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-2 block">후속 조치</label>
                <textarea
                  value={consultationForm.nextAction}
                  onChange={(e) => setConsultationForm({ ...consultationForm, nextAction: e.target.value })}
                  placeholder="추가로 필요한 조치"
                  rows={2}
                  className="input-field resize-none"
                />
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-2 block">다음 상담 예정일</label>
                <input
                  type="date"
                  value={consultationForm.nextDate}
                  onChange={(e) => setConsultationForm({ ...consultationForm, nextDate: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowConsultationModal(false);
                  setConsultationForm(initialConsultationForm);
                  setEditingConsultation(null);
                }}
                className="flex-1 btn-outline"
              >
                취소
              </button>
              <button
                onClick={handleSaveConsultation}
                disabled={isSubmitting}
                className="flex-1 btn-accent disabled:opacity-50"
              >
                {isSubmitting ? '저장 중...' : editingConsultation ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

// 학생 통계 탭 컴포넌트
function StudentStatisticsTab({
  attendances,
  classes
}: {
  studentId: string;
  studentName: string;
  attendances: Attendance[];
  classes: { id: string; name: string }[];
}) {
  const [periodDays, setPeriodDays] = useState(30);

  // 전체 기간 중복 제거된 출석 데이터
  const deduplicatedAttendances = useMemo(() => {
    return deduplicateAttendances(attendances);
  }, [attendances]);

  // 기간 필터링된 출석 데이터 (중복 제거 적용)
  const filteredAttendances = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - periodDays);
    const filtered = deduplicatedAttendances.filter(a => new Date(a.date) >= cutoff);
    return filtered;
  }, [deduplicatedAttendances, periodDays]);

  // 기본 통계 (이미 중복 제거된 데이터 사용)
  const stats = useMemo(() => {
    const total = filteredAttendances.length;
    const present = filteredAttendances.filter(a => a.status === 'present').length;
    const late = filteredAttendances.filter(a => a.status === 'late').length;
    const absent = filteredAttendances.filter(a => a.status === 'absent').length;
    const excused = filteredAttendances.filter(a => a.status === 'excused').length;

    return {
      total,
      present,
      late,
      absent,
      excused,
      attendanceRate: total > 0 ? Math.round(((present + late) / total) * 100) : 0,
      punctualityRate: total > 0 ? Math.round((present / total) * 100) : 0
    };
  }, [filteredAttendances]);

  // 연속 출석/결석 계산
  const streaks = useMemo(() => {
    const sorted = [...attendances].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    let consecutivePresent = 0;
    let consecutiveAbsent = 0;

    for (const a of sorted) {
      if (a.status === 'present' || a.status === 'late') {
        if (consecutiveAbsent === 0) consecutivePresent++;
        else break;
      } else if (a.status === 'absent') {
        if (consecutivePresent === 0) consecutiveAbsent++;
        else break;
      }
    }

    return { consecutivePresent, consecutiveAbsent };
  }, [attendances]);

  // 요일별 통계
  const dayOfWeekStats = useMemo(() => {
    return statisticsService.getDayOfWeekStats(filteredAttendances);
  }, [filteredAttendances]);

  // 주간 출석 추이 (최근 4주)
  const weeklyTrend = useMemo(() => {
    const trends = statisticsService.getAttendanceTrends(attendances, 4);
    return trends.map(t => ({
      label: t.period,
      value: t.rate
    }));
  }, [attendances]);

  // 월별 출석 추이 (최근 6개월)
  const monthlyTrend = useMemo(() => {
    const trends = statisticsService.getAttendanceTrends(attendances, 6);
    return trends.map(t => ({
      label: t.period,
      value: t.rate
    }));
  }, [attendances]);

  // 출석 상태별 도넛 차트 데이터
  const statusDonutData = useMemo(() => [
    { label: '출석', value: stats.present, color: '#22c55e' },
    { label: '지각', value: stats.late, color: '#eab308' },
    { label: '결석', value: stats.absent, color: '#ef4444' },
    { label: '사유결석', value: stats.excused, color: '#3b82f6' }
  ], [stats]);

  // 반별 출석 통계
  const classwiseStats = useMemo(() => {
    return classes.map(cls => {
      const classAttendances = filteredAttendances.filter(a => a.classId === cls.id);
      const total = classAttendances.length;
      const present = classAttendances.filter(a => a.status === 'present').length;
      const late = classAttendances.filter(a => a.status === 'late').length;
      const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

      return {
        className: cls.name,
        total,
        present,
        late,
        absent: classAttendances.filter(a => a.status === 'absent').length,
        rate
      };
    });
  }, [filteredAttendances, classes]);

  if (attendances.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-gray-500">출석 기록이 없어 통계를 표시할 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 기간 필터 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">기간:</span>
        {[
          { value: 7, label: '최근 7일' },
          { value: 30, label: '최근 30일' },
          { value: 90, label: '최근 3개월' },
          { value: 365, label: '최근 1년' }
        ].map(opt => (
          <button
            key={opt.value}
            onClick={() => setPeriodDays(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              periodDays === opt.value
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="출석률"
          value={`${stats.attendanceRate}%`}
          subtitle={`전체 ${stats.total}건`}
          color="accent"
        />
        <StatCard
          title="정시 출석률"
          value={`${stats.punctualityRate}%`}
          subtitle={`출석 ${stats.present}회`}
          color="green"
        />
        <StatCard
          title="연속 출석"
          value={`${streaks.consecutivePresent}일`}
          subtitle={streaks.consecutiveAbsent > 0 ? `연속 결석: ${streaks.consecutiveAbsent}일` : '결석 없음'}
          color={streaks.consecutiveAbsent > 2 ? 'red' : 'blue'}
        />
        <StatCard
          title="지각 + 결석"
          value={stats.late + stats.absent}
          subtitle={`지각 ${stats.late} / 결석 ${stats.absent}`}
          color="yellow"
        />
      </div>

      {/* 출석 현황 분포 */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-gray-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">출석 현황 분포</h3>
          <div className="flex items-center justify-center gap-6">
            <DonutChart
              data={statusDonutData}
              size={140}
              centerValue={`${stats.attendanceRate}%`}
              centerLabel="출석률"
            />
            <DonutChartLegend data={statusDonutData} />
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">요일별 출석 현황</h3>
          <BarChart
            data={dayOfWeekStats.map(d => ({
              label: d.dayName,
              value: d.stats.attendanceRate,
              color: d.stats.attendanceRate >= 90 ? 'bg-green-500' :
                     d.stats.attendanceRate >= 80 ? 'bg-accent' : 'bg-red-500'
            }))}
            maxValue={100}
            height={160}
          />
        </div>
      </div>

      {/* 출석률 추이 */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-gray-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">주간 출석률 추이</h3>
          {weeklyTrend.length > 0 ? (
            <LineChart
              data={weeklyTrend}
              height={160}
              showDots={true}
              showValues={true}
            />
          ) : (
            <p className="text-center text-gray-500 py-8">데이터가 부족합니다.</p>
          )}
        </div>

        <div className="bg-gray-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">월별 출석률 추이</h3>
          {monthlyTrend.length > 0 ? (
            <LineChart
              data={monthlyTrend}
              height={160}
              showDots={true}
              showValues={true}
            />
          ) : (
            <p className="text-center text-gray-500 py-8">데이터가 부족합니다.</p>
          )}
        </div>
      </div>

      {/* 반별 출석 통계 */}
      {classwiseStats.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">반별 출석 현황</h3>
          <div className="grid gap-4">
            {classwiseStats.map((cls, index) => (
              <div key={index} className="bg-white p-4 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{cls.className}</span>
                  <span className={`text-lg font-bold ${
                    cls.rate >= 90 ? 'text-green-500' :
                    cls.rate >= 80 ? 'text-accent' : 'text-red-500'
                  }`}>
                    {cls.rate}%
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                  <span>출석 {cls.present}</span>
                  <span>지각 {cls.late}</span>
                  <span>결석 {cls.absent}</span>
                  <span>총 {cls.total}회</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      cls.rate >= 90 ? 'bg-green-500' :
                      cls.rate >= 80 ? 'bg-accent' : 'bg-red-500'
                    }`}
                    style={{ width: `${cls.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 전체 기간 요약 (중복 제거 적용) */}
      <div className="bg-gray-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">전체 기간 요약</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="bg-white p-4 rounded-xl">
            <p className="text-2xl font-bold text-primary">{deduplicatedAttendances.length}</p>
            <p className="text-sm text-gray-500">총 출석 기록</p>
          </div>
          <div className="bg-white p-4 rounded-xl">
            <p className="text-2xl font-bold text-green-500">
              {deduplicatedAttendances.filter(a => a.status === 'present').length}
            </p>
            <p className="text-sm text-gray-500">총 출석</p>
          </div>
          <div className="bg-white p-4 rounded-xl">
            <p className="text-2xl font-bold text-yellow-500">
              {deduplicatedAttendances.filter(a => a.status === 'late').length}
            </p>
            <p className="text-sm text-gray-500">총 지각</p>
          </div>
          <div className="bg-white p-4 rounded-xl">
            <p className="text-2xl font-bold text-red-500">
              {deduplicatedAttendances.filter(a => a.status === 'absent').length}
            </p>
            <p className="text-sm text-gray-500">총 결석</p>
          </div>
        </div>
      </div>
    </div>
  );
}
