import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { useStore } from '../../store/useStore';
import { studentService } from '../../services/studentService';
import { parentService, RelationType } from '../../services/parentService';
import { exportAllStudents, exportFilteredStudents, exportStudentsByStatus, exportFullBackup, readStudentsFromExcel } from '../../utils/excelExport';
// readParentsFromExcel은 더 이상 사용하지 않음 - 보호자 정보는 학생 데이터에 포함
import { batchDeleteStudents, batchRestoreStudents, RestoreStudentData, RestoreParentData, ParentChildMap } from '../../lib/firebase';
import type { Student, StudentStatus, GradeLevel, Parent } from '../../types';

// 보호자 입력 폼 데이터 타입
interface GuardianFormData {
  name: string;
  phone: string;
  relationType: RelationType;
}

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
  birthDate: string;
  gender: 'male' | 'female' | '';
  school: string;
  grade: GradeLevel | '';
  address: string;
  notes: string;
  enrolledAt: string;
  // 보호자 정보 추가
  guardians: GuardianFormData[];
}

const initialGuardian: GuardianFormData = {
  name: '',
  phone: '',
  relationType: 'mother'
};

const initialFormData: FormData = {
  name: '',
  phone: '',
  birthDate: '',
  gender: '',
  school: '',
  grade: '',
  address: '',
  notes: '',
  enrolledAt: new Date().toISOString().split('T')[0],
  guardians: [{ ...initialGuardian }]
};

export default function AdminStudents() {
  const navigate = useNavigate();
  const { students, classes, updateStudent, deleteStudent } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // SMS 발송 관련 상태
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsTargets, setSmsTargets] = useState<{ students: boolean; guardians: boolean }>({
    students: true,
    guardians: true
  });

  // 삭제 관련 상태
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState<{
    studentName: string;
    step: 'parents' | 'student' | 'done';
  } | null>(null);

  // 일괄 삭제 관련 상태
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState<{
    phase: 'processing' | 'done';
    total: number;
    currentName: string;
    deletedStudents: number;
    deletedParents: number;
    deletedAuth: number;
  } | null>(null);

  // 엑셀 가져오기 관련 상태
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    phase: 'reading' | 'students' | 'parents' | 'linking' | 'done';
    current: number;
    total: number;
    currentName: string;
    studentsDone: number;
    parentsDone: number;
    linkedCount: number;
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    students: {
      total: number;
      success: number;
      linked: number;
      created: number;
      failed: number;
      errors: string[];
    };
    parents: {
      total: number;
      success: number;
      linked: number;
      created: number;
      failed: number;
      errors: string[];
    };
  } | null>(null);

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

  // 자연 정렬 함수 (숫자를 자연스럽게 정렬: 1, 2, 10, 11 순서)
  const naturalSort = (a: string, b: string) => {
    return a.localeCompare(b, 'ko', { numeric: true, sensitivity: 'base' });
  };

  // 필터링된 학생 목록 (자연 정렬 적용)
  const filteredStudents = students
    .filter((s) => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      const matchesGrade = gradeFilter === 'all' || s.grade === gradeFilter;
      return matchesSearch && matchesStatus && matchesGrade;
    })
    .sort((a, b) => naturalSort(a.name, b.name));

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

  // 메인 URL 생성 (초대코드 경로 제거 - 전화번호 인증 방식으로 변경됨)
  const getMainUrl = () => {
    return window.location.origin;
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
      // undefined 값은 Firestore에서 지원하지 않으므로 빈 문자열이면 필드를 포함하지 않음
      const studentData = {
        name: formData.name,
        ...(formData.phone && { phone: formData.phone }),
        ...(formData.birthDate && { birthDate: formData.birthDate }),
        ...(formData.gender && { gender: formData.gender }),
        ...(formData.school && { school: formData.school }),
        ...(formData.grade && { grade: formData.grade }),
        ...(formData.address && { address: formData.address }),
        ...(formData.notes && { notes: formData.notes }),
        ...(formData.enrolledAt && { enrolledAt: formData.enrolledAt })
      };

      if (editingStudent) {
        await updateStudent(editingStudent, studentData);
      } else {
        // 신규 등록: 학생 계정 생성 (전화번호가 있는 경우)
        const result = await studentService.createWithAccount(studentData);
        const studentId = result.studentId;

        // 보호자 등록
        const validGuardians = formData.guardians.filter(g => g.name.trim() && g.phone.trim());
        for (const guardian of validGuardians) {
          const parentResult = await parentService.createWithAccount({
            name: guardian.name,
            phone: guardian.phone,
            studentId,
            relationType: guardian.relationType
          });

          // 학생에 보호자 ID 연결
          if (parentResult.parentId) {
            await studentService.addParent(studentId, parentResult.parentId);
          }
        }

        // 결과 알림
        if (result.error) {
          alert(`학생이 등록되었지만 계정 생성 중 오류가 발생했습니다: ${result.error}`);
        }
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
    const student = students.find(s => s.id === id);
    if (!student) return;

    if (!confirm(`정말 "${student.name}" 학생을 삭제하시겠습니까?\n연결된 부모 계정도 함께 삭제됩니다.`)) return;

    setIsDeleting(true);
    setDeleteProgress({
      studentName: student.name,
      step: 'parents'
    });

    try {
      // 부모 삭제 단계
      await new Promise(resolve => setTimeout(resolve, 300)); // UI 업데이트를 위한 짧은 딜레이

      setDeleteProgress({
        studentName: student.name,
        step: 'student'
      });

      await deleteStudent(id);

      setDeleteProgress({
        studentName: student.name,
        step: 'done'
      });

      // 완료 후 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Error deleting student:', error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
      setDeleteProgress(null);
    }
  };

  // 일괄 삭제 (Cloud Function 사용)
  const handleBulkDelete = async () => {
    if (selectedStudentIds.size === 0) {
      alert('삭제할 학생을 선택해주세요.');
      return;
    }

    const selectedCount = selectedStudentIds.size;
    if (!confirm(`선택한 ${selectedCount}명의 학생을 삭제하시겠습니까?\n연결된 부모 계정도 함께 삭제됩니다.\n\n※ 이 작업은 되돌릴 수 없습니다.`)) return;

    setIsBulkDeleting(true);
    setBulkDeleteProgress({
      phase: 'processing',
      total: selectedCount,
      currentName: '서버에서 학생/부모/Auth 삭제 중...',
      deletedStudents: 0,
      deletedParents: 0,
      deletedAuth: 0,
    });

    const selectedIds = Array.from(selectedStudentIds);

    try {
      // Cloud Function을 통해 일괄 삭제 (서버에서 처리)
      const result = await batchDeleteStudents(selectedIds, true);

      // 완료 상태로 업데이트
      setBulkDeleteProgress({
        phase: 'done',
        total: selectedCount,
        currentName: '삭제 완료!',
        deletedStudents: result.deletedStudents,
        deletedParents: result.deletedParents,
        deletedAuth: result.deletedAuthUsers || 0,
      });

      // 선택 초기화
      setSelectedStudentIds(new Set());

      // 2초 후 모달 닫기
      setTimeout(() => {
        setIsBulkDeleting(false);
        setBulkDeleteProgress(null);
      }, 2000);

    } catch (error) {
      console.error('Error in bulk delete:', error);
      alert('일괄 삭제 중 오류가 발생했습니다. 다시 시도해주세요.');
      setIsBulkDeleting(false);
      setBulkDeleteProgress(null);
    }
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student.id);
    setFormData({
      name: student.name,
      phone: student.phone || '',
      birthDate: student.birthDate || '',
      gender: student.gender || '',
      school: student.school || '',
      grade: student.grade || '',
      address: student.address || '',
      notes: student.notes || '',
      enrolledAt: student.enrolledAt?.split('T')[0] || '',
      guardians: [{ ...initialGuardian }]
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingStudent(null);
    setFormData({ ...initialFormData, guardians: [{ ...initialGuardian }] });
  };

  // 보호자 정보 업데이트
  const updateGuardian = (index: number, field: keyof GuardianFormData, value: string) => {
    const newGuardians = [...formData.guardians];
    newGuardians[index] = { ...newGuardians[index], [field]: value };
    setFormData({ ...formData, guardians: newGuardians });
  };

  // 학생 선택 토글
  const toggleStudentSelection = (studentId: string) => {
    const newSelected = new Set(selectedStudentIds);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudentIds(newSelected);
  };

  // 전체 선택 토글
  const toggleSelectAll = () => {
    if (selectedStudentIds.size === filteredStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(filteredStudents.map(s => s.id)));
    }
  };

  // SMS 발송 모달 열기
  const openSmsModal = () => {
    if (selectedStudentIds.size === 0) {
      alert('로그인 링크를 발송할 학생을 선택해주세요.');
      return;
    }
    setShowSmsModal(true);
  };

  // SMS 발송 (목업)
  const handleSendSms = async () => {
    const selectedStudents = students.filter(s => selectedStudentIds.has(s.id));
    let studentCount = 0;
    let guardianCount = 0;

    for (const student of selectedStudents) {
      if (smsTargets.students && student.phone) {
        studentCount++;
      }
      if (smsTargets.guardians && student.parentIds) {
        guardianCount += student.parentIds.length;
      }
    }

    const totalCount = studentCount + guardianCount;
    const estimatedCost = totalCount * 8.4; // 알리고 기준

    alert(`[목업] SMS 발송 완료!\n\n` +
      `발송 대상:\n` +
      `- 학생: ${studentCount}명\n` +
      `- 보호자: ${guardianCount}명\n` +
      `- 총: ${totalCount}건\n\n` +
      `예상 비용: 약 ${Math.round(estimatedCost)}원\n\n` +
      `(실제 운영 시 SMS API로 발송됩니다)`);

    setShowSmsModal(false);
    setSelectedStudentIds(new Set());
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

  // 엑셀 가져오기 처리 (Cloud Function 사용)
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);
    setImportProgress({
      phase: 'reading',
      current: 0,
      total: 0,
      currentName: '파일 읽는 중...',
      studentsDone: 0,
      parentsDone: 0,
      linkedCount: 0
    });
    setShowImportModal(true);

    try {
      // 학생 데이터만 읽기 (학부모 데이터는 가져오지 않음)
      const studentsData = await readStudentsFromExcel(file);

      const totalStudents = studentsData.length;

      // 학생 데이터가 없으면 오류 표시
      if (totalStudents === 0) {
        setShowImportModal(false);
        setImportProgress(null);
        setIsImporting(false);
        e.target.value = '';
        alert('엑셀 파일에서 학생 데이터를 찾을 수 없습니다.\n\n확인사항:\n1. "이름" 컬럼이 있는지 확인하세요\n2. 학생 이름이 입력되어 있는지 확인하세요\n3. 시트 이름이 "학생목록"인지 확인하세요\n\n※ 엑셀 내보내기로 다운로드한 파일 형식을 참고하세요.');
        return;
      }

      // 진행 상황 업데이트 - 서버로 전송
      setImportProgress({
        phase: 'students',
        current: 0,
        total: totalStudents,
        currentName: '서버에서 학생 생성 중...',
        studentsDone: 0,
        parentsDone: 0,
        linkedCount: 0
      });

      // RestoreStudentData 형식으로 변환 (보호자 정보 포함)
      const restoreStudents: RestoreStudentData[] = studentsData.map(s => ({
        name: s.name,
        phone: s.phone || '',
        birthDate: s.birthDate,
        gender: s.gender as 'male' | 'female' | undefined,
        school: s.school,
        grade: s.grade,
        address: s.address,
        notes: s.notes,
        status: s.status,
        inviteCode: s.inviteCode,
        parentIds: [],
        // 보호자 정보 (엑셀 학생 데이터에서 읽어온 값)
        parentName: s.parentName,
        parentPhone: s.parentPhone
      }));

      // 보호자 정보가 있는 학생 수 계산
      const studentsWithParent = restoreStudents.filter(s => s.parentName || s.parentPhone);
      console.log('[handleImportExcel] 보호자 정보 있는 학생:', studentsWithParent.length);

      // 부모 데이터는 학생 데이터에 포함되어 있음 (parentName, parentPhone)
      // 서버에서 학생 생성 시 보호자도 함께 생성함
      const restoreParents: RestoreParentData[] = [];
      const parentChildMap: ParentChildMap = {};

      console.log('[handleImportExcel] 학생+보호자 정보 복원 (단일 시트)');

      // Cloud Function 호출 (학생 데이터에 보호자 정보 포함)
      const result = await batchRestoreStudents(restoreStudents, restoreParents, parentChildMap);

      // 보호자 정보가 있는 학생 수 (예상 부모 수)
      const expectedParents = studentsWithParent.length;

      // 완료 상태 표시
      setImportProgress({
        phase: 'done',
        current: totalStudents,
        total: totalStudents,
        currentName: '모든 처리 완료!',
        studentsDone: result.createdStudents,
        parentsDone: result.createdParents,
        linkedCount: result.linkedParentStudent || 0
      });

      // 결과 설정 (학생 + 보호자 결과 모두 표시)
      setImportResult({
        students: {
          total: totalStudents,
          success: result.createdStudents,
          linked: result.linkedParentStudent || 0,
          created: result.createdAuthUsers,
          failed: result.errors.filter(e => e.type === 'student').length,
          errors: result.errors.filter(e => e.type === 'student').map(e => `${e.name}: ${e.error}`)
        },
        parents: {
          total: expectedParents,
          success: result.createdParents,
          linked: result.linkedParentStudent || 0,
          created: result.createdParents, // 생성된 부모 Auth 계정
          failed: result.errors.filter(e => e.type === 'parent').length,
          errors: result.errors.filter(e => e.type === 'parent').map(e => `${e.name}: ${e.error}`)
        }
      });

      // 2초 후 결과 모달로 전환
      setTimeout(() => {
        setIsImporting(false);
      }, 2000);

      // 파일 input 초기화
      e.target.value = '';
    } catch (error) {
      console.error('Error importing data:', error);
      alert('엑셀 파일을 읽는 중 오류가 발생했습니다.');
      setShowImportModal(false);
      setImportProgress(null);
      setIsImporting(false);
      e.target.value = '';
    }
  };

  // 가져오기 모달 닫기
  const closeImportModal = () => {
    setShowImportModal(false);
    setImportProgress(null);
    setImportResult(null);
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
          {/* SMS 발송 버튼 */}
          <button
            onClick={openSmsModal}
            className={`btn-outline flex items-center justify-center gap-2 px-4 py-2 ${
              selectedStudentIds.size > 0 ? 'border-blue-500 text-blue-600 hover:bg-blue-50' : ''
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            로그인 링크 발송
            {selectedStudentIds.size > 0 && (
              <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                {selectedStudentIds.size}
              </span>
            )}
          </button>
          {/* 일괄 삭제 버튼 */}
          {selectedStudentIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="btn-outline flex items-center justify-center gap-2 px-4 py-2 border-red-500 text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              선택 삭제
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {selectedStudentIds.size}
              </span>
            </button>
          )}
          {/* 엑셀 내보내기 드롭다운 */}
          <div className="relative group">
            <button
              className="btn-outline flex items-center justify-center gap-2 px-4 py-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              엑셀
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <button
                onClick={() => exportAllStudents(students, classes, parents)}
                className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                전체 학생 ({students.length}명)
              </button>
              <button
                onClick={() => exportFilteredStudents(filteredStudents, classes, statusFilter !== 'all' ? STATUS_LABELS[statusFilter] : undefined, parents)}
                className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                현재 필터 ({filteredStudents.length}명)
              </button>
              <div className="border-t border-gray-100">
                <button
                  onClick={() => exportStudentsByStatus(students, classes, 'active', parents)}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  재원 학생 ({statusCounts.active}명)
                </button>
                <button
                  onClick={() => exportStudentsByStatus(students, classes, 'inactive', parents)}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full bg-yellow-500" />
                  휴원 학생 ({statusCounts.inactive}명)
                </button>
                <button
                  onClick={() => exportStudentsByStatus(students, classes, 'withdrawn', parents)}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  퇴원 학생 ({statusCounts.withdrawn}명)
                </button>
              </div>
              <div className="border-t border-gray-100">
                <button
                  onClick={() => exportFullBackup(students, classes, parents)}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  전체 백업 (학생+학부모)
                </button>
              </div>
              <div className="border-t border-gray-100">
                <label
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  {isImporting ? '가져오는 중...' : '엑셀에서 가져오기'}
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImportExcel}
                    className="hidden"
                    disabled={isImporting}
                  />
                </label>
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
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="학생 검색..."
            className="input-field !pl-11"
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
                <th className="px-4 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.size === filteredStudents.length && filteredStudents.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                  />
                </th>
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
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.has(student.id)}
                        onChange={() => toggleStudentSelection(student.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                      />
                    </td>
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
                <label className="text-sm text-gray-500 mb-2 block">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="학생 이름"
                  className="input-field"
                  required
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
                <label className="text-sm text-gray-500 mb-2 block">주소</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="주소"
                  className="input-field"
                />
              </div>

              {/* 보호자 정보 - 신규 등록 시에만 표시 (1명만) */}
              {!editingStudent && (
                <>
                  <div className="md:col-span-2 mt-4">
                    <h3 className="text-sm font-semibold text-gray-700">보호자 정보</h3>
                    <p className="text-xs text-gray-500 mt-1">보호자 정보를 입력하면 자동으로 계정이 생성됩니다.</p>
                  </div>

                  <div className="md:col-span-2 bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">이름</label>
                        <input
                          type="text"
                          value={formData.guardians[0]?.name || ''}
                          onChange={(e) => updateGuardian(0, 'name', e.target.value)}
                          placeholder="보호자 이름"
                          className="input-field text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">연락처</label>
                        <input
                          type="tel"
                          value={formData.guardians[0]?.phone || ''}
                          onChange={(e) => updateGuardian(0, 'phone', e.target.value)}
                          placeholder="010-0000-0000"
                          className="input-field text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">관계</label>
                        <div className="flex gap-2">
                          {(['father', 'mother', 'guardian'] as RelationType[]).map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => updateGuardian(0, 'relationType', type)}
                              className={`flex-1 py-2 text-xs rounded-lg transition-colors ${
                                formData.guardians[0]?.relationType === type
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {type === 'father' ? '부' : type === 'mother' ? '모' : '보호자'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

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

            <p className="text-xs text-gray-400 mt-4">
              <span className="text-red-500">*</span> 필수 입력 항목
            </p>

            <div className="flex gap-3 mt-4">
              <button onClick={closeModal} className="flex-1 btn-outline">
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.name.trim()}
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
            <h2 className="text-xl font-bold text-gray-900 mb-2">접속 링크</h2>
            <p className="text-gray-500 mb-6">
              <span className="font-semibold text-gray-900">{selectedStudent.name}</span> 학생의 접속 정보입니다.
            </p>

            {/* 접속 링크 */}
            <div className="mb-6">
              <label className="text-sm text-gray-500 mb-2 block">접속 링크</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={getMainUrl()}
                  className="flex-1 px-4 py-3 bg-gray-100 rounded-lg text-sm text-gray-600 truncate"
                />
                <button
                  onClick={() => copyToClipboard(getMainUrl(), 'link')}
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
                이 링크를 학생 또는 학부모에게 전달하세요. 등록된 전화번호로 로그인하면 자동으로 연결됩니다.
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

      {/* SMS 발송 모달 */}
      {showSmsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowSmsModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">로그인 링크 발송</h2>
            <p className="text-gray-500 mb-6">
              선택한 <span className="font-semibold text-gray-900">{selectedStudentIds.size}명</span>의 학생에게 로그인 링크를 발송합니다.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500 mb-2 block">발송 대상</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                    <input
                      type="checkbox"
                      checked={smsTargets.students}
                      onChange={(e) => setSmsTargets({ ...smsTargets, students: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-gray-700 font-medium">학생 본인</span>
                      <p className="text-xs text-gray-500">학생 핸드폰으로 발송</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                    <input
                      type="checkbox"
                      checked={smsTargets.guardians}
                      onChange={(e) => setSmsTargets({ ...smsTargets, guardians: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-gray-700 font-medium">보호자</span>
                      <p className="text-xs text-gray-500">등록된 보호자에게 발송</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-blue-700">
                  <span className="font-semibold">[테스트 모드]</span><br />
                  실제 SMS는 발송되지 않습니다.<br />
                  운영 환경에서는 알리고 API를 통해 발송됩니다.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSmsModal(false)}
                className="flex-1 btn-outline"
              >
                취소
              </button>
              <button
                onClick={handleSendSms}
                disabled={!smsTargets.students && !smsTargets.guardians}
                className="flex-1 btn-accent disabled:opacity-50"
              >
                발송
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 엑셀 가져오기 진행 상황 모달 */}
      {showImportModal && isImporting && importProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {importProgress.phase === 'done' ? '복원 완료!' : '데이터 복원 중...'}
            </h2>
            <p className="text-gray-500 mb-6">
              {importProgress.phase === 'done'
                ? '모든 데이터가 복원되었습니다.'
                : '잠시만 기다려주세요. 창을 닫지 마세요.'}
            </p>

            <div className="space-y-4">
              {/* 진행률 바 */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">
                    {importProgress.phase === 'reading' && '파일 읽는 중...'}
                    {importProgress.phase === 'students' && '서버에서 처리 중...'}
                    {importProgress.phase === 'parents' && '부모 등록 중...'}
                    {importProgress.phase === 'linking' && '부모-자녀 연결 중...'}
                    {importProgress.phase === 'done' && '완료!'}
                  </span>
                  <span className="text-gray-500">
                    {importProgress.phase === 'done' ? '100%' : '처리 중...'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      importProgress.phase === 'done' ? 'bg-green-500' : 'bg-blue-500 animate-pulse'
                    }`}
                    style={{ width: importProgress.phase === 'done' ? '100%' : '60%' }}
                  />
                </div>
              </div>

              {/* 현재 처리 중인 항목 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">
                  {importProgress.phase === 'done' ? '처리 결과:' : '현재 처리 중:'}
                </p>
                <p className="font-medium text-gray-900 truncate">{importProgress.currentName}</p>
              </div>

              {/* 완료된 수 - 학생/부모/연결 분리 표시 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{importProgress.studentsDone}</p>
                  <p className="text-xs text-gray-500">학생 생성</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-purple-600">{importProgress.parentsDone}</p>
                  <p className="text-xs text-gray-500">부모 생성</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{importProgress.linkedCount}</p>
                  <p className="text-xs text-gray-500">연결 완료</p>
                </div>
              </div>

              {/* 로딩/완료 애니메이션 */}
              <div className="flex justify-center">
                {importProgress.phase === 'done' ? (
                  <svg className="h-10 w-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 엑셀 가져오기 결과 모달 */}
      {showImportModal && !isImporting && importResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeImportModal} />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">가져오기 완료</h2>
            <p className="text-gray-500 mb-6">
              엑셀 파일에서 데이터를 가져왔습니다.
            </p>

            <div className="space-y-6">
              {/* 학생 결과 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  학생 ({importResult.students.total}명)
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-green-600">{importResult.students.success}</p>
                    <p className="text-xs text-gray-500">성공</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-blue-600">{importResult.students.linked}</p>
                    <p className="text-xs text-gray-500">계정연결</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-purple-600">{importResult.students.created}</p>
                    <p className="text-xs text-gray-500">계정생성</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-red-600">{importResult.students.failed}</p>
                    <p className="text-xs text-gray-500">실패</p>
                  </div>
                </div>
              </div>

              {/* 학부모 결과 */}
              {importResult.parents.total > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    학부모 ({importResult.parents.total}명)
                  </h3>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-green-600">{importResult.parents.success}</p>
                      <p className="text-xs text-gray-500">성공</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-blue-600">{importResult.parents.linked}</p>
                      <p className="text-xs text-gray-500">계정연결</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-purple-600">{importResult.parents.created}</p>
                      <p className="text-xs text-gray-500">계정생성</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-red-600">{importResult.parents.failed}</p>
                      <p className="text-xs text-gray-500">실패</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 에러 목록 */}
              {(importResult.students.errors.length > 0 || importResult.parents.errors.length > 0) && (
                <div className="bg-yellow-50 rounded-xl p-4">
                  <p className="text-sm font-medium text-yellow-800 mb-2">
                    주의사항 ({importResult.students.errors.length + importResult.parents.errors.length}건)
                  </p>
                  <div className="max-h-32 overflow-y-auto">
                    <ul className="text-xs text-yellow-700 space-y-1">
                      {[...importResult.students.errors, ...importResult.parents.errors].slice(0, 10).map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                      {(importResult.students.errors.length + importResult.parents.errors.length) > 10 && (
                        <li className="text-yellow-600">
                          ... 외 {importResult.students.errors.length + importResult.parents.errors.length - 10}건
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {/* 안내 */}
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-blue-700">
                  <span className="font-semibold">안내:</span> 기존 계정이 있는 경우 자동으로 연결되고, 없는 경우 새 계정이 생성됩니다. 학부모-자녀 관계도 자동으로 복원됩니다.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeImportModal}
                className="w-full btn-primary"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 진행 모달 */}
      {isDeleting && deleteProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full max-w-sm bg-white rounded-2xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">삭제 중...</h2>
            <p className="text-gray-500 mb-6">
              "{deleteProgress.studentName}" 학생을 삭제하고 있습니다.
            </p>

            <div className="space-y-4">
              {/* 단계 표시 */}
              <div className="space-y-3">
                <div className={`flex items-center gap-3 p-3 rounded-lg ${
                  deleteProgress.step === 'parents' ? 'bg-red-50' :
                  deleteProgress.step === 'student' || deleteProgress.step === 'done' ? 'bg-green-50' : 'bg-gray-50'
                }`}>
                  {deleteProgress.step === 'parents' ? (
                    <svg className="animate-spin h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  <span className={`text-sm ${
                    deleteProgress.step === 'parents' ? 'text-red-700 font-medium' : 'text-green-700'
                  }`}>
                    부모 계정 삭제
                  </span>
                </div>

                <div className={`flex items-center gap-3 p-3 rounded-lg ${
                  deleteProgress.step === 'student' ? 'bg-red-50' :
                  deleteProgress.step === 'done' ? 'bg-green-50' : 'bg-gray-50'
                }`}>
                  {deleteProgress.step === 'student' ? (
                    <svg className="animate-spin h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : deleteProgress.step === 'done' ? (
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>
                  )}
                  <span className={`text-sm ${
                    deleteProgress.step === 'student' ? 'text-red-700 font-medium' :
                    deleteProgress.step === 'done' ? 'text-green-700' : 'text-gray-400'
                  }`}>
                    학생 정보 삭제
                  </span>
                </div>
              </div>

              {/* 완료 메시지 */}
              {deleteProgress.step === 'done' && (
                <div className="bg-green-100 rounded-lg p-4 text-center">
                  <svg className="w-8 h-8 text-green-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-green-700 font-medium">삭제 완료!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 일괄 삭제 진행 모달 */}
      {isBulkDeleting && bulkDeleteProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {bulkDeleteProgress.phase === 'done' ? '삭제 완료!' : '일괄 삭제 중...'}
            </h2>
            <p className="text-gray-500 mb-6">
              {bulkDeleteProgress.phase === 'done'
                ? '모든 데이터가 삭제되었습니다.'
                : '잠시만 기다려주세요. 창을 닫지 마세요.'}
            </p>

            <div className="space-y-4">
              {/* 진행률 바 */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">
                    {bulkDeleteProgress.phase === 'done'
                      ? `완료 (${bulkDeleteProgress.total}명)`
                      : `삭제 중 (${bulkDeleteProgress.total}명)`}
                  </span>
                  <span className="text-gray-500">
                    {bulkDeleteProgress.phase === 'done' ? '100%' : '처리 중...'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      bulkDeleteProgress.phase === 'done' ? 'bg-green-500' : 'bg-red-500 animate-pulse'
                    }`}
                    style={{ width: bulkDeleteProgress.phase === 'done' ? '100%' : '60%' }}
                  />
                </div>
              </div>

              {/* 현재 처리 중인 항목 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">
                  {bulkDeleteProgress.phase === 'done' ? '처리 결과:' : '현재 처리 중:'}
                </p>
                <p className="font-medium text-gray-900 truncate">{bulkDeleteProgress.currentName}</p>
              </div>

              {/* 삭제된 수 - 학생/부모/Auth 분리 표시 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{bulkDeleteProgress.deletedStudents}</p>
                  <p className="text-xs text-gray-500">학생 삭제</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-orange-600">{bulkDeleteProgress.deletedParents}</p>
                  <p className="text-xs text-gray-500">부모 삭제</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-purple-600">{bulkDeleteProgress.deletedAuth}</p>
                  <p className="text-xs text-gray-500">Auth 삭제</p>
                </div>
              </div>

              {/* 로딩/완료 애니메이션 */}
              <div className="flex justify-center">
                {bulkDeleteProgress.phase === 'done' ? (
                  <svg className="h-10 w-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="animate-spin h-8 w-8 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
