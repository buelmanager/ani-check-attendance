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
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db, deleteAuthUser } from '../lib/firebase';
import { authService, generateGuardianEmail, normalizePhone } from './authService';
import type { Parent } from '../types';

const COLLECTION = 'parents';

// 보호자-학생 관계 타입
export type RelationType = 'father' | 'mother' | 'guardian';

export const parentService = {
  subscribe(callback: (parents: Parent[]) => void) {
    return onSnapshot(collection(db, COLLECTION), (snapshot) => {
      const parents = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        studentIds: doc.data().studentIds || []
      })) as Parent[];
      callback(parents);
    }, (error) => {
      console.error('Parents subscription error:', error);
    });
  },

  async getAll(): Promise<Parent[]> {
    const snapshot = await getDocs(collection(db, COLLECTION));
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      studentIds: doc.data().studentIds || []
    })) as Parent[];
  },

  async getById(id: string): Promise<Parent | null> {
    const docRef = doc(db, COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        ...docSnap.data(),
        id: docSnap.id,
        studentIds: docSnap.data().studentIds || []
      } as Parent;
    }
    return null;
  },

  async getByUserId(userId: string): Promise<Parent | null> {
    const q = query(collection(db, COLLECTION), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return {
      ...doc.data(),
      id: doc.id,
      studentIds: doc.data().studentIds || []
    } as Parent;
  },

  async create(data: Omit<Parent, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      studentIds: data.studentIds || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  },

  async update(id: string, data: Partial<Parent>): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), {
      ...data,
      updatedAt: serverTimestamp()
    });
  },

  async addStudent(parentId: string, studentId: string): Promise<void> {
    const parent = await this.getById(parentId);
    if (!parent) throw new Error('Parent not found');

    const studentIds = parent.studentIds || [];
    if (!studentIds.includes(studentId)) {
      studentIds.push(studentId);
      await updateDoc(doc(db, COLLECTION, parentId), {
        studentIds,
        updatedAt: serverTimestamp()
      });
    }
  },

  async delete(id: string): Promise<void> {
    // 부모 정보 먼저 조회
    const parent = await this.getById(id);

    // Firebase Auth에서 계정 삭제
    if (parent?.userId) {
      try {
        await deleteAuthUser(parent.userId);
        console.log(`[ParentService.delete] Auth 삭제됨: ${parent.userId}`);
      } catch (error) {
        console.error('Error deleting parent Auth:', error);
      }
    }

    // authMappings에서도 삭제 (전화번호가 있는 경우)
    if (parent?.phone) {
      const cleanPhone = normalizePhone(parent.phone);
      try {
        // 새 형식 삭제
        await deleteDoc(doc(db, 'authMappings', `guardian_${cleanPhone}`));
        // 레거시 형식도 삭제 시도
        await deleteDoc(doc(db, 'authMappings', cleanPhone)).catch(() => {});
      } catch (error) {
        console.error('Error deleting authMappings:', error);
      }
    }

    // 부모 문서 삭제
    await deleteDoc(doc(db, COLLECTION, id));
  },

  // 학생에서 부모 연결 해제 (부모의 studentIds에서 제거)
  async removeStudent(parentId: string, studentId: string): Promise<void> {
    const parent = await this.getById(parentId);
    if (!parent) return;

    const studentIds = parent.studentIds.filter(id => id !== studentId);
    await updateDoc(doc(db, COLLECTION, parentId), {
      studentIds,
      updatedAt: serverTimestamp()
    });
  },

  // 특정 학생의 부모들 가져오기
  async getParentsByStudentId(studentId: string): Promise<Parent[]> {
    const q = query(collection(db, COLLECTION), where('studentIds', 'array-contains', studentId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      studentIds: doc.data().studentIds || []
    })) as Parent[];
  },

  // 전화번호로 보호자 조회
  async getByPhone(phone: string): Promise<Parent | null> {
    const cleanPhone = normalizePhone(phone);
    const formattedPhone = cleanPhone.length === 11
      ? `${cleanPhone.slice(0, 3)}-${cleanPhone.slice(3, 7)}-${cleanPhone.slice(7)}`
      : phone;

    // 여러 형식으로 검색
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
    const parentDoc = snapshot.docs[0];
    return {
      ...parentDoc.data(),
      id: parentDoc.id,
      studentIds: parentDoc.data().studentIds || []
    } as Parent;
  },

  // 이름으로 보호자 검색
  async getByName(name: string): Promise<Parent | null> {
    const q = query(collection(db, COLLECTION), where('name', '==', name));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const parentDoc = snapshot.docs[0];
    return {
      ...parentDoc.data(),
      id: parentDoc.id,
      studentIds: parentDoc.data().studentIds || []
    } as Parent;
  },

  // 보호자 등록과 동시에 Firebase Auth 계정 생성
  // 기존 부모가 있으면 찾아서 매핑하고, 없으면 새로 생성
  async createWithAccount(
    data: {
      name: string;
      phone: string;
      studentId?: string;
      relationType?: RelationType;
    }
  ): Promise<{ parentId: string; firebaseUid?: string; email?: string; isExisting?: boolean; error?: string }> {
    console.log('[ParentService.createWithAccount] 시작:', data);

    // 1. 전화번호로 기존 보호자 확인
    let existingParent = await this.getByPhone(data.phone);
    console.log('[ParentService.createWithAccount] 전화번호로 검색 결과:', existingParent?.id);

    // 2. 전화번호로 못 찾으면 이름으로도 검색 (같은 이름 + 전화번호 없는 경우)
    if (!existingParent) {
      const parentByName = await this.getByName(data.name);
      if (parentByName && !parentByName.phone) {
        // 이름만 있고 전화번호가 없는 부모 → 전화번호 업데이트하면서 매핑
        console.log('[ParentService.createWithAccount] 이름으로 검색 결과 (전화번호 없음):', parentByName.id);
        existingParent = parentByName;
      }
    }

    // 3. 기존 보호자가 있으면 매핑
    if (existingParent) {
      console.log('[ParentService.createWithAccount] 기존 보호자 발견:', existingParent.id);

      // 학생 연결
      if (data.studentId && !existingParent.studentIds.includes(data.studentId)) {
        await this.addStudent(existingParent.id, data.studentId);
        console.log('[ParentService.createWithAccount] 학생 연결 완료');
      }

      // 전화번호가 없거나 다른 경우 업데이트 + 계정 생성
      if (!existingParent.phone || existingParent.phone !== data.phone) {
        const email = generateGuardianEmail(data.phone);
        await updateDoc(doc(db, COLLECTION, existingParent.id), {
          phone: data.phone,
          email,
          updatedAt: serverTimestamp()
        });
        console.log('[ParentService.createWithAccount] 전화번호 업데이트 완료');

        // Auth 계정이 없으면 생성
        if (!existingParent.userId) {
          const authResult = await authService.createGuardianAccount(data.phone, data.name, existingParent.id);
          if (authResult.success && authResult.firebaseUid) {
            await updateDoc(doc(db, COLLECTION, existingParent.id), {
              userId: authResult.firebaseUid,
              updatedAt: serverTimestamp()
            });
            console.log('[ParentService.createWithAccount] 기존 부모에 Auth 계정 생성 완료');
            return {
              parentId: existingParent.id,
              firebaseUid: authResult.firebaseUid,
              email,
              isExisting: true
            };
          }
        }
      }

      return {
        parentId: existingParent.id,
        firebaseUid: existingParent.userId,
        email: existingParent.email,
        isExisting: true
      };
    }

    // 4. 기존 보호자가 없으면 새로 생성
    console.log('[ParentService.createWithAccount] 새 보호자 생성');
    const email = generateGuardianEmail(data.phone);

    // Firestore에 보호자 정보 저장 (undefined 값 제외)
    const newParentData: Record<string, unknown> = {
      name: data.name,
      phone: data.phone,
      email,
      studentIds: data.studentId ? [data.studentId] : [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    // relationType이 있을 때만 추가
    if (data.relationType) {
      newParentData.relationType = data.relationType;
    }

    const docRef = await addDoc(collection(db, COLLECTION), newParentData);
    console.log('[ParentService.createWithAccount] Firestore 문서 생성:', docRef.id);

    // Firebase Auth 계정 생성
    const authResult = await authService.createGuardianAccount(data.phone, data.name, docRef.id);
    console.log('[ParentService.createWithAccount] Auth 계정 생성 결과:', authResult);

    if (authResult.success && authResult.firebaseUid) {
      // 보호자 문서에 Firebase UID 업데이트
      await updateDoc(doc(db, COLLECTION, docRef.id), {
        userId: authResult.firebaseUid,
        updatedAt: serverTimestamp()
      });
      return { parentId: docRef.id, firebaseUid: authResult.firebaseUid, email };
    }

    return { parentId: docRef.id, error: authResult.error };
  },

  // 기존 보호자를 학생과 연결
  async linkToStudent(parentId: string, studentId: string): Promise<void> {
    const parent = await this.getById(parentId);
    if (!parent) throw new Error('Parent not found');

    if (!parent.studentIds.includes(studentId)) {
      await this.addStudent(parentId, studentId);
    }
  },

  // 백업 복원용: 계정이 있으면 연결, 없으면 새로 생성
  async restoreFromBackup(data: {
    name: string;
    phone?: string;
    studentNames?: string[]; // 연결할 학생 이름 목록 (나중에 매칭)
  }): Promise<{ parentId: string; linked: boolean; accountCreated: boolean; error?: string }> {
    console.log('[ParentService.restoreFromBackup] 시작:', data);

    // 전화번호가 있으면 기존 계정 확인 또는 새로 생성
    let firebaseUid: string | undefined;
    let accountCreated = false;

    const parentData: Record<string, unknown> = {
      name: data.name,
      studentIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (data.phone) {
      const cleanPhone = normalizePhone(data.phone);
      const email = generateGuardianEmail(data.phone);
      parentData.phone = data.phone;
      parentData.email = email;
      console.log('[ParentService.restoreFromBackup] 전화번호 있음:', { cleanPhone, email });

      try {
        // 1. authMappings에서 기존 계정 확인 (새 형식: guardian_ 접두사)
        console.log('[ParentService.restoreFromBackup] authMappings 확인 중... (guardian_' + cleanPhone + ')');
        let mappingDoc = await getDoc(doc(db, 'authMappings', `guardian_${cleanPhone}`));

        // 레거시: 접두사 없는 키로도 조회
        if (!mappingDoc.exists()) {
          console.log('[ParentService.restoreFromBackup] 새 형식 없음, 레거시 키 확인 중...');
          mappingDoc = await getDoc(doc(db, 'authMappings', cleanPhone));
        }
        console.log('[ParentService.restoreFromBackup] authMappings 존재:', mappingDoc.exists());

        if (mappingDoc.exists()) {
          const mappingData = mappingDoc.data();
          console.log('[ParentService.restoreFromBackup] authMappings 데이터:', mappingData);
          if (mappingData.firebaseUid) {
            // 기존 계정이 있으면 연결만 함
            firebaseUid = mappingData.firebaseUid;
            parentData.userId = firebaseUid;
            console.log('[ParentService.restoreFromBackup] 기존 계정 발견:', firebaseUid);
          }
        }

        // 2. 기존 계정이 없으면 새로 생성
        if (!firebaseUid) {
          console.log('[ParentService.restoreFromBackup] 기존 계정 없음, 새로 생성...');
          // 먼저 보호자 문서 생성
          const docRef = await addDoc(collection(db, COLLECTION), parentData);
          console.log('[ParentService.restoreFromBackup] 보호자 문서 생성:', docRef.id);

          // Firebase Auth 계정 생성
          const authResult = await authService.createGuardianAccount(data.phone, data.name, docRef.id);
          console.log('[ParentService.restoreFromBackup] Auth 계정 생성 결과:', authResult);

          if (authResult.success && authResult.firebaseUid) {
            // 보호자 문서에 Firebase UID 업데이트
            await updateDoc(doc(db, COLLECTION, docRef.id), {
              userId: authResult.firebaseUid,
              updatedAt: serverTimestamp()
            });
            accountCreated = true;
            console.log('[ParentService.restoreFromBackup] 신규 계정 생성 완료');
            return {
              parentId: docRef.id,
              linked: true,
              accountCreated: true
            };
          }

          console.log('[ParentService.restoreFromBackup] Auth 계정 생성 실패:', authResult.error);
          return {
            parentId: docRef.id,
            linked: false,
            accountCreated: false,
            error: authResult.error
          };
        }
      } catch (error) {
        console.error('[ParentService.restoreFromBackup] 오류:', error);
      }
    } else {
      console.log('[ParentService.restoreFromBackup] 전화번호 없음');
    }

    // 기존 계정이 있거나 전화번호가 없는 경우
    console.log('[ParentService.restoreFromBackup] 최종 보호자 데이터:', parentData);
    const docRef = await addDoc(collection(db, COLLECTION), parentData);
    console.log('[ParentService.restoreFromBackup] 보호자 문서 생성:', docRef.id);

    // authMappings 업데이트 (firestoreId 갱신) - 새 형식: guardian_ 접두사
    if (data.phone && firebaseUid) {
      const cleanPhone = normalizePhone(data.phone);
      console.log('[ParentService.restoreFromBackup] authMappings 업데이트 중... (guardian_' + cleanPhone + ')');
      try {
        await setDoc(doc(db, 'authMappings', `guardian_${cleanPhone}`), {
          userType: 'guardian',
          firestoreId: docRef.id,
          firebaseUid,
          email: generateGuardianEmail(data.phone),
          name: data.name,
          createdAt: serverTimestamp()
        }, { merge: true });
        console.log('[ParentService.restoreFromBackup] authMappings 업데이트 완료');
      } catch (error) {
        console.error('[ParentService.restoreFromBackup] authMappings 업데이트 오류:', error);
      }
    }

    const result = {
      parentId: docRef.id,
      linked: !!firebaseUid,
      accountCreated
    };
    console.log('[ParentService.restoreFromBackup] 최종 결과:', result);
    return result;
  }
};
