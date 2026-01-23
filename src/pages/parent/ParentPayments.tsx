import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ParentLayout } from '../../components/parent/ParentLayout';
import { paymentService } from '../../services/paymentService';
import { studentService } from '../../services/studentService';
import type { Payment, PaymentStatus, Student } from '../../types';

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

// 상태 아이콘
const STATUS_ICONS: Record<PaymentStatus, JSX.Element> = {
  pending: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  paid: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  partial: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  overdue: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
};

export default function ParentPayments() {
  const { parentData } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [children, setChildren] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');

  // 자녀 정보 로드
  useEffect(() => {
    if (!parentData) return;

    const loadChildren = async () => {
      const childrenData = await Promise.all(
        parentData.studentIds.map(studentId => studentService.getById(studentId))
      );
      setChildren(childrenData.filter((student): student is Student => student !== null));
    };

    loadChildren();
  }, [parentData]);

  // 납부 내역 구독
  useEffect(() => {
    if (!parentData || parentData.studentIds.length === 0) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = paymentService.subscribeByStudents(
      parentData.studentIds,
      (data) => {
        setPayments(data);
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, [parentData]);

  // 필터링된 납부 목록
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const matchesChild = selectedChild === 'all' || p.studentId === selectedChild;
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesChild && matchesStatus;
    });
  }, [payments, selectedChild, statusFilter]);

  // 통계 계산
  const stats = useMemo(() => {
    const unpaid = payments.filter(p => p.status === 'pending' || p.status === 'partial' || p.status === 'overdue');
    const totalUnpaid = unpaid.reduce((sum, p) => sum + (p.amount - (p.paidAmount || 0)), 0);
    const overdueCount = payments.filter(p => p.status === 'overdue').length;
    return { totalUnpaid, overdueCount, unpaidCount: unpaid.length };
  }, [payments]);

  // 금액 포맷
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);
  };

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // 남은 일수 계산
  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  if (isLoading) {
    return (
      <ParentLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent"></div>
        </div>
      </ParentLayout>
    );
  }

  return (
    <ParentLayout>
      <div className="space-y-6">
        {/* 헤더 */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">납부 내역</h1>
          <p className="text-gray-500 mt-1">자녀의 수업료 납부 현황을 확인합니다</p>
        </div>

        {/* 요약 카드 */}
        {stats.unpaidCount > 0 && (
          <div className={`rounded-2xl p-5 ${stats.overdueCount > 0 ? 'bg-red-50 border border-red-100' : 'bg-yellow-50 border border-yellow-100'}`}>
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${stats.overdueCount > 0 ? 'bg-red-100' : 'bg-yellow-100'}`}>
                <svg className={`w-6 h-6 ${stats.overdueCount > 0 ? 'text-red-600' : 'text-yellow-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className={`font-semibold ${stats.overdueCount > 0 ? 'text-red-900' : 'text-yellow-900'}`}>
                  {stats.overdueCount > 0 ? '연체된 납부 항목이 있습니다' : '미납 항목이 있습니다'}
                </h3>
                <p className={`text-sm mt-1 ${stats.overdueCount > 0 ? 'text-red-700' : 'text-yellow-700'}`}>
                  {stats.unpaidCount}건 · {formatCurrency(stats.totalUnpaid)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 필터 */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* 자녀 선택 */}
          {children.length > 1 && (
            <select
              value={selectedChild}
              onChange={(e) => setSelectedChild(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              <option value="all">전체 자녀</option>
              {children.map((child) => (
                <option key={child.id} value={child.id}>{child.name}</option>
              ))}
            </select>
          )}

          {/* 상태 필터 */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'pending', 'partial', 'overdue', 'paid'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-accent text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status === 'all' ? '전체' : STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>

        {/* 납부 목록 */}
        {filteredPayments.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500">
              {payments.length === 0 ? '납부 내역이 없습니다' : '검색 결과가 없습니다'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPayments.map((payment) => {
              const daysUntilDue = getDaysUntilDue(payment.dueDate);
              const child = children.find(c => c.id === payment.studentId);
              const remainingAmount = payment.amount - (payment.paidAmount || 0);

              return (
                <div
                  key={payment.id}
                  className="bg-white rounded-2xl p-5 border border-gray-100 hover:border-gray-200 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* 학생 이름 & 상태 */}
                      <div className="flex items-center gap-2 mb-2">
                        {children.length > 1 && (
                          <span className="text-sm font-medium text-gray-500">{child?.name || payment.studentName}</span>
                        )}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[payment.status]}`}>
                          {STATUS_ICONS[payment.status]}
                          {STATUS_LABELS[payment.status]}
                        </span>
                      </div>

                      {/* 설명 */}
                      <h3 className="font-semibold text-gray-900 mb-1">{payment.description}</h3>

                      {/* 납부 기한 */}
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>납부기한: {formatDate(payment.dueDate)}</span>
                        {payment.status !== 'paid' && (
                          <span className={`font-medium ${daysUntilDue < 0 ? 'text-red-600' : daysUntilDue <= 3 ? 'text-yellow-600' : 'text-gray-600'}`}>
                            ({daysUntilDue < 0 ? `${Math.abs(daysUntilDue)}일 경과` : daysUntilDue === 0 ? '오늘' : `${daysUntilDue}일 남음`})
                          </span>
                        )}
                      </div>

                      {/* 납부 완료일 */}
                      {payment.paidAt && (
                        <div className="flex items-center gap-2 text-sm text-green-600 mt-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>납부완료: {formatDate(payment.paidAt)}</span>
                        </div>
                      )}
                    </div>

                    {/* 금액 */}
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">{formatCurrency(payment.amount)}</div>
                      {payment.status === 'partial' && (
                        <div className="text-sm text-gray-500">
                          납부: {formatCurrency(payment.paidAmount || 0)}
                        </div>
                      )}
                      {(payment.status === 'pending' || payment.status === 'partial' || payment.status === 'overdue') && (
                        <div className={`text-sm font-medium ${payment.status === 'overdue' ? 'text-red-600' : 'text-yellow-600'}`}>
                          미납: {formatCurrency(remainingAmount)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 메모 */}
                  {payment.memo && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-sm text-gray-500">
                        <span className="font-medium">메모:</span> {payment.memo}
                      </p>
                    </div>
                  )}

                  {/* 납부 확인 요청 버튼 */}
                  {(payment.status === 'pending' || payment.status === 'partial' || payment.status === 'overdue') && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      {payment.confirmationRequested ? (
                        <div className="flex items-center gap-2 text-sm text-orange-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>납부 확인 요청됨 - 관리자 확인 대기중</span>
                        </div>
                      ) : (
                        <button
                          onClick={async () => {
                            if (confirm('입금 후 납부 확인을 요청하시겠습니까?')) {
                              try {
                                await paymentService.requestConfirmation(payment.id);
                              } catch (error) {
                                console.error('Error requesting confirmation:', error);
                                alert('확인 요청 중 오류가 발생했습니다.');
                              }
                            }
                          }}
                          className="w-full py-2.5 px-4 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          입금 완료 - 납부 확인 요청
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 안내 문구 */}
        <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">납부 안내</p>
              <p>수업료는 계좌이체 또는 현금으로 납부해 주세요. 납부 후 관리자가 확인하면 납부 완료 처리됩니다.</p>
            </div>
          </div>
        </div>
      </div>
    </ParentLayout>
  );
}
