import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useStore } from '../../store/useStore';
import { paymentService } from '../../services/paymentService';
import { parentService } from '../../services/parentService';
import { notificationService } from '../../services/notificationService';
import type { Payment, PaymentStatus, ClassFee, Class, Student } from '../../types';

// 상태 라벨
const STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: '미납',
  paid: '완납',
  partial: '부분납',
  overdue: '연체'
};

// 상태 색상
const STATUS_COLORS: Record<PaymentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  partial: 'bg-blue-100 text-blue-700',
  overdue: 'bg-red-100 text-red-700'
};

// 탭 타입
type TabType = 'payments' | 'fees';

// 카테고리 타입
type CategoryType = 'tuition' | 'other';

// 연도별 월 목록 생성 (1월~12월 순서)
const getMonthsForYear = (year: number) => {
  const months: { value: string; label: string; year: number; month: number }[] = [];

  for (let month = 1; month <= 12; month++) {
    months.push({
      value: `${year}-${String(month).padStart(2, '0')}`,
      label: `${month}월`,
      year,
      month
    });
  }

  return months;
};

// 연도 옵션 (전년, 현재, 내년)
const getYearOptions = () => {
  const currentYear = new Date().getFullYear();
  return [
    { value: currentYear - 1, label: `${currentYear - 1}` },
    { value: currentYear, label: `${currentYear}` },
    { value: currentYear + 1, label: `${currentYear + 1}` }
  ];
};

export default function AdminPayments() {
  const { students, classes } = useStore();

  // 탭 상태
  const [activeTab, setActiveTab] = useState<TabType>('payments');

  // 연도/월 필터 상태
  const yearOptions = useMemo(() => getYearOptions(), []);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const monthsForYear = useMemo(() => getMonthsForYear(selectedYear), [selectedYear]);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // 납부 관련 상태
  const [payments, setPayments] = useState<Payment[]>([]);
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set());

  // 수업료 설정 관련 상태
  const [classFees, setClassFees] = useState<ClassFee[]>([]);
  const [editingFee, setEditingFee] = useState<string | null>(null);
  const [feeFormData, setFeeFormData] = useState({ monthlyFee: 0, description: '' });

  // 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkCreateModal, setShowBulkCreateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  // 청구서 생성 폼용 연도/월
  const [createFormYear, setCreateFormYear] = useState(new Date().getFullYear());
  const createFormMonths = useMemo(() => {
    // 모든 월 표시 (1~12월)
    const months: { value: string; label: string }[] = [];
    for (let month = 1; month <= 12; month++) {
      months.push({
        value: `${createFormYear}-${String(month).padStart(2, '0')}`,
        label: `${month}월`
      });
    }
    return months;
  }, [createFormYear]);

  // 청구서 생성 폼
  const currentMonth = new Date().getMonth() + 1;
  const [createForm, setCreateForm] = useState({
    classId: '' as string,
    studentId: '',
    amount: '' as string | number,
    category: 'tuition' as CategoryType,
    targetMonth: `${new Date().getFullYear()}-${String(currentMonth).padStart(2, '0')}`,
    description: '',
    dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 10).toISOString().split('T')[0],
    sendPush: true
  });

  // 일괄 청구서 생성 폼용 연도
  const [bulkFormYear, setBulkFormYear] = useState(new Date().getFullYear());
  const bulkFormMonths = useMemo(() => {
    const months: { value: string; label: string }[] = [];
    for (let month = 1; month <= 12; month++) {
      months.push({
        value: `${bulkFormYear}-${String(month).padStart(2, '0')}`,
        label: `${month}월`
      });
    }
    return months;
  }, [bulkFormYear]);

  // 일괄 청구서 생성 폼
  const [bulkCreateForm, setBulkCreateForm] = useState({
    classId: 'all',
    amount: '' as string | number,
    category: 'tuition' as CategoryType,
    targetMonth: `${new Date().getFullYear()}-${String(currentMonth).padStart(2, '0')}`,
    description: '',
    dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 10).toISOString().split('T')[0],
    sendPush: true,
    selectedStudentIds: [] as string[]  // 개별 학생 선택용
  });

  // 학생별 푸시 알림 모달 상태
  const [showPushModal, setShowPushModal] = useState(false);
  const [pushSelectedStudents, setPushSelectedStudents] = useState<Set<string>>(new Set());
  const [pushMessage, setPushMessage] = useState({ title: '', message: '' });
  const [isSendingPush, setIsSendingPush] = useState(false);
  const [pushProgress, setPushProgress] = useState<{ current: number; total: number; currentStudent: string } | null>(null);

  // 납부 처리 폼
  const [paymentForm, setPaymentForm] = useState({
    paidAmount: '' as string | number,
    memo: ''
  });

  // 상태 변경 폼
  const [newStatus, setNewStatus] = useState<PaymentStatus>('pending');

  // 로딩/처리 상태
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBulkCreating, setIsBulkCreating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  // 데이터 구독
  useEffect(() => {
    const unsubPayments = paymentService.subscribe(setPayments);
    const unsubFees = paymentService.subscribeClassFees(setClassFees);

    // 연체 상태 업데이트 (페이지 로드 시)
    paymentService.updateOverdueStatus();

    return () => {
      unsubPayments();
      unsubFees();
    };
  }, []);

  // 모달 열림 시 body 스크롤 방지
  useEffect(() => {
    const isAnyModalOpen = showCreateModal || showBulkCreateModal || showPaymentModal || showStatusModal || showPushModal;
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showCreateModal, showBulkCreateModal, showPaymentModal, showStatusModal, showPushModal]);

  // 설명 자동 생성
  const generateDescription = (category: CategoryType, targetMonth: string, customDesc: string) => {
    if (category === 'tuition' && targetMonth) {
      const [year, month] = targetMonth.split('-');
      return `${year}년 ${parseInt(month)}월 학원비`;
    }
    return customDesc;
  };

  // 필터링된 납부 목록
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesSearch =
        p.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());

      // 연도 필터 (항상 적용)
      const yearPattern = `${selectedYear}년`;
      const matchesYear = p.description.includes(yearPattern) ||
        p.dueDate.startsWith(`${selectedYear}`);

      // 월 필터
      let matchesMonth = true;
      if (selectedMonth !== 'all') {
        // description에서 월 정보 추출 또는 dueDate 기준
        const [year, month] = selectedMonth.split('-');
        const monthPattern = `${year}년 ${parseInt(month)}월`;
        matchesMonth = p.description.includes(monthPattern) ||
          p.dueDate.startsWith(selectedMonth);
      }

      return matchesStatus && matchesSearch && matchesYear && matchesMonth;
    });
  }, [payments, statusFilter, searchQuery, selectedYear, selectedMonth]);

  // 상태별 카운트
  const statusCounts = useMemo(() => ({
    all: payments.length,
    pending: payments.filter(p => p.status === 'pending').length,
    paid: payments.filter(p => p.status === 'paid').length,
    partial: payments.filter(p => p.status === 'partial').length,
    overdue: payments.filter(p => p.status === 'overdue').length
  }), [payments]);

  // 통계 계산 (필터된 데이터 기준)
  const stats = useMemo(() => {
    const totalAmount = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
    const paidAmount = filteredPayments.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
    const unpaidAmount = totalAmount - paidAmount;
    return { totalAmount, paidAmount, unpaidAmount };
  }, [filteredPayments]);

  // 금액 포맷
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);
  };

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // 재원 학생만 필터
  const activeStudents = useMemo(() =>
    students.filter(s => s.status === 'active' || !s.status),
    [students]
  );

  // 클래스별 학생 가져오기
  const getStudentsByClass = (classId: string): Student[] => {
    if (classId === 'all') {
      return activeStudents;
    }
    const cls = classes.find(c => c.id === classId);
    if (!cls) return [];
    return activeStudents.filter(s => cls.studentIds.includes(s.id));
  };

  // 선택된 클래스의 학생 목록
  const studentsInSelectedClass = useMemo(() => {
    if (!createForm.classId || createForm.category !== 'tuition') {
      return activeStudents;
    }
    const cls = classes.find(c => c.id === createForm.classId);
    if (!cls) return activeStudents;
    return activeStudents.filter(s => cls.studentIds.includes(s.id));
  }, [createForm.classId, createForm.category, activeStudents, classes]);

  // 청구서 개별 생성
  const handleCreatePayment = async () => {
    const amount = typeof createForm.amount === 'string' ? parseInt(createForm.amount) || 0 : createForm.amount;
    if (!createForm.studentId) {
      alert('학생을 선택해주세요.');
      return;
    }
    if (!amount || amount <= 0) {
      alert('청구 금액을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const student = students.find(s => s.id === createForm.studentId);
      if (!student) throw new Error('학생을 찾을 수 없습니다.');

      const description = generateDescription(
        createForm.category,
        createForm.targetMonth,
        createForm.description
      );

      const finalDescription = description || createForm.description;

      await paymentService.create({
        studentId: createForm.studentId,
        studentName: student.name,
        amount: amount,
        description: finalDescription,
        dueDate: createForm.dueDate
      });

      // 푸시 알림 전송
      if (createForm.sendPush) {
        try {
          const parents = await parentService.getParentsByStudentId(createForm.studentId);
          const parentUserIds = parents.map(p => p.userId).filter(Boolean) as string[];
          if (parentUserIds.length > 0) {
            // 학부모가 있으면 학부모에게 알림
            await notificationService.notifyParentsOfPayment(
              parentUserIds,
              student.name,
              finalDescription,
              amount,
              createForm.dueDate
            );
          } else if (student.userId) {
            // 학부모가 없으면 학생에게 직접 알림
            await notificationService.create({
              userId: student.userId,
              type: 'announcement',
              title: '수업료 청구서 안내',
              message: `${finalDescription}\n청구금액: ${amount.toLocaleString()}원\n납부기한: ${createForm.dueDate}`,
              isRead: false
            });
          }
        } catch (pushError) {
          console.error('Push notification error:', pushError);
          // 푸시 알림 실패해도 청구서는 생성되었으므로 진행
        }
      }

      setShowCreateModal(false);
      const nowMonth = new Date().getMonth() + 1;
      const nowYear = new Date().getFullYear();
      setCreateFormYear(nowYear);
      setCreateForm({
        classId: '',
        studentId: '',
        amount: '',
        category: 'tuition',
        targetMonth: `${nowYear}-${String(nowMonth).padStart(2, '0')}`,
        description: '',
        dueDate: new Date(nowYear, new Date().getMonth() + 1, 10).toISOString().split('T')[0],
        sendPush: true
      });
    } catch (error) {
      console.error('Error creating payment:', error);
      alert('청구서 생성 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 일괄 청구서 생성
  const handleBulkCreate = async () => {
    const amount = typeof bulkCreateForm.amount === 'string' ? parseInt(bulkCreateForm.amount) || 0 : bulkCreateForm.amount;
    if (!amount || amount <= 0) {
      alert('청구 금액을 입력해주세요.');
      return;
    }

    // 개별 선택된 학생이 있으면 그 학생들만, 없으면 클래스 전체 학생
    const targetStudents = bulkSelectedStudents;
    if (targetStudents.length === 0) {
      alert('대상 학생이 없습니다.');
      return;
    }

    if (!confirm(`${targetStudents.length}명의 학생에게 청구서를 생성하시겠습니까?`)) {
      return;
    }

    setIsBulkCreating(true);
    setBulkProgress({ current: 0, total: targetStudents.length });

    try {
      const finalDescription = generateDescription(
        bulkCreateForm.category,
        bulkCreateForm.targetMonth,
        bulkCreateForm.description
      ) || bulkCreateForm.description;

      const count = await paymentService.createBulk(
        targetStudents.map(s => ({ id: s.id, name: s.name })),
        {
          amount: amount,
          description: finalDescription,
          dueDate: bulkCreateForm.dueDate
        }
      );

      // 푸시 알림 전송
      if (bulkCreateForm.sendPush) {
        try {
          const notifications: Array<{
            parentUserIds: string[];
            studentName: string;
            description: string;
            amount: number;
            dueDate: string;
          }> = [];

          // 학부모가 없는 학생들에게 직접 보낼 알림
          const studentDirectNotifications: Array<{
            studentUserId: string;
            studentName: string;
          }> = [];

          for (const student of targetStudents) {
            const parents = await parentService.getParentsByStudentId(student.id);
            const parentUserIds = parents.map(p => p.userId).filter(Boolean) as string[];
            if (parentUserIds.length > 0) {
              // 학부모가 있으면 학부모에게 알림
              notifications.push({
                parentUserIds,
                studentName: student.name,
                description: finalDescription,
                amount,
                dueDate: bulkCreateForm.dueDate
              });
            } else if (student.userId) {
              // 학부모가 없으면 학생에게 직접 알림
              studentDirectNotifications.push({
                studentUserId: student.userId,
                studentName: student.name
              });
            }
          }

          if (notifications.length > 0) {
            await notificationService.notifyBulkPayments(notifications);
          }

          // 학부모 없는 학생들에게 직접 알림 전송
          for (const item of studentDirectNotifications) {
            await notificationService.create({
              userId: item.studentUserId,
              type: 'announcement',
              title: '수업료 청구서 안내',
              message: `${finalDescription}\n청구금액: ${amount.toLocaleString()}원\n납부기한: ${bulkCreateForm.dueDate}`,
              isRead: false
            });
          }
        } catch (pushError) {
          console.error('Push notification error:', pushError);
        }
      }

      setBulkProgress({ current: count, total: targetStudents.length });
      alert(`${count}건의 청구서가 생성되었습니다.${bulkCreateForm.sendPush ? ' (알림 전송됨)' : ''}`);
      setShowBulkCreateModal(false);
    } catch (error) {
      console.error('Error bulk creating payments:', error);
      alert('청구서 일괄 생성 중 오류가 발생했습니다.');
    } finally {
      setIsBulkCreating(false);
      setBulkProgress(null);
    }
  };

  // 납부 완료 처리
  const handleMarkAsPaid = async () => {
    if (!selectedPayment) return;

    const paidAmount = typeof paymentForm.paidAmount === 'string'
      ? parseInt(paymentForm.paidAmount) || 0
      : paymentForm.paidAmount;

    if (!paidAmount || paidAmount <= 0) {
      alert('납부 금액을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 기존 납부액에 새로운 납부액 추가
      const newTotalPaid = (selectedPayment.paidAmount || 0) + paidAmount;
      await paymentService.markAsPaid(
        selectedPayment.id,
        newTotalPaid,
        paymentForm.memo || undefined
      );
      setShowPaymentModal(false);
      setSelectedPayment(null);
      setPaymentForm({ paidAmount: '', memo: '' });
    } catch (error) {
      console.error('Error marking payment:', error);
      alert('납부 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 상태 변경 처리
  const handleStatusChange = async () => {
    if (!selectedPayment) return;

    setIsSubmitting(true);
    try {
      await paymentService.update(selectedPayment.id, { status: newStatus });
      setShowStatusModal(false);
      setSelectedPayment(null);
    } catch (error) {
      console.error('Error changing status:', error);
      alert('상태 변경 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 납부 취소
  const handleCancelPayment = async (id: string) => {
    if (!confirm('납부를 취소하시겠습니까?')) return;

    try {
      await paymentService.cancelPayment(id);
    } catch (error) {
      console.error('Error canceling payment:', error);
      alert('납부 취소 중 오류가 발생했습니다.');
    }
  };

  // 청구서 삭제
  const handleDeletePayment = async (id: string) => {
    if (!confirm('청구서를 삭제하시겠습니까?')) return;

    try {
      await paymentService.delete(id);
    } catch (error) {
      console.error('Error deleting payment:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // 수업료 설정 저장
  const handleSaveClassFee = async (cls: Class) => {
    try {
      await paymentService.setClassFee(
        cls.id,
        cls.name,
        feeFormData.monthlyFee,
        feeFormData.description || undefined
      );
      setEditingFee(null);
      setFeeFormData({ monthlyFee: 0, description: '' });
    } catch (error) {
      console.error('Error saving class fee:', error);
      alert('수업료 설정 저장 중 오류가 발생했습니다.');
    }
  };

  // 수업료 설정 삭제
  const handleDeleteClassFee = async (feeId: string) => {
    if (!confirm('수업료 설정을 삭제하시겠습니까?')) return;

    try {
      await paymentService.deleteClassFee(feeId);
    } catch (error) {
      console.error('Error deleting class fee:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // 납부 처리 모달 열기
  const openPaymentModal = (payment: Payment) => {
    setSelectedPayment(payment);
    const remaining = payment.amount - (payment.paidAmount || 0);
    setPaymentForm({
      paidAmount: remaining > 0 ? remaining : '',
      memo: ''
    });
    setShowPaymentModal(true);
  };

  // 상태 변경 모달 열기
  const openStatusModal = (payment: Payment) => {
    setSelectedPayment(payment);
    setNewStatus(payment.status);
    setShowStatusModal(true);
  };

  // 수업료 편집 시작
  const startEditingFee = (cls: Class) => {
    const existingFee = classFees.find(f => f.classId === cls.id);
    setEditingFee(cls.id);
    setFeeFormData({
      monthlyFee: existingFee?.monthlyFee || 0,
      description: existingFee?.description || ''
    });
  };

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedPayments.size === filteredPayments.length) {
      setSelectedPayments(new Set());
    } else {
      setSelectedPayments(new Set(filteredPayments.map(p => p.id)));
    }
  };

  // 개별 선택
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedPayments);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedPayments(newSelected);
  };

  // 선택된 항목 일괄 삭제
  const handleBulkDelete = async () => {
    if (selectedPayments.size === 0) return;

    if (!confirm(`${selectedPayments.size}건의 청구서를 삭제하시겠습니까?`)) return;

    try {
      await Promise.all(
        Array.from(selectedPayments).map(id => paymentService.delete(id))
      );
      setSelectedPayments(new Set());
    } catch (error) {
      console.error('Error bulk deleting:', error);
      alert('일괄 삭제 중 오류가 발생했습니다.');
    }
  };

  // 학생별 푸시 알림 전송
  const handleSendPushToStudents = async () => {
    if (pushSelectedStudents.size === 0) {
      alert('알림을 보낼 학생을 선택해주세요.');
      return;
    }
    if (!pushMessage.title.trim() || !pushMessage.message.trim()) {
      alert('제목과 메시지를 입력해주세요.');
      return;
    }

    setIsSendingPush(true);
    const studentIds = Array.from(pushSelectedStudents);
    setPushProgress({ current: 0, total: studentIds.length, currentStudent: '' });

    try {
      let sentCount = 0;
      for (let i = 0; i < studentIds.length; i++) {
        const studentId = studentIds[i];
        const student = students.find(s => s.id === studentId);
        if (!student) continue;

        setPushProgress({ current: i + 1, total: studentIds.length, currentStudent: student.name });

        const parents = await parentService.getParentsByStudentId(studentId);
        const parentUserIds = parents.map(p => p.userId).filter(Boolean) as string[];

        if (parentUserIds.length > 0) {
          for (const userId of parentUserIds) {
            await notificationService.create({
              userId,
              type: 'announcement',
              title: pushMessage.title,
              message: `[${student.name}] ${pushMessage.message}`,
              isRead: false
            });
          }
          sentCount++;
        }
      }

      alert(`${sentCount}명의 학부모에게 알림이 전송되었습니다.`);
      setShowPushModal(false);
      setPushSelectedStudents(new Set());
      setPushMessage({ title: '', message: '' });
    } catch (error) {
      console.error('Error sending push:', error);
      alert('알림 전송 중 오류가 발생했습니다.');
    } finally {
      setIsSendingPush(false);
      setPushProgress(null);
    }
  };

  // 일괄 청구 시 선택된 학생들
  const bulkSelectedStudents = useMemo(() => {
    if (bulkCreateForm.selectedStudentIds.length > 0) {
      return activeStudents.filter(s => bulkCreateForm.selectedStudentIds.includes(s.id));
    }
    return getStudentsByClass(bulkCreateForm.classId);
  }, [bulkCreateForm.selectedStudentIds, bulkCreateForm.classId, activeStudents]);

  // 학원비 카테고리일 때 클래스 선택 시 수업료 자동 적용
  const handleBulkClassChange = (classId: string) => {
    const fee = classId !== 'all' ? classFees.find(f => f.classId === classId) : null;
    setBulkCreateForm(prev => ({
      ...prev,
      classId,
      amount: fee ? fee.monthlyFee : prev.amount,
      selectedStudentIds: []  // 클래스 변경 시 개별 선택 초기화
    }));
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">납부 관리</h1>
            <p className="text-gray-500 mt-1">수업료 설정 및 납부 현황을 관리합니다</p>
          </div>
        </div>

        {/* 탭 */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-6">
            <button
              onClick={() => setActiveTab('payments')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'payments'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              청구서 관리
            </button>
            <button
              onClick={() => setActiveTab('fees')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'fees'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              수업료 설정
            </button>
          </nav>
        </div>

        {/* 청구서 관리 탭 */}
        {activeTab === 'payments' && (
          <>
            {/* 연도 선택 */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                {yearOptions.map((y) => (
                  <button
                    key={y.value}
                    onClick={() => {
                      setSelectedYear(y.value);
                      setSelectedMonth('all');
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                      selectedYear === y.value
                        ? 'bg-white text-accent shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {y.label}
                  </button>
                ))}
              </div>

              {/* 월 선택 탭 */}
              <div className="flex gap-2 overflow-x-auto pb-2 flex-1">
                <button
                  onClick={() => setSelectedMonth('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedMonth === 'all'
                      ? 'bg-accent text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  전체
                </button>
                {monthsForYear.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setSelectedMonth(m.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      selectedMonth === m.value
                        ? 'bg-accent text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 통계 카드 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">
                  {selectedMonth === 'all'
                    ? `${selectedYear}년 청구액`
                    : `${selectedYear}년 ${monthsForYear.find(m => m.value === selectedMonth)?.label || ''} 청구액`}
                </div>
                <div className="text-xl font-bold text-gray-900">{formatCurrency(stats.totalAmount)}</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">납부 완료</div>
                <div className="text-xl font-bold text-green-600">{formatCurrency(stats.paidAmount)}</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">미납액</div>
                <div className="text-xl font-bold text-red-600">{formatCurrency(stats.unpaidAmount)}</div>
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                청구서 생성
              </button>
              <button
                onClick={() => setShowBulkCreateModal(true)}
                className="btn-outline flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                일괄 청구서 생성
              </button>
              {selectedPayments.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="btn-outline text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  선택 삭제 ({selectedPayments.size})
                </button>
              )}
              <button
                onClick={() => setShowPushModal(true)}
                className="btn-outline flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                학부모 알림 전송
              </button>
            </div>

            {/* 필터 */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* 상태 필터 탭 */}
              <div className="flex flex-wrap gap-2">
                {(['all', 'pending', 'partial', 'overdue', 'paid'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      statusFilter === status
                        ? 'bg-accent text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'all' ? '전체' : STATUS_LABELS[status]}
                    <span className="ml-1.5 text-xs">
                      ({status === 'all' ? statusCounts.all : statusCounts[status]})
                    </span>
                  </button>
                ))}
              </div>

              {/* 검색 */}
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="학생명 또는 설명으로 검색..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  />
                  <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* 납부 목록 테이블 */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedPayments.size === filteredPayments.length && filteredPayments.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 text-accent rounded border-gray-300 focus:ring-accent"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">학생</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">설명</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">청구액</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">납부액</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">납부기한</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">상태</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">작업</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                          {payments.length === 0 ? '청구서가 없습니다.' : '검색 결과가 없습니다.'}
                        </td>
                      </tr>
                    ) : (
                      filteredPayments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedPayments.has(payment.id)}
                              onChange={() => toggleSelect(payment.id)}
                              className="w-4 h-4 text-accent rounded border-gray-300 focus:ring-accent"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-900">{payment.studentName}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{payment.description}</td>
                          <td className="px-4 py-3 text-right font-medium">{formatCurrency(payment.amount)}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(payment.paidAmount || 0)}</td>
                          <td className="px-4 py-3 text-gray-600">{formatDate(payment.dueDate)}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <button
                                onClick={() => openStatusModal(payment)}
                                className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[payment.status]} hover:opacity-80 transition-opacity`}
                              >
                                {STATUS_LABELS[payment.status]}
                              </button>
                              {payment.confirmationRequested && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                  </svg>
                                  확인요청
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              {payment.status !== 'paid' && (
                                <button
                                  onClick={() => openPaymentModal(payment)}
                                  className={`p-1.5 rounded-lg ${payment.confirmationRequested ? 'text-orange-600 hover:bg-orange-50 animate-pulse' : 'text-green-600 hover:bg-green-50'}`}
                                  title={payment.confirmationRequested ? '확인 요청됨 - 납부 처리' : '납부 처리'}
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                              )}
                              {payment.status === 'paid' && (
                                <button
                                  onClick={() => handleCancelPayment(payment.id)}
                                  className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg"
                                  title="납부 취소"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                  </svg>
                                </button>
                              )}
                              <button
                                onClick={() => handleDeletePayment(payment.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                                title="삭제"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* 수업료 설정 탭 */}
        {activeTab === 'fees' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">클래스별 수업료 설정</h3>
              <p className="text-sm text-gray-500 mt-1">각 클래스의 월 수업료를 설정하면 일괄 청구서 생성 시 자동으로 적용됩니다.</p>
            </div>
            <div className="divide-y divide-gray-100">
              {classes.length === 0 ? (
                <div className="px-4 py-12 text-center text-gray-500">
                  등록된 클래스가 없습니다.
                </div>
              ) : (
                classes.map((cls) => {
                  const existingFee = classFees.find(f => f.classId === cls.id);
                  const isEditing = editingFee === cls.id;

                  return (
                    <div key={cls.id} className="px-4 py-4 flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{cls.name}</div>
                        <div className="text-sm text-gray-500">
                          {cls.schedule} · 학생 {cls.studentIds.length}명
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={feeFormData.monthlyFee}
                              onChange={(e) => setFeeFormData({ ...feeFormData, monthlyFee: parseInt(e.target.value) || 0 })}
                              placeholder="월 수업료"
                              className="w-32 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                            />
                            <input
                              type="text"
                              value={feeFormData.description}
                              onChange={(e) => setFeeFormData({ ...feeFormData, description: e.target.value })}
                              placeholder="설명 (선택)"
                              className="w-40 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                            />
                          </div>
                          <button
                            onClick={() => handleSaveClassFee(cls)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              setEditingFee(null);
                              setFeeFormData({ monthlyFee: 0, description: '' });
                            }}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          {existingFee ? (
                            <>
                              <div className="text-right">
                                <div className="font-medium text-gray-900">{formatCurrency(existingFee.monthlyFee)}</div>
                                {existingFee.description && (
                                  <div className="text-xs text-gray-500">{existingFee.description}</div>
                                )}
                              </div>
                              <button
                                onClick={() => startEditingFee(cls)}
                                className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteClassFee(existingFee.id)}
                                className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => startEditingFee(cls)}
                              className="text-sm text-accent hover:text-accent/80"
                            >
                              + 수업료 설정
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* 청구서 개별 생성 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">청구서 생성</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, category: 'tuition', classId: '', studentId: '', amount: '' })}
                    className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${
                      createForm.category === 'tuition'
                        ? 'bg-accent text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    학원비
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, category: 'other', classId: '', studentId: '', amount: '' })}
                    className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${
                      createForm.category === 'other'
                        ? 'bg-accent text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    기타
                  </button>
                </div>
              </div>

              {createForm.category === 'tuition' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">클래스 선택</label>
                    <select
                      value={createForm.classId}
                      onChange={(e) => {
                        const classId = e.target.value;
                        const fee = classFees.find(f => f.classId === classId);
                        setCreateForm({
                          ...createForm,
                          classId,
                          studentId: '',
                          amount: fee ? fee.monthlyFee : ''
                        });
                      }}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent"
                    >
                      <option value="">클래스를 선택하세요</option>
                      {classes.map((cls) => {
                        const fee = classFees.find(f => f.classId === cls.id);
                        return (
                          <option key={cls.id} value={cls.id}>
                            {cls.name} {fee ? `(${formatCurrency(fee.monthlyFee)})` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">대상 월</label>
                    <div className="flex gap-2">
                      <select
                        value={createFormYear}
                        onChange={(e) => {
                          const newYear = parseInt(e.target.value);
                          setCreateFormYear(newYear);
                          const currentM = parseInt(createForm.targetMonth.split('-')[1]);
                          setCreateForm({ ...createForm, targetMonth: `${newYear}-${String(currentM).padStart(2, '0')}` });
                        }}
                        className="w-28 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      >
                        {yearOptions.map((y) => (
                          <option key={y.value} value={y.value}>{y.label}년</option>
                        ))}
                      </select>
                      <select
                        value={createForm.targetMonth}
                        onChange={(e) => setCreateForm({ ...createForm, targetMonth: e.target.value })}
                        className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      >
                        {createFormMonths.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {createForm.category === 'other' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                  <input
                    type="text"
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent"
                    placeholder="예: 재료비, 교재비 등"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">학생 선택</label>
                <select
                  value={createForm.studentId}
                  onChange={(e) => setCreateForm({ ...createForm, studentId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent"
                >
                  <option value="">학생을 선택하세요</option>
                  {studentsInSelectedClass.map((student) => (
                    <option key={student.id} value={student.id}>{student.name}</option>
                  ))}
                </select>
                {createForm.category === 'tuition' && createForm.classId && (
                  <p className="text-xs text-gray-500 mt-1">
                    선택한 클래스의 학생 {studentsInSelectedClass.length}명
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">청구 금액</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={createForm.amount}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setCreateForm({ ...createForm, amount: value });
                  }}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  placeholder="금액을 입력하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">납부 기한</label>
                <input
                  type="date"
                  value={createForm.dueDate}
                  onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>

              {/* 푸시 알림 옵션 */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createForm.sendPush}
                    onChange={(e) => setCreateForm({ ...createForm, sendPush: e.target.checked })}
                    className="w-4 h-4 text-accent rounded border-gray-300 focus:ring-accent"
                  />
                  <span className="text-sm text-gray-700">학부모에게 푸시 알림 전송</span>
                </label>
              </div>

              {/* 미리보기 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-sm text-gray-500 mb-1">생성될 청구서</div>
                <div className="font-medium text-gray-900">
                  {generateDescription(createForm.category, createForm.targetMonth, createForm.description) || '(설명 없음)'}
                </div>
                {createForm.amount && (
                  <div className="text-sm text-gray-600 mt-1">
                    금액: {formatCurrency(typeof createForm.amount === 'string' ? parseInt(createForm.amount) || 0 : createForm.amount)}
                  </div>
                )}
                {createForm.sendPush && (
                  <div className="text-sm text-accent mt-1 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    알림 전송됨
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  const nowMonth = new Date().getMonth() + 1;
                  const nowYear = new Date().getFullYear();
                  setCreateFormYear(nowYear);
                  setCreateForm({
                    classId: '',
                    studentId: '',
                    amount: '',
                    category: 'tuition',
                    targetMonth: `${nowYear}-${String(nowMonth).padStart(2, '0')}`,
                    description: '',
                    dueDate: new Date(nowYear, new Date().getMonth() + 1, 10).toISOString().split('T')[0],
                    sendPush: true
                  });
                }}
                className="flex-1 btn-outline"
              >
                취소
              </button>
              <button
                onClick={handleCreatePayment}
                disabled={isSubmitting}
                className="flex-1 btn-primary"
              >
                {isSubmitting ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 일괄 청구서 생성 모달 */}
      {showBulkCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">일괄 청구서 생성</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkCreateForm({ ...bulkCreateForm, category: 'tuition' })}
                    className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${
                      bulkCreateForm.category === 'tuition'
                        ? 'bg-accent text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    학원비
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkCreateForm({ ...bulkCreateForm, category: 'other' })}
                    className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${
                      bulkCreateForm.category === 'other'
                        ? 'bg-accent text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    기타
                  </button>
                </div>
              </div>

              {bulkCreateForm.category === 'tuition' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">클래스 선택</label>
                    <select
                      value={bulkCreateForm.classId}
                      onChange={(e) => handleBulkClassChange(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent"
                    >
                      <option value="all">전체 학생 ({activeStudents.length}명)</option>
                      {classes.map((cls) => {
                        const fee = classFees.find(f => f.classId === cls.id);
                        const studentCount = cls.studentIds.filter(id => activeStudents.some(s => s.id === id)).length;
                        return (
                          <option key={cls.id} value={cls.id}>
                            {cls.name} ({studentCount}명) {fee ? `- ${formatCurrency(fee.monthlyFee)}` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">대상 월</label>
                  <div className="flex gap-2">
                    <select
                      value={bulkFormYear}
                      onChange={(e) => {
                        const newYear = parseInt(e.target.value);
                        setBulkFormYear(newYear);
                        const currentM = parseInt(bulkCreateForm.targetMonth.split('-')[1]);
                        setBulkCreateForm({ ...bulkCreateForm, targetMonth: `${newYear}-${String(currentM).padStart(2, '0')}` });
                      }}
                      className="w-28 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent"
                    >
                      {yearOptions.map((y) => (
                        <option key={y.value} value={y.value}>{y.label}년</option>
                      ))}
                    </select>
                    <select
                      value={bulkCreateForm.targetMonth}
                      onChange={(e) => setBulkCreateForm({ ...bulkCreateForm, targetMonth: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent"
                    >
                      {bulkFormMonths.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  </div>
                </>
              )}

              {bulkCreateForm.category === 'other' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">대상 클래스</label>
                  <select
                    value={bulkCreateForm.classId}
                    onChange={(e) => handleBulkClassChange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  >
                    <option value="all">전체 학생 ({activeStudents.length}명)</option>
                    {classes.map((cls) => {
                      const studentCount = cls.studentIds.filter(id => activeStudents.some(s => s.id === id)).length;
                      return (
                        <option key={cls.id} value={cls.id}>
                          {cls.name} ({studentCount}명)
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {bulkCreateForm.category === 'other' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                  <input
                    type="text"
                    value={bulkCreateForm.description}
                    onChange={(e) => setBulkCreateForm({ ...bulkCreateForm, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent"
                    placeholder="예: 재료비, 교재비 등"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">청구 금액</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={bulkCreateForm.amount}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setBulkCreateForm({ ...bulkCreateForm, amount: value });
                  }}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  placeholder="금액을 입력하세요"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">납부 기한</label>
                <input
                  type="date"
                  value={bulkCreateForm.dueDate}
                  onChange={(e) => setBulkCreateForm({ ...bulkCreateForm, dueDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>

              {/* 푸시 알림 옵션 */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkCreateForm.sendPush}
                    onChange={(e) => setBulkCreateForm({ ...bulkCreateForm, sendPush: e.target.checked })}
                    className="w-4 h-4 text-accent rounded border-gray-300 focus:ring-accent"
                  />
                  <span className="text-sm text-gray-700">학부모에게 푸시 알림 전송</span>
                </label>
              </div>

              {/* 학생 개별 선택 (선택 사항) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">학생 개별 선택 (선택 사항)</label>
                  {bulkCreateForm.selectedStudentIds.length > 0 && (
                    <button
                      onClick={() => setBulkCreateForm({ ...bulkCreateForm, selectedStudentIds: [] })}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      선택 해제
                    </button>
                  )}
                </div>
                <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-xl p-2">
                  {getStudentsByClass(bulkCreateForm.classId).map((student) => (
                    <label key={student.id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bulkCreateForm.selectedStudentIds.includes(student.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBulkCreateForm({
                              ...bulkCreateForm,
                              selectedStudentIds: [...bulkCreateForm.selectedStudentIds, student.id]
                            });
                          } else {
                            setBulkCreateForm({
                              ...bulkCreateForm,
                              selectedStudentIds: bulkCreateForm.selectedStudentIds.filter(id => id !== student.id)
                            });
                          }
                        }}
                        className="w-4 h-4 text-accent rounded border-gray-300 focus:ring-accent"
                      />
                      <span className="text-sm text-gray-700">{student.name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {bulkCreateForm.selectedStudentIds.length > 0
                    ? `${bulkCreateForm.selectedStudentIds.length}명 선택됨`
                    : `전체 ${getStudentsByClass(bulkCreateForm.classId).length}명에게 청구됩니다 (개별 선택하지 않으면 전체)`}
                </p>
              </div>

              {/* 미리보기 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-sm text-gray-500 mb-2">생성될 청구서</div>
                <div className="font-medium text-gray-900 mb-2">
                  {generateDescription(bulkCreateForm.category, bulkCreateForm.targetMonth, bulkCreateForm.description) || '(설명 없음)'}
                </div>
                <div className="text-lg font-bold text-gray-900">
                  {bulkSelectedStudents.length}명 × {formatCurrency(typeof bulkCreateForm.amount === 'string' ? parseInt(bulkCreateForm.amount) || 0 : bulkCreateForm.amount)}
                </div>
                <div className="text-sm text-gray-600">
                  = {formatCurrency(bulkSelectedStudents.length * (typeof bulkCreateForm.amount === 'string' ? parseInt(bulkCreateForm.amount) || 0 : bulkCreateForm.amount))}
                </div>
                {bulkCreateForm.sendPush && (
                  <div className="text-sm text-accent mt-2 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    알림 전송됨
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowBulkCreateModal(false);
                  const nowMonth = new Date().getMonth() + 1;
                  const nowYear = new Date().getFullYear();
                  setBulkFormYear(nowYear);
                  setBulkCreateForm({
                    classId: 'all',
                    amount: '',
                    category: 'tuition',
                    targetMonth: `${nowYear}-${String(nowMonth).padStart(2, '0')}`,
                    description: '',
                    dueDate: new Date(nowYear, new Date().getMonth() + 1, 10).toISOString().split('T')[0],
                    sendPush: true,
                    selectedStudentIds: []
                  });
                }}
                disabled={isBulkCreating}
                className="flex-1 btn-outline"
              >
                취소
              </button>
              <button
                onClick={handleBulkCreate}
                disabled={isBulkCreating}
                className="flex-1 btn-primary"
              >
                {isBulkCreating ? (
                  bulkProgress ? `${bulkProgress.current}/${bulkProgress.total}` : '생성 중...'
                ) : '일괄 생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 납부 처리 모달 */}
      {showPaymentModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">납부 처리</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">학생</span>
                  <span className="font-medium">{selectedPayment.studentName}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">설명</span>
                  <span className="font-medium">{selectedPayment.description}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">청구액</span>
                  <span className="font-medium">{formatCurrency(selectedPayment.amount)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">기납부액</span>
                  <span className="font-medium">{formatCurrency(selectedPayment.paidAmount || 0)}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">납부 금액 (분납 가능)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={paymentForm.paidAmount}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setPaymentForm({ ...paymentForm, paidAmount: value });
                  }}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  placeholder="납부 금액을 입력하세요"
                />
                <div className="mt-1 text-xs text-gray-500">
                  미납 잔액: {formatCurrency(selectedPayment.amount - (selectedPayment.paidAmount || 0))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">메모 (선택)</label>
                <input
                  type="text"
                  value={paymentForm.memo}
                  onChange={(e) => setPaymentForm({ ...paymentForm, memo: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  placeholder="예: 현금 납부, 1차 분납 등"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedPayment(null);
                  setPaymentForm({ paidAmount: '', memo: '' });
                }}
                className="flex-1 btn-outline"
              >
                취소
              </button>
              <button
                onClick={handleMarkAsPaid}
                disabled={isSubmitting}
                className="flex-1 btn-primary"
              >
                {isSubmitting ? '처리 중...' : '납부 처리'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 학부모 알림 전송 모달 */}
      {showPushModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">학부모 알림 전송</h3>
              <p className="text-sm text-gray-500 mt-1">선택한 학생의 학부모에게 알림을 전송합니다</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">알림 제목</label>
                <input
                  type="text"
                  value={pushMessage.title}
                  onChange={(e) => setPushMessage({ ...pushMessage, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  placeholder="예: 수업료 안내"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">알림 내용</label>
                <textarea
                  value={pushMessage.message}
                  onChange={(e) => setPushMessage({ ...pushMessage, message: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  rows={3}
                  placeholder="예: 이번 달 수업료 납부 부탁드립니다."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    학생 선택 ({pushSelectedStudents.size}명 선택됨)
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPushSelectedStudents(new Set(activeStudents.map(s => s.id)))}
                      className="text-xs text-accent hover:text-accent/80"
                    >
                      전체 선택
                    </button>
                    <button
                      onClick={() => setPushSelectedStudents(new Set())}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      전체 해제
                    </button>
                  </div>
                </div>

                {/* 클래스별 선택 */}
                <div className="mb-2">
                  <select
                    onChange={(e) => {
                      const classId = e.target.value;
                      if (classId === 'all') {
                        setPushSelectedStudents(new Set(activeStudents.map(s => s.id)));
                      } else if (classId) {
                        const cls = classes.find(c => c.id === classId);
                        if (cls) {
                          const classStudentIds = activeStudents
                            .filter(s => cls.studentIds.includes(s.id))
                            .map(s => s.id);
                          setPushSelectedStudents(new Set([...pushSelectedStudents, ...classStudentIds]));
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  >
                    <option value="">클래스로 선택 추가...</option>
                    <option value="all">전체 학생</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} ({cls.studentIds.filter(id => activeStudents.some(s => s.id === id)).length}명)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-2">
                  {activeStudents.map((student) => (
                    <label key={student.id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pushSelectedStudents.has(student.id)}
                        onChange={(e) => {
                          const newSet = new Set(pushSelectedStudents);
                          if (e.target.checked) {
                            newSet.add(student.id);
                          } else {
                            newSet.delete(student.id);
                          }
                          setPushSelectedStudents(newSet);
                        }}
                        className="w-4 h-4 text-accent rounded border-gray-300 focus:ring-accent"
                        disabled={isSendingPush}
                      />
                      <span className="text-sm text-gray-700">{student.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 진행상황 표시 */}
              {pushProgress && (
                <div className="bg-accent/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-accent">전송 진행중...</span>
                    <span className="text-sm text-accent">{pushProgress.current}/{pushProgress.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div
                      className="bg-accent h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(pushProgress.current / pushProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600">
                    현재: {pushProgress.currentStudent}
                  </p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowPushModal(false);
                  setPushSelectedStudents(new Set());
                  setPushMessage({ title: '', message: '' });
                }}
                disabled={isSendingPush}
                className="flex-1 btn-outline"
              >
                취소
              </button>
              <button
                onClick={handleSendPushToStudents}
                disabled={isSendingPush || pushSelectedStudents.size === 0}
                className="flex-1 btn-primary"
              >
                {isSendingPush
                  ? (pushProgress ? `${pushProgress.current}/${pushProgress.total}` : '준비 중...')
                  : `${pushSelectedStudents.size}명에게 전송`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상태 변경 모달 */}
      {showStatusModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">상태 변경</h3>
              <p className="text-sm text-gray-500 mt-1">{selectedPayment.studentName} - {selectedPayment.description}</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-2">
                {(['pending', 'partial', 'paid', 'overdue'] as PaymentStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => setNewStatus(status)}
                    className={`py-3 px-4 rounded-xl text-sm font-medium transition-colors ${
                      newStatus === status
                        ? STATUS_COLORS[status].replace('bg-', 'bg-').replace('100', '200')
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setSelectedPayment(null);
                }}
                className="flex-1 btn-outline"
              >
                취소
              </button>
              <button
                onClick={handleStatusChange}
                disabled={isSubmitting || newStatus === selectedPayment.status}
                className="flex-1 btn-primary"
              >
                {isSubmitting ? '변경 중...' : '변경'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
