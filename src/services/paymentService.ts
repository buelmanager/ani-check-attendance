import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Payment, PaymentStatus, ClassFee } from '../types';

const PAYMENTS_COLLECTION = 'payments';
const CLASS_FEES_COLLECTION = 'classFees';

// Timestamp를 ISO string으로 변환
function convertTimestamp(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return new Date().toISOString();
}

export const paymentService = {
  // ========== 납부 항목 관련 ==========

  // 모든 납부 항목 구독 (실시간)
  subscribe(callback: (payments: Payment[]) => void) {
    const q = query(
      collection(db, PAYMENTS_COLLECTION),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const payments = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: convertTimestamp(data.createdAt),
          updatedAt: data.updatedAt ? convertTimestamp(data.updatedAt) : undefined,
          paidAt: data.paidAt ? convertTimestamp(data.paidAt) : undefined,
        } as Payment;
      });
      callback(payments);
    }, (error) => {
      console.error('Payments subscription error:', error);
    });
  },

  // 특정 학생의 납부 내역 구독
  subscribeByStudent(studentId: string, callback: (payments: Payment[]) => void) {
    const q = query(
      collection(db, PAYMENTS_COLLECTION),
      where('studentId', '==', studentId),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const payments = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: convertTimestamp(data.createdAt),
          updatedAt: data.updatedAt ? convertTimestamp(data.updatedAt) : undefined,
          paidAt: data.paidAt ? convertTimestamp(data.paidAt) : undefined,
        } as Payment;
      });
      callback(payments);
    });
  },

  // 여러 학생의 납부 내역 구독 (학부모용)
  subscribeByStudents(studentIds: string[], callback: (payments: Payment[]) => void) {
    if (studentIds.length === 0) {
      callback([]);
      return () => {};
    }

    // in 쿼리만 사용하고, 정렬은 클라이언트에서 처리 (인덱스 필요 없음)
    const q = query(
      collection(db, PAYMENTS_COLLECTION),
      where('studentId', 'in', studentIds)
    );
    return onSnapshot(q, (snapshot) => {
      const payments = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: convertTimestamp(data.createdAt),
          updatedAt: data.updatedAt ? convertTimestamp(data.updatedAt) : undefined,
          paidAt: data.paidAt ? convertTimestamp(data.paidAt) : undefined,
        } as Payment;
      });
      // 클라이언트에서 정렬 (최신순)
      payments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(payments);
    }, (error) => {
      console.error('Payment subscription error:', error);
      callback([]);
    });
  },

  // 상태별 납부 내역 조회
  async getByStatus(status: PaymentStatus): Promise<Payment[]> {
    const q = query(
      collection(db, PAYMENTS_COLLECTION),
      where('status', '==', status),
      orderBy('dueDate', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    })) as Payment[];
  },

  // 미납/연체 내역 조회
  async getUnpaid(): Promise<Payment[]> {
    const q = query(
      collection(db, PAYMENTS_COLLECTION),
      where('status', 'in', ['pending', 'overdue', 'partial']),
      orderBy('dueDate', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    })) as Payment[];
  },

  // 납부 항목 생성
  async create(data: Omit<Payment, 'id' | 'createdAt' | 'updatedAt' | 'paidAt' | 'paidAmount' | 'status'>): Promise<string> {
    const docRef = await addDoc(collection(db, PAYMENTS_COLLECTION), {
      ...data,
      paidAmount: 0,
      status: 'pending' as PaymentStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  },

  // 여러 학생에게 일괄 청구서 생성
  async createBulk(
    students: { id: string; name: string }[],
    paymentData: { amount: number; description: string; dueDate: string }
  ): Promise<number> {
    const batch = writeBatch(db);
    let count = 0;

    for (const student of students) {
      const docRef = doc(collection(db, PAYMENTS_COLLECTION));
      batch.set(docRef, {
        studentId: student.id,
        studentName: student.name,
        amount: paymentData.amount,
        description: paymentData.description,
        dueDate: paymentData.dueDate,
        paidAmount: 0,
        status: 'pending' as PaymentStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      count++;
    }

    await batch.commit();
    return count;
  },

  // 납부 완료 처리
  async markAsPaid(id: string, paidAmount?: number, memo?: string): Promise<void> {
    const docRef = doc(db, PAYMENTS_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Payment not found');
    }

    const payment = docSnap.data() as Payment;
    const finalPaidAmount = paidAmount ?? payment.amount;

    // 상태 결정: 전액 납부면 paid, 부분 납부면 partial
    const newStatus: PaymentStatus = finalPaidAmount >= payment.amount ? 'paid' : 'partial';

    const updateFields = {
      paidAmount: finalPaidAmount,
      status: newStatus,
      paidAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      confirmationRequested: false,
      confirmationRequestedAt: null,
      ...(memo !== undefined && { memo })
    };

    await updateDoc(docRef, updateFields);
  },

  // 납부 취소 (다시 미납으로)
  async cancelPayment(id: string): Promise<void> {
    await updateDoc(doc(db, PAYMENTS_COLLECTION, id), {
      paidAmount: 0,
      status: 'pending' as PaymentStatus,
      paidAt: null,
      updatedAt: serverTimestamp()
    });
  },

  // 납부 항목 수정
  async update(id: string, data: Partial<Payment>): Promise<void> {
    const { id: _, createdAt: __, ...updateData } = data;
    await updateDoc(doc(db, PAYMENTS_COLLECTION, id), {
      ...updateData,
      updatedAt: serverTimestamp()
    });
  },

  // 납부 항목 삭제
  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, PAYMENTS_COLLECTION, id));
  },

  // 납부 확인 요청 (학부모용)
  async requestConfirmation(id: string): Promise<void> {
    await updateDoc(doc(db, PAYMENTS_COLLECTION, id), {
      confirmationRequested: true,
      confirmationRequestedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  },

  // 납부 확인 요청 취소/리셋
  async clearConfirmationRequest(id: string): Promise<void> {
    await updateDoc(doc(db, PAYMENTS_COLLECTION, id), {
      confirmationRequested: false,
      confirmationRequestedAt: null,
      updatedAt: serverTimestamp()
    });
  },

  // 연체 상태 자동 업데이트
  async updateOverdueStatus(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];

    const q = query(
      collection(db, PAYMENTS_COLLECTION),
      where('status', 'in', ['pending', 'partial']),
      where('dueDate', '<', today)
    );

    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    let count = 0;

    snapshot.docs.forEach(docSnap => {
      batch.update(doc(db, PAYMENTS_COLLECTION, docSnap.id), {
        status: 'overdue' as PaymentStatus,
        updatedAt: serverTimestamp()
      });
      count++;
    });

    if (count > 0) {
      await batch.commit();
    }

    return count;
  },

  // ========== 클래스별 수업료 설정 ==========

  // 수업료 설정 구독
  subscribeClassFees(callback: (fees: ClassFee[]) => void) {
    const q = query(collection(db, CLASS_FEES_COLLECTION), orderBy('className', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const fees = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        updatedAt: convertTimestamp(doc.data().updatedAt)
      })) as ClassFee[];
      callback(fees);
    });
  },

  // 수업료 설정 조회
  async getClassFees(): Promise<ClassFee[]> {
    const snapshot = await getDocs(collection(db, CLASS_FEES_COLLECTION));
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    })) as ClassFee[];
  },

  // 특정 클래스 수업료 조회
  async getClassFee(classId: string): Promise<ClassFee | null> {
    const q = query(
      collection(db, CLASS_FEES_COLLECTION),
      where('classId', '==', classId)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return {
      ...snapshot.docs[0].data(),
      id: snapshot.docs[0].id,
    } as ClassFee;
  },

  // 수업료 설정 저장/업데이트
  async setClassFee(classId: string, className: string, monthlyFee: number, description?: string): Promise<void> {
    const existing = await this.getClassFee(classId);

    if (existing) {
      await updateDoc(doc(db, CLASS_FEES_COLLECTION, existing.id), {
        className,
        monthlyFee,
        description: description || null,
        updatedAt: serverTimestamp()
      });
    } else {
      await addDoc(collection(db, CLASS_FEES_COLLECTION), {
        classId,
        className,
        monthlyFee,
        description: description || null,
        updatedAt: serverTimestamp()
      });
    }
  },

  // 수업료 설정 삭제
  async deleteClassFee(id: string): Promise<void> {
    await deleteDoc(doc(db, CLASS_FEES_COLLECTION, id));
  },

  // ========== 통계 ==========

  // 월별 납부 통계
  async getMonthlyStats(year: number, month: number): Promise<{
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    overdueAmount: number;
    paidCount: number;
    pendingCount: number;
    overdueCount: number;
  }> {
    // 해당 월의 청구서 조회 (description에서 월 정보 파싱 또는 dueDate 기준)
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const q = query(
      collection(db, PAYMENTS_COLLECTION),
      where('dueDate', '>=', startDate),
      where('dueDate', '<=', endDate)
    );

    const snapshot = await getDocs(q);

    let totalAmount = 0;
    let paidAmount = 0;
    let pendingAmount = 0;
    let overdueAmount = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let overdueCount = 0;

    snapshot.docs.forEach(doc => {
      const payment = doc.data() as Payment;
      totalAmount += payment.amount;

      switch (payment.status) {
        case 'paid':
          paidAmount += payment.amount;
          paidCount++;
          break;
        case 'partial':
          paidAmount += payment.paidAmount || 0;
          pendingAmount += payment.amount - (payment.paidAmount || 0);
          pendingCount++;
          break;
        case 'pending':
          pendingAmount += payment.amount;
          pendingCount++;
          break;
        case 'overdue':
          overdueAmount += payment.amount - (payment.paidAmount || 0);
          overdueCount++;
          break;
      }
    });

    return {
      totalAmount,
      paidAmount,
      pendingAmount,
      overdueAmount,
      paidCount,
      pendingCount,
      overdueCount
    };
  }
};
