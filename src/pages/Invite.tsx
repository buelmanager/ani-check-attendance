import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { studentService } from '../services/studentService';
import type { Student } from '../types';

type RegisterMode = 'select' | 'student' | 'parent' | 'parent-login' | 'parent-add-child';

export default function Invite() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { registerStudent, registerParent, loginAsParent, addChildToParent, isStudent, isParent, parentData, isLoading: authLoading } = useAuth();

  const [student, setStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<RegisterMode>('select');

  // 회원가입 폼
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 핸드폰 번호 포맷팅 (010-1234-5678)
  const formatPhone = (value: string) => {
    const numbers = value.replace(/[^0-9]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  useEffect(() => {
    const fetchStudent = async () => {
      if (!code) {
        setError('유효하지 않은 초대 링크입니다.');
        setIsLoading(false);
        return;
      }

      try {
        const foundStudent = await studentService.getByInviteCode(code);
        if (foundStudent) {
          setStudent(foundStudent);
        } else {
          setError('유효하지 않은 초대 코드입니다.');
        }
      } catch (err) {
        console.error('Error fetching student:', err);
        setError('초대 코드를 확인하는 중 오류가 발생했습니다.');
      }
      setIsLoading(false);
    };

    fetchStudent();
  }, [code]);

  // 로그인 상태면 리다이렉트 (단, 부모가 자녀 추가하러 왔을 때는 예외)
  useEffect(() => {
    if (!authLoading) {
      if (isStudent) {
        navigate('/student');
      } else if (isParent && mode !== 'select' && mode !== 'parent-add-child') {
        // 부모가 이미 로그인되어 있고 자녀 추가 모드가 아니면 자녀 추가 모드로
        setMode('parent-add-child');
      }
    }
  }, [isStudent, isParent, authLoading, navigate, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanPhone = phone.replace(/[^0-9]/g, '');

    // 부모 로그인 모드
    if (mode === 'parent-login') {
      if (cleanPhone.length < 10) {
        setError('핸드폰 번호를 정확히 입력해주세요.');
        return;
      }
      if (!password) {
        setError('비밀번호를 입력해주세요.');
        return;
      }

      setIsSubmitting(true);
      try {
        await loginAsParent(phone, password);
        // 로그인 후 자녀 추가 모드로
        setMode('parent-add-child');
      } catch (err: any) {
        console.error('Login error:', err);
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
          setError('핸드폰 번호 또는 비밀번호가 올바르지 않습니다.');
        } else {
          setError(err.message || '로그인 중 오류가 발생했습니다.');
        }
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // 기존 가입 로직
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    if (cleanPhone.length < 10) {
      setError('핸드폰 번호를 정확히 입력해주세요.');
      return;
    }

    if (!code) return;

    setIsSubmitting(true);

    try {
      if (mode === 'student') {
        await registerStudent(phone, password, name, code);
        navigate('/student');
      } else if (mode === 'parent') {
        await registerParent(phone, password, name, code);
        navigate('/parent');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('이미 사용 중인 핸드폰 번호입니다. 기존 계정으로 로그인해주세요.');
      } else if (err.code === 'auth/weak-password') {
        setError('비밀번호가 너무 약합니다.');
      } else {
        setError(err.message || '회원가입 중 오류가 발생했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 자녀 추가 처리
  const handleAddChild = async () => {
    if (!code) return;
    setError('');
    setIsSubmitting(true);

    try {
      await addChildToParent(code);
      navigate('/parent');
    } catch (err: any) {
      console.error('Add child error:', err);
      setError(err.message || '자녀 추가 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/70">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error && !student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">오류</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary w-full"
          >
            홈으로 이동
          </button>
        </div>
      </div>
    );
  }

  // 역할 선택 화면
  if (mode === 'select') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">CheckMate 가입하기</h1>
            <p className="text-gray-600">학생: <span className="font-semibold text-primary">{student?.name}</span></p>
          </div>

          <div className="space-y-4">
            {/* 학생 계정이 아직 연결되지 않았을 때만 학생 가입 버튼 표시 */}
            {!student?.userId && (
              <button
                onClick={() => setMode('student')}
                className="w-full p-4 bg-blue-50 hover:bg-blue-100 rounded-xl border-2 border-blue-200 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">학생으로 가입</h3>
                    <p className="text-sm text-gray-600">QR 출석, 스케줄 확인, 공지 확인</p>
                  </div>
                </div>
              </button>
            )}

            {student?.userId && (
              <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200 text-center">
                <p className="text-gray-500 text-sm">학생 계정은 이미 등록되었습니다</p>
              </div>
            )}

            <button
              onClick={() => setMode('parent')}
              className="w-full p-4 bg-green-50 hover:bg-green-100 rounded-xl border-2 border-green-200 transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">부모로 새로 가입</h3>
                  <p className="text-sm text-gray-600">처음 가입하는 경우</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode('parent-login')}
              className="w-full p-4 bg-amber-50 hover:bg-amber-100 rounded-xl border-2 border-amber-200 transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">기존 부모 계정으로 자녀 추가</h3>
                  <p className="text-sm text-gray-600">이미 부모 계정이 있는 경우</p>
                </div>
              </div>
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              학생 계정이 있으신가요?{' '}
              <button
                onClick={() => navigate('/student/login')}
                className="text-accent font-semibold hover:underline"
              >
                학생 로그인
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 부모 자녀 추가 확인 화면 (이미 로그인된 부모)
  if (mode === 'parent-add-child') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">자녀 추가</h1>
            <p className="text-gray-600">
              <span className="font-semibold text-green-600">{parentData?.name}</span>님의 계정에
            </p>
            <p className="text-gray-600">
              <span className="font-semibold text-primary">{student?.name}</span> 학생을 추가합니다
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleAddChild}
              disabled={isSubmitting}
              className="w-full py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-colors"
            >
              {isSubmitting ? '처리 중...' : '자녀 추가하기'}
            </button>
            <button
              onClick={() => navigate('/parent')}
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 부모 로그인 폼 (기존 계정에 자녀 추가)
  if (mode === 'parent-login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full">
          <button
            onClick={() => setMode('select')}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            뒤로
          </button>

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">부모 로그인</h1>
            <p className="text-gray-600">
              기존 계정에 <span className="font-semibold text-primary">{student?.name}</span> 학생을 추가합니다
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">핸드폰 번호 (아이디)</label>
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                className="input-field"
                placeholder="010-0000-0000"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="비밀번호"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold transition-colors"
            >
              {isSubmitting ? '로그인 중...' : '로그인 후 자녀 추가'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">
              계정이 없으신가요?{' '}
              <button
                onClick={() => setMode('parent')}
                className="text-green-600 font-semibold hover:underline"
              >
                새로 가입하기
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 회원가입 폼
  return (
    <div className="min-h-screen flex items-center justify-center bg-primary p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full">
        <button
          onClick={() => setMode('select')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          뒤로
        </button>

        <div className="text-center mb-8">
          <div className={`w-16 h-16 ${mode === 'student' ? 'bg-blue-100' : 'bg-green-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
            {mode === 'student' ? (
              <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {mode === 'student' ? '학생 회원가입' : '부모 회원가입'}
          </h1>
          <p className="text-gray-600">학생: <span className="font-semibold">{student?.name}</span></p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              placeholder={mode === 'student' ? '학생 이름' : '부모님 성함'}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">핸드폰 번호 (아이디)</label>
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              className="input-field"
              placeholder="010-0000-0000"
              required
            />
            <p className="text-xs text-gray-500 mt-1">로그인 시 아이디로 사용됩니다</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="6자 이상"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-field"
              placeholder="비밀번호 재입력"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`btn-primary w-full ${mode === 'student' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-green-500 hover:bg-green-600'}`}
          >
            {isSubmitting ? '처리 중...' : '가입하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
