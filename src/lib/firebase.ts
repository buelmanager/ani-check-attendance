import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { getFunctions, httpsCallable } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyByscDrn1u1V5Lbol-t7YwFgPEoBFWCxgE",
  authDomain: "art-academy-80ae5.firebaseapp.com",
  projectId: "art-academy-80ae5",
  storageBucket: "art-academy-80ae5.firebasestorage.app",
  messagingSenderId: "496950594898",
  appId: "1:496950594898:web:069336867debd98a43fe8b"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Firebase Functions 초기화 (asia-northeast3 리전)
export const functions = getFunctions(app, 'asia-northeast3');

// 개발 환경에서 에뮬레이터 사용 (필요시 주석 해제)
// if (import.meta.env.DEV) {
//   connectFunctionsEmulator(functions, 'localhost', 5001);
// }

// Auth 삭제 Cloud Function 호출
export const deleteAuthUser = async (uid: string): Promise<{ success: boolean; message?: string }> => {
  try {
    const deleteUserFn = httpsCallable<{ uid: string }, { success: boolean; message: string }>(functions, 'deleteAuthUser');
    const result = await deleteUserFn({ uid });
    return result.data;
  } catch (error: unknown) {
    console.error('Error calling deleteAuthUser:', error);
    // Cloud Function 오류는 무시하고 계속 진행 (Firestore 삭제는 이미 완료된 상태)
    return { success: false, message: (error as Error).message };
  }
};

// 여러 Auth 사용자 일괄 삭제
export const deleteAuthUsers = async (uids: string[]): Promise<{
  success: boolean;
  successCount?: number;
  failureCount?: number;
  errors?: Array<{ index: number; error: string }>;
}> => {
  try {
    const deleteUsersFn = httpsCallable<
      { uids: string[] },
      { success: boolean; successCount: number; failureCount: number; errors: Array<{ index: number; error: string }> }
    >(functions, 'deleteAuthUsers');
    const result = await deleteUsersFn({ uids });
    return result.data;
  } catch (error: unknown) {
    console.error('Error calling deleteAuthUsers:', error);
    return { success: false };
  }
};

// 학생+부모 일괄 등록 (서버에서 처리)
export interface BatchStudentData {
  name: string;
  phone: string;
  birthDate?: string;
  gender?: 'male' | 'female';
  school?: string;
  grade?: string;
  address?: string;
  notes?: string;
  parent?: {
    name: string;
    phone: string;
    relationType?: 'father' | 'mother' | 'guardian';
  };
}

export interface BatchCreateResult {
  success: boolean;
  totalStudents: number;
  createdStudents: number;
  createdParents: number;
  errors: Array<{
    index: number;
    type: string;
    name: string;
    error: string;
  }>;
}

export const batchCreateStudents = async (students: BatchStudentData[]): Promise<BatchCreateResult> => {
  try {
    const batchCreateFn = httpsCallable<
      { students: BatchStudentData[] },
      BatchCreateResult
    >(functions, 'batchCreateStudents');
    const result = await batchCreateFn({ students });
    return result.data;
  } catch (error: unknown) {
    console.error('Error calling batchCreateStudents:', error);
    return {
      success: false,
      totalStudents: students.length,
      createdStudents: 0,
      createdParents: 0,
      errors: [{ index: -1, type: 'general', name: '', error: (error as Error).message }]
    };
  }
};

// 학생+부모 일괄 삭제 결과 타입
export interface BatchDeleteResult {
  success: boolean;
  totalStudents: number;
  deletedStudents: number;
  deletedParents: number;
  deletedAuthUsers: number;
  errors: Array<{
    index?: number;
    type: string;
    id?: string;
    error: string;
  }>;
}

// 학생+부모 일괄 삭제 (서버에서 처리)
export const batchDeleteStudents = async (
  studentIds: string[],
  deleteParents: boolean = false
): Promise<BatchDeleteResult> => {
  try {
    const batchDeleteFn = httpsCallable<
      { studentIds: string[]; deleteParents: boolean },
      BatchDeleteResult
    >(functions, 'batchDeleteStudents');
    const result = await batchDeleteFn({ studentIds, deleteParents });
    return result.data;
  } catch (error: unknown) {
    console.error('Error calling batchDeleteStudents:', error);
    return {
      success: false,
      totalStudents: studentIds.length,
      deletedStudents: 0,
      deletedParents: 0,
      deletedAuthUsers: 0,
      errors: [{ type: 'general', error: (error as Error).message }]
    };
  }
};

// 복원용 학생 데이터 타입
export interface RestoreStudentData {
  id?: string;
  name: string;
  phone?: string;
  birthDate?: string;
  gender?: 'male' | 'female';
  school?: string;
  grade?: string;
  address?: string;
  notes?: string;
  status?: string;
  inviteCode?: string;
  parentIds?: string[];
  // 보호자 정보 (단일 시트에서 읽어온 값)
  parentName?: string;
  parentPhone?: string;
}

// 복원용 부모 데이터 타입
export interface RestoreParentData {
  id: string;
  name: string;
  phone?: string;
  relationType?: 'father' | 'mother' | 'guardian';
}

// 일괄 복원 결과 타입
export interface BatchRestoreResult {
  success: boolean;
  totalStudents: number;
  totalParents: number;
  createdStudents: number;
  createdParents: number;
  createdAuthUsers: number;
  linkedParentStudent?: number;
  errors: Array<{
    index: number;
    type: string;
    name: string;
    error: string;
  }>;
}

// 부모-자녀 매핑 타입 (부모 전화번호 -> 자녀 이름 배열)
export type ParentChildMap = Record<string, string[]>;

// 학생+부모 일괄 복원 (서버에서 처리)
export const batchRestoreStudents = async (
  students: RestoreStudentData[],
  parents: RestoreParentData[] = [],
  parentChildMap: ParentChildMap = {}
): Promise<BatchRestoreResult> => {
  try {
    const batchRestoreFn = httpsCallable<
      { students: RestoreStudentData[]; parents: RestoreParentData[]; parentChildMap: ParentChildMap },
      BatchRestoreResult
    >(functions, 'batchRestoreStudents');
    const result = await batchRestoreFn({ students, parents, parentChildMap });
    return result.data;
  } catch (error: unknown) {
    console.error('Error calling batchRestoreStudents:', error);
    return {
      success: false,
      totalStudents: students.length,
      totalParents: parents.length,
      createdStudents: 0,
      createdParents: 0,
      createdAuthUsers: 0,
      linkedParentStudent: 0,
      errors: [{ index: -1, type: 'general', name: '', error: (error as Error).message }]
    };
  }
};

// 보호자 일괄 삭제 결과 타입
export interface BatchDeleteParentsResult {
  success: boolean;
  totalParents: number;
  deletedParents: number;
  deletedAuthUsers: number;
  updatedStudents: number;
  errors: Array<{
    type: string;
    id?: string;
    error: string;
  }>;
}

// 보호자 일괄 삭제 (서버에서 처리)
export const batchDeleteParents = async (
  parentIds: string[]
): Promise<BatchDeleteParentsResult> => {
  try {
    const batchDeleteFn = httpsCallable<
      { parentIds: string[] },
      BatchDeleteParentsResult
    >(functions, 'batchDeleteParents');
    const result = await batchDeleteFn({ parentIds });
    return result.data;
  } catch (error: unknown) {
    console.error('Error calling batchDeleteParents:', error);
    return {
      success: false,
      totalParents: parentIds.length,
      deletedParents: 0,
      deletedAuthUsers: 0,
      updatedStudents: 0,
      errors: [{ type: 'general', error: (error as Error).message }]
    };
  }
};

// 모든 학부모 계정 삭제 (임시 유틸리티)
export const deleteAllGuardians = async (): Promise<{
  success: boolean;
  deletedAuthUsers: number;
  deletedParentDocs: number;
  deletedAuthMappings: number;
  errors: Array<{ error: string }>;
}> => {
  try {
    const deleteGuardiansFn = httpsCallable<
      Record<string, never>,
      {
        success: boolean;
        deletedAuthUsers: number;
        deletedParentDocs: number;
        deletedAuthMappings: number;
        errors: Array<{ error: string }>;
      }
    >(functions, 'deleteAllGuardians');
    const result = await deleteGuardiansFn({});
    return result.data;
  } catch (error: unknown) {
    console.error('Error calling deleteAllGuardians:', error);
    return {
      success: false,
      deletedAuthUsers: 0,
      deletedParentDocs: 0,
      deletedAuthMappings: 0,
      errors: [{ error: (error as Error).message }]
    };
  }
};

// 관리자 세션을 유지하면서 새 사용자 계정을 생성하기 위한 함수
// 보조 Firebase 앱을 사용하여 계정 생성 후 바로 삭제
export const createUserWithoutSignIn = async (email: string, password: string): Promise<string> => {
  // 기존 보조 앱이 있으면 삭제
  const existingApps = getApps();
  const secondaryApp = existingApps.find(a => a.name === 'Secondary');
  if (secondaryApp) {
    await deleteApp(secondaryApp);
  }

  // 보조 앱 생성
  const tempApp = initializeApp(firebaseConfig, 'Secondary');
  const tempAuth = getAuth(tempApp);

  try {
    // 보조 앱에서 계정 생성
    const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
    const uid = userCredential.user.uid;

    // 보조 앱에서 로그아웃 후 삭제
    await tempAuth.signOut();
    await deleteApp(tempApp);

    return uid;
  } catch (error) {
    // 오류 발생 시에도 보조 앱 정리
    try {
      await deleteApp(tempApp);
    } catch {
      // 무시
    }
    throw error;
  }
};

// Initialize Firestore with persistent cache and experimental long polling for better connectivity
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  }),
  experimentalForceLongPolling: true
});

// FCM 메시징 (브라우저 지원 확인 후 초기화)
let messaging: ReturnType<typeof getMessaging> | null = null;

export const initMessaging = async () => {
  const supported = await isSupported();
  if (supported) {
    messaging = getMessaging(app);
  }
  return messaging;
};

export const getMessagingInstance = () => messaging;

// FCM 토큰 가져오기
export const getFCMToken = async (): Promise<string | null> => {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.log('FCM not supported in this browser');
      return null;
    }

    if (!messaging) {
      messaging = getMessaging(app);
    }

    // 알림 권한 요청
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    // VAPID 키로 토큰 가져오기
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
    });

    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

// 포그라운드 메시지 리스너
export const onForegroundMessage = (callback: (payload: unknown) => void) => {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
};

// Note: Offline persistence is now configured via initializeFirestore above
// using persistentLocalCache with persistentMultipleTabManager for multi-tab support

export default app;
