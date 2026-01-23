import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword
} from 'firebase/auth';
import { db, auth, createUserWithoutSignIn } from '../lib/firebase';

// 도메인 설정 (나중에 환경변수로 변경 가능)
const EMAIL_DOMAIN = 'aniwid.com';

// 인증번호 유효 시간 (5분)
const VERIFICATION_CODE_EXPIRY_MINUTES = 5;

// 전화번호를 정규화 (숫자만 추출)
export const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  return phone.replace(/[^0-9]/g, '');
};

// 전화번호 유효성 검사
export const isValidPhone = (phone: string): boolean => {
  const cleanPhone = normalizePhone(phone);
  // 한국 휴대폰 번호: 010, 011, 016, 017, 018, 019로 시작하는 10-11자리
  return /^01[0-9]{8,9}$/.test(cleanPhone);
};

// 전화번호 포맷팅 (010-1234-5678)
export const formatPhone = (phone: string): string => {
  const cleanPhone = normalizePhone(phone);
  if (cleanPhone.length === 11) {
    return `${cleanPhone.slice(0, 3)}-${cleanPhone.slice(3, 7)}-${cleanPhone.slice(7)}`;
  } else if (cleanPhone.length === 10) {
    return `${cleanPhone.slice(0, 3)}-${cleanPhone.slice(3, 6)}-${cleanPhone.slice(6)}`;
  }
  return phone;
};

// 학생용 이메일 생성
export const generateStudentEmail = (phone: string): string => {
  const cleanPhone = normalizePhone(phone);
  return `student_${cleanPhone}@${EMAIL_DOMAIN}`;
};

// 보호자용 이메일 생성
export const generateGuardianEmail = (phone: string): string => {
  const cleanPhone = normalizePhone(phone);
  return `guardian_${cleanPhone}@${EMAIL_DOMAIN}`;
};

// 6자리 랜덤 인증번호 생성
export const generateVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// 인증번호 요청 결과 타입
interface VerificationResult {
  success: boolean;
  mockCode?: string; // 목업 모드에서만 반환
  error?: string;
  userType?: 'student' | 'guardian';
  userName?: string;
}

// 사용자 정보 조회 결과 타입
interface UserInfo {
  userType: 'student' | 'guardian';
  firestoreId: string;
  email: string;
  name: string;
  firebaseUid?: string;
}

export const authService = {
  // 전화번호로 사용자 조회
  async findUserByPhone(phone: string): Promise<UserInfo | null> {
    if (!phone) return null;

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) return null;

    // 검색할 전화번호 형식들 (숫자만, 하이픈 포함)
    const phoneFormats = [
      cleanPhone,
      formatPhone(cleanPhone),
      phone // 원본 형식도 시도
    ];
    // 중복 제거
    const uniquePhones = [...new Set(phoneFormats)];

    // authMappings 컬렉션에서 조회 (새 형식: student_, guardian_ 접두사)
    // 학생 먼저 조회
    const studentMappingDoc = await getDoc(doc(db, 'authMappings', `student_${cleanPhone}`));
    if (studentMappingDoc.exists()) {
      const data = studentMappingDoc.data();
      return {
        userType: data.userType,
        firestoreId: data.firestoreId,
        email: data.email,
        name: data.name || '',
        firebaseUid: data.firebaseUid
      };
    }

    // 보호자 조회
    const guardianMappingDoc = await getDoc(doc(db, 'authMappings', `guardian_${cleanPhone}`));
    if (guardianMappingDoc.exists()) {
      const data = guardianMappingDoc.data();
      return {
        userType: data.userType,
        firestoreId: data.firestoreId,
        email: data.email,
        name: data.name || '',
        firebaseUid: data.firebaseUid
      };
    }

    // 레거시: 접두사 없이 저장된 authMappings 조회
    const mappingDoc = await getDoc(doc(db, 'authMappings', cleanPhone));
    if (mappingDoc.exists()) {
      const data = mappingDoc.data();
      return {
        userType: data.userType,
        firestoreId: data.firestoreId,
        email: data.email,
        name: data.name || '',
        firebaseUid: data.firebaseUid
      };
    }

    // 레거시: students 컬렉션에서 직접 조회 (여러 형식 시도)
    for (const phoneFormat of uniquePhones) {
      const studentsQuery = query(
        collection(db, 'students'),
        where('phone', '==', phoneFormat)
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      if (!studentsSnapshot.empty) {
        const studentDoc = studentsSnapshot.docs[0];
        const studentData = studentDoc.data();
        return {
          userType: 'student',
          firestoreId: studentDoc.id,
          email: studentData.email || generateStudentEmail(phone),
          name: studentData.name || '',
          firebaseUid: studentData.userId
        };
      }
    }

    // 레거시: parents 컬렉션에서 직접 조회 (여러 형식 시도)
    for (const phoneFormat of uniquePhones) {
      const parentsQuery = query(
        collection(db, 'parents'),
        where('phone', '==', phoneFormat)
      );
      const parentsSnapshot = await getDocs(parentsQuery);
      if (!parentsSnapshot.empty) {
        const parentDoc = parentsSnapshot.docs[0];
        const parentData = parentDoc.data();
        return {
          userType: 'guardian',
          firestoreId: parentDoc.id,
          email: parentData.email || generateGuardianEmail(phone),
          name: parentData.name || '',
          firebaseUid: parentData.userId
        };
      }
    }

    return null;
  },

  // 인증번호 요청 (목업: 화면에 표시, 실제: SMS 발송)
  async requestVerificationCode(phone: string): Promise<VerificationResult> {
    // 전화번호 유효성 검사
    if (!phone || !phone.trim()) {
      return {
        success: false,
        error: '전화번호를 입력해주세요.'
      };
    }

    if (!isValidPhone(phone)) {
      return {
        success: false,
        error: '올바른 전화번호 형식이 아닙니다.'
      };
    }

    const cleanPhone = normalizePhone(phone);

    // 1. 사용자 존재 확인
    const userInfo = await this.findUserByPhone(phone);
    if (!userInfo) {
      return {
        success: false,
        error: '등록되지 않은 번호입니다. 관리자에게 문의하세요.'
      };
    }

    // 2. 6자리 인증번호 생성
    const code = generateVerificationCode();

    // 3. Firestore에 인증번호 저장 (5분 유효)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + VERIFICATION_CODE_EXPIRY_MINUTES);

    await setDoc(doc(db, 'verificationCodes', cleanPhone), {
      code,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt)
    });

    // 4. 목업 모드: 인증번호 반환 (실제 운영 시 SMS 발송으로 변경)
    return {
      success: true,
      mockCode: code, // 목업에서만 반환
      userType: userInfo.userType,
      userName: userInfo.name
    };
  },

  // 인증번호 검증
  async verifyCode(phone: string, inputCode: string): Promise<boolean> {
    const cleanPhone = normalizePhone(phone);

    const codeDoc = await getDoc(doc(db, 'verificationCodes', cleanPhone));
    if (!codeDoc.exists()) {
      return false;
    }

    const data = codeDoc.data();
    const expiresAt = (data.expiresAt as Timestamp).toDate();

    // 만료 확인
    if (new Date() > expiresAt) {
      // 만료된 인증번호 삭제
      await deleteDoc(doc(db, 'verificationCodes', cleanPhone));
      return false;
    }

    // 코드 일치 확인
    if (data.code !== inputCode) {
      return false;
    }

    // 사용된 인증번호 삭제
    await deleteDoc(doc(db, 'verificationCodes', cleanPhone));
    return true;
  },

  // 인증번호 검증 후 로그인
  async verifyAndLogin(phone: string, inputCode: string): Promise<{ success: boolean; error?: string }> {
    // 1. 인증번호 검증
    const isValid = await this.verifyCode(phone, inputCode);
    if (!isValid) {
      return { success: false, error: '인증번호가 일치하지 않거나 만료되었습니다.' };
    }

    // 2. 사용자 정보 조회
    const userInfo = await this.findUserByPhone(phone);
    if (!userInfo) {
      return { success: false, error: '사용자 정보를 찾을 수 없습니다.' };
    }

    // 3. Firebase 로그인 시도 (여러 이메일 형식 지원)
    const cleanPhone = normalizePhone(phone);

    // 시도할 이메일 형식들 (새 형식 먼저, 레거시 형식 나중에)
    const emailsToTry = [
      userInfo.email, // authMappings 또는 Firestore에서 가져온 이메일
      generateStudentEmail(phone), // student_01012345678@aniwid.com
      generateGuardianEmail(phone), // guardian_01012345678@aniwid.com
      `${cleanPhone}@phone.local`, // 레거시 형식
    ];

    // 비밀번호 시도 순서 (전화번호, 하이픈 포함 전화번호)
    const passwordsToTry = [cleanPhone];
    // 하이픈 포함 형식도 시도 (010-1234-5678)
    if (cleanPhone.length === 11) {
      passwordsToTry.push(`${cleanPhone.slice(0, 3)}-${cleanPhone.slice(3, 7)}-${cleanPhone.slice(7)}`);
    }

    for (const email of emailsToTry) {
      for (const password of passwordsToTry) {
        try {
          await signInWithEmailAndPassword(auth, email, password);
          return { success: true };
        } catch (error: any) {
          // 다음 조합 시도
          continue;
        }
      }
    }

    // 모든 시도 실패
    console.error('All login attempts failed for phone:', phone);
    return { success: false, error: '로그인에 실패했습니다. 관리자에게 문의하세요.' };
  },

  // 학생 계정 생성 (관리자가 등록 시 호출)
  async createStudentAccount(
    phone: string,
    name: string,
    firestoreId: string
  ): Promise<{ success: boolean; firebaseUid?: string; email?: string; error?: string }> {
    // 전화번호 유효성 검사
    if (!phone || !phone.trim()) {
      return { success: false, error: '전화번호가 필요합니다.' };
    }

    if (!isValidPhone(phone)) {
      return { success: false, error: '올바른 전화번호 형식이 아닙니다.' };
    }

    if (!firestoreId) {
      return { success: false, error: '학생 ID가 필요합니다.' };
    }

    const cleanPhone = normalizePhone(phone);
    const email = generateStudentEmail(phone);
    const password = cleanPhone; // 비밀번호 = 전화번호

    try {
      // Firebase Auth 계정 생성 (관리자 세션 유지)
      const firebaseUid = await createUserWithoutSignIn(email, password);

      // authMappings에 매핑 정보 저장 (student_ 접두사로 구분)
      await setDoc(doc(db, 'authMappings', `student_${cleanPhone}`), {
        userType: 'student',
        firestoreId,
        firebaseUid,
        email,
        name: name || '',
        createdAt: serverTimestamp()
      });

      // 레거시 호환: 전화번호만으로도 조회 가능하도록 (덮어쓰기 주의)
      // await setDoc(doc(db, 'authMappings', cleanPhone), {...}, { merge: true });

      return { success: true, firebaseUid, email };
    } catch (error: any) {
      console.error('Create student account error:', error);
      if (error.code === 'auth/email-already-in-use') {
        return { success: false, error: '이미 등록된 전화번호입니다.' };
      }
      if (error.code === 'auth/weak-password') {
        return { success: false, error: '비밀번호가 너무 짧습니다.' };
      }
      if (error.code === 'auth/invalid-email') {
        return { success: false, error: '이메일 형식 오류가 발생했습니다.' };
      }
      return { success: false, error: `계정 생성 중 오류가 발생했습니다: ${error.message}` };
    }
  },

  // 보호자 계정 생성 (관리자가 등록 시 호출)
  async createGuardianAccount(
    phone: string,
    name: string,
    firestoreId: string
  ): Promise<{ success: boolean; firebaseUid?: string; email?: string; error?: string }> {
    // 전화번호 유효성 검사
    if (!phone || !phone.trim()) {
      return { success: false, error: '전화번호가 필요합니다.' };
    }

    if (!isValidPhone(phone)) {
      return { success: false, error: '올바른 전화번호 형식이 아닙니다.' };
    }

    if (!firestoreId) {
      return { success: false, error: '보호자 ID가 필요합니다.' };
    }

    const cleanPhone = normalizePhone(phone);
    const email = generateGuardianEmail(phone);
    const password = cleanPhone; // 비밀번호 = 전화번호

    try {
      // Firebase Auth 계정 생성 (관리자 세션 유지)
      const firebaseUid = await createUserWithoutSignIn(email, password);

      // authMappings에 매핑 정보 저장 (guardian_ 접두사로 구분)
      await setDoc(doc(db, 'authMappings', `guardian_${cleanPhone}`), {
        userType: 'guardian',
        firestoreId,
        firebaseUid,
        email,
        name: name || '',
        createdAt: serverTimestamp()
      });

      return { success: true, firebaseUid, email };
    } catch (error: any) {
      console.error('Create guardian account error:', error);
      if (error.code === 'auth/email-already-in-use') {
        return { success: false, error: '이미 등록된 전화번호입니다.' };
      }
      if (error.code === 'auth/weak-password') {
        return { success: false, error: '비밀번호가 너무 짧습니다.' };
      }
      if (error.code === 'auth/invalid-email') {
        return { success: false, error: '이메일 형식 오류가 발생했습니다.' };
      }
      return { success: false, error: `계정 생성 중 오류가 발생했습니다: ${error.message}` };
    }
  },

  // 전화번호로 보호자 존재 여부 확인
  async checkGuardianExists(phone: string): Promise<{
    exists: boolean;
    guardianId?: string;
    name?: string;
    studentIds?: string[];
  }> {
    const cleanPhone = normalizePhone(phone);

    // authMappings에서 먼저 조회 (새 형식: guardian_ 접두사)
    const guardianMappingDoc = await getDoc(doc(db, 'authMappings', `guardian_${cleanPhone}`));
    if (guardianMappingDoc.exists()) {
      const data = guardianMappingDoc.data();
      // parents 컬렉션에서 추가 정보 조회
      const parentDoc = await getDoc(doc(db, 'parents', data.firestoreId));
      if (parentDoc.exists()) {
        const parentData = parentDoc.data();
        return {
          exists: true,
          guardianId: data.firestoreId,
          name: parentData.name,
          studentIds: parentData.studentIds || []
        };
      }
    }

    // 레거시: 접두사 없는 authMappings 조회
    const mappingDoc = await getDoc(doc(db, 'authMappings', cleanPhone));
    if (mappingDoc.exists() && mappingDoc.data().userType === 'guardian') {
      const data = mappingDoc.data();
      // parents 컬렉션에서 추가 정보 조회
      const parentDoc = await getDoc(doc(db, 'parents', data.firestoreId));
      if (parentDoc.exists()) {
        const parentData = parentDoc.data();
        return {
          exists: true,
          guardianId: data.firestoreId,
          name: parentData.name,
          studentIds: parentData.studentIds || []
        };
      }
    }

    // 레거시: parents 컬렉션에서 직접 조회
    const parentsQuery = query(
      collection(db, 'parents'),
      where('phone', '==', phone)
    );
    const snapshot = await getDocs(parentsQuery);
    if (!snapshot.empty) {
      const parentDoc = snapshot.docs[0];
      const parentData = parentDoc.data();
      return {
        exists: true,
        guardianId: parentDoc.id,
        name: parentData.name,
        studentIds: parentData.studentIds || []
      };
    }

    return { exists: false };
  }
};
