import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { studentService } from '../services/studentService';
import { parentService } from '../services/parentService';
import type { UserRole, Student, Parent } from '../types';

// 핸드폰 번호를 이메일 형식으로 변환 (Firebase Auth는 이메일 형식 필요)
const phoneToEmail = (phone: string): string => {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  return `${cleanPhone}@phone.local`;
};

interface AdminData {
  email: string;
  name: string;
  role: 'admin' | 'superadmin';
}

interface AuthContextType {
  user: User | null;
  userRole: UserRole | null;
  adminData: AdminData | null;
  studentData: Student | null;
  parentData: Parent | null;
  isAdmin: boolean;
  isStudent: boolean;
  isParent: boolean;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<UserRole>;
  loginAsStudent: (phone: string, password: string) => Promise<void>;
  loginAsParent: (phone: string, password: string) => Promise<void>;
  loginAsAdmin: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  registerStudent: (phone: string, password: string, name: string, inviteCode: string) => Promise<void>;
  registerParent: (phone: string, password: string, name: string, inviteCode: string) => Promise<void>;
  addChildToParent: (inviteCode: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [studentData, setStudentData] = useState<Student | null>(null);
  const [parentData, setParentData] = useState<Parent | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 사용자 역할 확인 함수
  const checkUserRole = async (uid: string): Promise<{
    role: UserRole | null;
    adminData: AdminData | null;
    studentData: Student | null;
    parentData: Parent | null;
  }> => {
    // 1. 관리자 확인
    const adminDoc = await getDoc(doc(db, 'admins', uid));
    if (adminDoc.exists()) {
      return {
        role: 'admin',
        adminData: adminDoc.data() as AdminData,
        studentData: null,
        parentData: null
      };
    }

    // 2. 학생 확인
    const student = await studentService.getByUserId(uid);
    if (student) {
      return {
        role: 'student',
        adminData: null,
        studentData: student,
        parentData: null
      };
    }

    // 3. 부모 확인
    const parent = await parentService.getByUserId(uid);
    if (parent) {
      return {
        role: 'parent',
        adminData: null,
        studentData: null,
        parentData: parent
      };
    }

    return { role: null, adminData: null, studentData: null, parentData: null };
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const { role, adminData, studentData, parentData } = await checkUserRole(user.uid);
          setUserRole(role);
          setAdminData(adminData);
          setStudentData(studentData);
          setParentData(parentData);
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUserRole(null);
          setAdminData(null);
          setStudentData(null);
          setParentData(null);
        }
      } else {
        setUserRole(null);
        setAdminData(null);
        setStudentData(null);
        setParentData(null);
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  // 일반 로그인 (역할 자동 감지) - 핸드폰 번호 사용
  const login = async (phone: string, password: string): Promise<UserRole> => {
    const email = phoneToEmail(phone);
    const result = await signInWithEmailAndPassword(auth, email, password);
    const { role } = await checkUserRole(result.user.uid);
    if (!role) {
      await signOut(auth);
      throw new Error('등록된 계정이 아닙니다.');
    }
    return role;
  };

  // 학생 전용 로그인 - 핸드폰 번호 사용
  const loginAsStudent = async (phone: string, password: string) => {
    const email = phoneToEmail(phone);
    const result = await signInWithEmailAndPassword(auth, email, password);
    const student = await studentService.getByUserId(result.user.uid);
    if (!student) {
      await signOut(auth);
      throw new Error('학생 계정이 아닙니다.');
    }
  };

  // 부모 전용 로그인 - 핸드폰 번호 사용
  const loginAsParent = async (phone: string, password: string) => {
    const email = phoneToEmail(phone);
    const result = await signInWithEmailAndPassword(auth, email, password);
    const parent = await parentService.getByUserId(result.user.uid);
    if (!parent) {
      await signOut(auth);
      throw new Error('부모 계정이 아닙니다.');
    }
  };

  // 관리자 전용 로그인
  const loginAsAdmin = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const adminDoc = await getDoc(doc(db, 'admins', result.user.uid));
    if (!adminDoc.exists()) {
      await signOut(auth);
      throw new Error('관리자 권한이 없습니다.');
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  // 관리자 등록 (기존)
  const register = async (email: string, password: string, name: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'admins', result.user.uid), {
      email,
      name,
      role: 'admin',
      createdAt: serverTimestamp()
    });
    setAdminData({ email, name, role: 'admin' });
    setUserRole('admin');
  };

  // 학생 등록 (초대 코드로) - 핸드폰 번호 사용
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const registerStudent = async (phone: string, password: string, _name: string, inviteCode: string) => {
    // 초대 코드로 학생 찾기
    const student = await studentService.getByInviteCode(inviteCode);
    if (!student) {
      throw new Error('유효하지 않은 초대 코드입니다.');
    }
    if (student.userId) {
      throw new Error('이미 계정이 연결된 학생입니다.');
    }

    // Firebase Auth 계정 생성 (핸드폰 번호를 이메일 형식으로 변환)
    const email = phoneToEmail(phone);
    const result = await createUserWithEmailAndPassword(auth, email, password);

    // 학생 문서에 userId 및 핸드폰 번호 연결
    await studentService.linkUserAccount(student.id, result.user.uid, phone);

    setStudentData({ ...student, userId: result.user.uid, phone });
    setUserRole('student');
  };

  // 부모 등록 (초대 코드로) - 핸드폰 번호 사용
  const registerParent = async (phone: string, password: string, name: string, inviteCode: string) => {
    // 초대 코드로 학생 찾기
    const student = await studentService.getByInviteCode(inviteCode);
    if (!student) {
      throw new Error('유효하지 않은 초대 코드입니다.');
    }

    // Firebase Auth 계정 생성 (핸드폰 번호를 이메일 형식으로 변환)
    const email = phoneToEmail(phone);
    const result = await createUserWithEmailAndPassword(auth, email, password);

    // 부모 문서 생성
    const parentId = await parentService.create({
      userId: result.user.uid,
      name,
      email,
      phone,
      studentIds: [student.id]
    });

    // 학생 문서에 부모 ID 추가
    await studentService.addParent(student.id, parentId);

    const newParentData: Parent = {
      id: parentId,
      userId: result.user.uid,
      name,
      email,
      phone,
      studentIds: [student.id],
      createdAt: new Date().toISOString()
    };

    setParentData(newParentData);
    setUserRole('parent');
  };

  // 기존 부모 계정에 자녀 추가
  const addChildToParent = async (inviteCode: string) => {
    if (!user || !parentData) {
      throw new Error('로그인이 필요합니다.');
    }

    // 초대 코드로 학생 찾기
    const student = await studentService.getByInviteCode(inviteCode);
    if (!student) {
      throw new Error('유효하지 않은 초대 코드입니다.');
    }

    // 이미 연결된 자녀인지 확인
    if (parentData.studentIds.includes(student.id)) {
      throw new Error('이미 등록된 자녀입니다.');
    }

    // 부모 문서에 자녀 추가
    await parentService.addStudent(parentData.id, student.id);

    // 학생 문서에 부모 ID 추가
    await studentService.addParent(student.id, parentData.id);

    // 로컬 상태 업데이트
    setParentData({
      ...parentData,
      studentIds: [...parentData.studentIds, student.id]
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      userRole,
      adminData,
      studentData,
      parentData,
      isAdmin: userRole === 'admin',
      isStudent: userRole === 'student',
      isParent: userRole === 'parent',
      isLoading,
      login,
      loginAsStudent,
      loginAsParent,
      loginAsAdmin,
      logout,
      register,
      registerStudent,
      registerParent,
      addChildToParent
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
