import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  orderBy,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  arrayRemove
} from 'firebase/firestore';
import { db, deleteAuthUser } from '../lib/firebase';
import { authService, generateStudentEmail } from './authService';
import type { Student, StudentStatus, StatusChange } from '../types';

const COLLECTION = 'students';

// 6자리 랜덤 초대 코드 생성
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 혼동하기 쉬운 문자 제외 (0,O,1,I)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const studentService = {
  subscribe(callback: (students: Student[]) => void) {
    const q = query(collection(db, COLLECTION), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const students = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          enrolledAt: data.enrolledAt ? (data.enrolledAt as Timestamp)?.toDate?.()?.toISOString() || data.enrolledAt : undefined,
          parentIds: data.parentIds || [],
          status: data.status || 'active', // 기존 데이터 호환
          statusHistory: data.statusHistory || []
        };
      }) as Student[];
      callback(students);
    }, (error) => {
      console.error('Students subscription error:', error);
    });
  },

  async getAll(): Promise<Student[]> {
    const q = query(collection(db, COLLECTION), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      parentIds: doc.data().parentIds || []
    })) as Student[];
  },

  async getById(id: string): Promise<Student | null> {
    const docRef = doc(db, COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        ...docSnap.data(),
        id: docSnap.id,
        parentIds: docSnap.data().parentIds || []
      } as Student;
    }
    return null;
  },

  async getByInviteCode(inviteCode: string): Promise<Student | null> {
    const q = query(collection(db, COLLECTION), where('inviteCode', '==', inviteCode));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return {
      ...doc.data(),
      id: doc.id,
      parentIds: doc.data().parentIds || []
    } as Student;
  },

  async getByUserId(userId: string): Promise<Student | null> {
    const q = query(collection(db, COLLECTION), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return {
      ...doc.data(),
      id: doc.id,
      parentIds: doc.data().parentIds || []
    } as Student;
  },

  async create(data: Omit<Student, 'id' | 'createdAt' | 'inviteCode' | 'parentIds' | 'status' | 'statusHistory' | 'enrolledAt'> & { enrolledAt?: string }): Promise<string> {
    // 고유한 초대 코드 생성 (중복 체크)
    let inviteCode = generateInviteCode();
    let existing = await this.getByInviteCode(inviteCode);
    while (existing) {
      inviteCode = generateInviteCode();
      existing = await this.getByInviteCode(inviteCode);
    }

    const now = new Date().toISOString();
    const initialStatus: StatusChange = {
      status: 'active',
      changedAt: now
    };

    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      inviteCode,
      parentIds: [],
      status: 'active',
      enrolledAt: data.enrolledAt || now,
      statusHistory: [initialStatus],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  },

  async update(id: string, data: Partial<Student>): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), {
      ...data,
      updatedAt: serverTimestamp()
    });
  },

  async linkUserAccount(studentId: string, userId: string, phone?: string): Promise<void> {
    if (phone) {
      await updateDoc(doc(db, COLLECTION, studentId), {
        userId,
        phone,
        updatedAt: serverTimestamp()
      });
    } else {
      await updateDoc(doc(db, COLLECTION, studentId), {
        userId,
        updatedAt: serverTimestamp()
      });
    }
  },

  async addParent(studentId: string, parentId: string): Promise<void> {
    const student = await this.getById(studentId);
    if (!student) throw new Error('Student not found');

    const parentIds = student.parentIds || [];
    if (!parentIds.includes(parentId)) {
      parentIds.push(parentId);
      await updateDoc(doc(db, COLLECTION, studentId), {
        parentIds,
        updatedAt: serverTimestamp()
      });
    }
  },

  async delete(id: string, options?: { deleteParents?: boolean }): Promise<void> {
    // 학생 정보 먼저 조회
    const student = await this.getById(id);

    // 모든 클래스에서 해당 학생 제거
    const classesRef = collection(db, 'classes');
    const classesSnapshot = await getDocs(classesRef);

    for (const classDoc of classesSnapshot.docs) {
      const classData = classDoc.data();
      if (classData.studentIds?.includes(id)) {
        await updateDoc(doc(db, 'classes', classDoc.id), {
          studentIds: arrayRemove(id),
          updatedAt: serverTimestamp()
        });
      }
    }

    // 연결된 부모 처리
    if (student?.parentIds && student.parentIds.length > 0) {
      const parentsRef = collection(db, 'parents');

      for (const parentId of student.parentIds) {
        try {
          const parentDoc = await getDoc(doc(parentsRef, parentId));
          if (parentDoc.exists()) {
            const parentData = parentDoc.data();
            const remainingStudents = (parentData.studentIds || []).filter((sid: string) => sid !== id);

            if (options?.deleteParents || remainingStudents.length === 0) {
              // 부모 삭제 옵션이 켜져있거나, 이 학생이 유일한 자녀인 경우 부모도 삭제
              // Firebase Auth에서 부모 계정 삭제
              if (parentData.userId) {
                try {
                  await deleteAuthUser(parentData.userId);
                  console.log(`[StudentService.delete] 부모 Auth 삭제됨: ${parentData.userId}`);
                } catch (error) {
                  console.error('Error deleting parent Auth:', error);
                }
              }
              // authMappings에서도 삭제
              if (parentData.phone) {
                const cleanPhone = parentData.phone.replace(/[^0-9]/g, '');
                try {
                  await deleteDoc(doc(db, 'authMappings', `guardian_${cleanPhone}`));
                  await deleteDoc(doc(db, 'authMappings', cleanPhone)).catch(() => {});
                } catch (error) {
                  console.error('Error deleting parent authMappings:', error);
                }
              }
              // 부모 문서 삭제
              await deleteDoc(doc(parentsRef, parentId));
              console.log(`[StudentService.delete] 부모 삭제됨: ${parentId}`);
            } else {
              // 다른 자녀가 있으면 연결만 해제
              await updateDoc(doc(parentsRef, parentId), {
                studentIds: remainingStudents,
                updatedAt: serverTimestamp()
              });
              console.log(`[StudentService.delete] 부모 연결 해제: ${parentId}`);
            }
          }
        } catch (error) {
          console.error(`Error processing parent ${parentId}:`, error);
        }
      }
    }

    // Firebase Auth에서 학생 계정 삭제
    if (student?.userId) {
      try {
        await deleteAuthUser(student.userId);
        console.log(`[StudentService.delete] 학생 Auth 삭제됨: ${student.userId}`);
      } catch (error) {
        console.error('Error deleting student Auth:', error);
      }
    }

    // 학생 authMappings 삭제
    if (student?.phone) {
      const cleanPhone = student.phone.replace(/[^0-9]/g, '');
      try {
        await deleteDoc(doc(db, 'authMappings', `student_${cleanPhone}`));
        await deleteDoc(doc(db, 'authMappings', cleanPhone)).catch(() => {});
      } catch (error) {
        console.error('Error deleting student authMappings:', error);
      }
    }

    // 학생 문서 삭제
    await deleteDoc(doc(db, COLLECTION, id));
  },

  // 원생 상태 변경 (재원/휴원/퇴원)
  async changeStatus(id: string, newStatus: StudentStatus, reason?: string): Promise<void> {
    const student = await this.getById(id);
    if (!student) throw new Error('Student not found');

    const statusChange: StatusChange = {
      status: newStatus,
      changedAt: new Date().toISOString(),
      reason
    };

    const statusHistory = [...(student.statusHistory || []), statusChange];

    await updateDoc(doc(db, COLLECTION, id), {
      status: newStatus,
      statusHistory,
      updatedAt: serverTimestamp()
    });
  },

  // 상태별 원생 조회 (실시간)
  subscribeByStatus(status: StudentStatus, callback: (students: Student[]) => void) {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', status),
      orderBy('name', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
      const students = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          parentIds: data.parentIds || [],
          status: data.status || 'active',
          statusHistory: data.statusHistory || []
        };
      }) as Student[];
      callback(students);
    });
  },

  // 재원생만 조회
  async getActiveStudents(): Promise<Student[]> {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'active'),
      orderBy('name', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      parentIds: doc.data().parentIds || [],
      status: doc.data().status || 'active'
    })) as Student[];
  },

  // 학생 등록과 동시에 Firebase Auth 계정 생성
  async createWithAccount(
    data: Omit<Student, 'id' | 'createdAt' | 'inviteCode' | 'parentIds' | 'status' | 'statusHistory' | 'enrolledAt' | 'userId' | 'email'> & { enrolledAt?: string }
  ): Promise<{ studentId: string; firebaseUid?: string; email?: string; error?: string }> {
    // 전화번호가 없으면 계정 생성 불가
    if (!data.phone) {
      // 전화번호 없이 학생만 생성
      const studentId = await this.create(data);
      return { studentId };
    }

    // 고유한 초대 코드 생성 (중복 체크)
    let inviteCode = generateInviteCode();
    let existing = await this.getByInviteCode(inviteCode);
    while (existing) {
      inviteCode = generateInviteCode();
      existing = await this.getByInviteCode(inviteCode);
    }

    const now = new Date().toISOString();
    const initialStatus: StatusChange = {
      status: 'active',
      changedAt: now
    };

    const email = generateStudentEmail(data.phone);

    // Firestore에 학생 정보 먼저 저장
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      email,
      inviteCode,
      parentIds: [],
      status: 'active',
      enrolledAt: data.enrolledAt || now,
      statusHistory: [initialStatus],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Firebase Auth 계정 생성
    const authResult = await authService.createStudentAccount(data.phone, data.name, docRef.id);

    if (authResult.success && authResult.firebaseUid) {
      // 학생 문서에 Firebase UID 업데이트
      await updateDoc(doc(db, COLLECTION, docRef.id), {
        userId: authResult.firebaseUid,
        updatedAt: serverTimestamp()
      });
      return { studentId: docRef.id, firebaseUid: authResult.firebaseUid, email };
    }

    return { studentId: docRef.id, error: authResult.error };
  },

  // 전화번호로 학생 조회
  async getByPhone(phone: string): Promise<Student | null> {
    // 하이픈 제거된 번호와 포맷된 번호 모두 검색
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.length === 11
      ? `${cleanPhone.slice(0, 3)}-${cleanPhone.slice(3, 7)}-${cleanPhone.slice(7)}`
      : phone;

    // 정확한 번호로 검색
    let q = query(collection(db, COLLECTION), where('phone', '==', phone));
    let snapshot = await getDocs(q);

    if (snapshot.empty && phone !== formattedPhone) {
      q = query(collection(db, COLLECTION), where('phone', '==', formattedPhone));
      snapshot = await getDocs(q);
    }

    if (snapshot.empty && phone !== cleanPhone) {
      q = query(collection(db, COLLECTION), where('phone', '==', cleanPhone));
      snapshot = await getDocs(q);
    }

    if (snapshot.empty) return null;
    const studentDoc = snapshot.docs[0];
    return {
      ...studentDoc.data(),
      id: studentDoc.id,
      parentIds: studentDoc.data().parentIds || []
    } as Student;
  },

  // 백업 복원용: 계정이 있으면 연결, 없으면 새로 생성
  async restoreFromBackup(data: {
    name: string;
    inviteCode?: string;
    status?: StudentStatus;
    grade?: string;
    birthDate?: string;
    gender?: 'male' | 'female';
    school?: string;
    phone?: string;
    address?: string;
    enrolledAt?: string;
    notes?: string;
  }): Promise<{ studentId: string; linked: boolean; accountCreated: boolean; error?: string }> {
    // 초대코드가 있으면 기존 초대코드 사용, 없으면 새로 생성
    let inviteCode = data.inviteCode;
    if (inviteCode) {
      // 초대코드 중복 체크
      const existing = await this.getByInviteCode(inviteCode);
      if (existing) {
        // 이미 존재하는 초대코드면 새로 생성
        inviteCode = undefined;
      }
    }

    if (!inviteCode) {
      inviteCode = generateInviteCode();
      let existing = await this.getByInviteCode(inviteCode);
      while (existing) {
        inviteCode = generateInviteCode();
        existing = await this.getByInviteCode(inviteCode);
      }
    }

    const now = new Date().toISOString();
    const initialStatus: StatusChange = {
      status: data.status || 'active',
      changedAt: now
    };

    // Firestore에 학생 데이터 저장
    const studentData: Record<string, unknown> = {
      name: data.name,
      inviteCode,
      parentIds: [],
      status: data.status || 'active',
      enrolledAt: data.enrolledAt || now,
      statusHistory: [initialStatus],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // 선택적 필드 추가 (undefined 값 제외)
    if (data.phone) studentData.phone = data.phone;
    if (data.birthDate) studentData.birthDate = data.birthDate;
    if (data.gender) studentData.gender = data.gender;
    if (data.school) studentData.school = data.school;
    if (data.grade) studentData.grade = data.grade;
    if (data.address) studentData.address = data.address;
    if (data.notes) studentData.notes = data.notes;

    // 전화번호가 있으면 기존 계정 확인 또는 새로 생성
    let firebaseUid: string | undefined;
    let accountCreated = false;

    if (data.phone) {
      const cleanPhone = data.phone.replace(/[^0-9]/g, '');
      const email = generateStudentEmail(data.phone);
      studentData.email = email;

      try {
        // 1. authMappings에서 기존 계정 확인 (새 형식: student_ 접두사)
        let mappingDoc = await getDoc(doc(db, 'authMappings', `student_${cleanPhone}`));

        // 레거시: 접두사 없는 키로도 조회
        if (!mappingDoc.exists()) {
          mappingDoc = await getDoc(doc(db, 'authMappings', cleanPhone));
        }

        if (mappingDoc.exists()) {
          const mappingData = mappingDoc.data();
          if (mappingData.firebaseUid && mappingData.userType === 'student') {
            // 기존 계정이 있으면 연결만 함
            firebaseUid = mappingData.firebaseUid;
            studentData.userId = firebaseUid;
          }
        }

        // 2. 기존 계정이 없으면 새로 생성
        if (!firebaseUid) {
          // 먼저 학생 문서 생성
          const docRef = await addDoc(collection(db, COLLECTION), studentData);

          // Firebase Auth 계정 생성
          const authResult = await authService.createStudentAccount(data.phone, data.name, docRef.id);

          if (authResult.success && authResult.firebaseUid) {
            // 학생 문서에 Firebase UID 업데이트
            await updateDoc(doc(db, COLLECTION, docRef.id), {
              userId: authResult.firebaseUid,
              updatedAt: serverTimestamp()
            });
            accountCreated = true;
            return {
              studentId: docRef.id,
              linked: true,
              accountCreated: true
            };
          }

          return {
            studentId: docRef.id,
            linked: false,
            accountCreated: false,
            error: authResult.error
          };
        }
      } catch (error) {
        console.error('Error checking/creating account:', error);
      }
    }

    // 기존 계정이 있거나 전화번호가 없는 경우
    const docRef = await addDoc(collection(db, COLLECTION), studentData);

    // authMappings 업데이트 (firestoreId 갱신) - 새 형식: student_ 접두사
    if (data.phone && firebaseUid) {
      const cleanPhone = data.phone.replace(/[^0-9]/g, '');
      try {
        await setDoc(doc(db, 'authMappings', `student_${cleanPhone}`), {
          userType: 'student',
          firestoreId: docRef.id,
          firebaseUid,
          email: generateStudentEmail(data.phone),
          name: data.name,
          createdAt: serverTimestamp()
        }, { merge: true });
      } catch (error) {
        console.error('Error updating authMappings:', error);
      }
    }

    return {
      studentId: docRef.id,
      linked: !!firebaseUid,
      accountCreated
    };
  }
};
