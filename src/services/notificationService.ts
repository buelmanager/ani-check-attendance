import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Notification } from '../types';

const COLLECTION = 'notifications';

export const notificationService = {
  // 특정 사용자의 알림 구독
  subscribeForUser(userId: string, callback: (notifications: Notification[]) => void) {
    // 복합 인덱스 없이 쿼리하고 클라이언트에서 정렬
    const q = query(
      collection(db, COLLECTION),
      where('userId', '==', userId)
    );
    return onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString()
      })) as Notification[];
      // 클라이언트에서 최신순 정렬
      notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(notifications);
    }, (error) => {
      console.error('Notifications subscription error:', error);
    });
  },

  async getForUser(userId: string): Promise<Notification[]> {
    // 복합 인덱스 없이 쿼리하고 클라이언트에서 정렬
    const q = query(
      collection(db, COLLECTION),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    const notifications = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString()
    })) as Notification[];
    // 클라이언트에서 최신순 정렬
    return notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getUnreadCount(userId: string): Promise<number> {
    const q = query(
      collection(db, COLLECTION),
      where('userId', '==', userId),
      where('isRead', '==', false)
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  },

  async create(data: Omit<Notification, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  },

  async markAsRead(id: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), {
      isRead: true
    });
  },

  async markAllAsRead(userId: string): Promise<void> {
    const q = query(
      collection(db, COLLECTION),
      where('userId', '==', userId),
      where('isRead', '==', false)
    );
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { isRead: true });
    });
    await batch.commit();
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  },

  // 부모에게 체크인 알림 생성
  async notifyParentsOfCheckin(
    parentUserIds: string[],
    studentName: string,
    className: string,
    status: 'present' | 'late',
    checkInTime: string
  ): Promise<void> {
    const statusText = status === 'present' ? '출석' : '지각';

    for (const userId of parentUserIds) {
      await this.create({
        userId,
        type: 'checkin',
        title: `${studentName} ${statusText}`,
        message: `${studentName}님이 ${className} 수업에 ${checkInTime}에 ${statusText}했습니다.`,
        isRead: false
      });
    }
  },

  // 부모에게 출석 상태 변경 알림 (결석, 지각, 출석, 공결)
  async notifyParentsOfAttendanceChange(
    parentUserIds: string[],
    studentName: string,
    className: string,
    status: 'present' | 'late' | 'absent' | 'excused',
    date: string
  ): Promise<void> {
    const statusTextMap = {
      present: '출석',
      late: '지각',
      absent: '결석',
      excused: '공결'
    };
    const statusText = statusTextMap[status];

    const typeMap: Record<string, 'checkin' | 'late' | 'absent' | 'announcement'> = {
      present: 'checkin',
      late: 'late',
      absent: 'absent',
      excused: 'checkin'
    };
    const notificationType = typeMap[status];

    const formattedDate = new Date(date).toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric'
    });

    for (const userId of parentUserIds) {
      await this.create({
        userId,
        type: notificationType,
        title: `${studentName} ${statusText} 처리`,
        message: `${studentName}님이 ${formattedDate} ${className} 수업에 ${statusText} 처리되었습니다.`,
        isRead: false
      });
    }
  }
};
