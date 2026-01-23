import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

type LoginStep = 'phone' | 'verification';

export default function StudentLogin() {
  const navigate = useNavigate();
  const { requestVerificationCode, loginWithVerificationCode, isStudent, isLoading } = useAuth();

  const [step, setStep] = useState<LoginStep>('phone');
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [mockCode, setMockCode] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isStudent) {
      navigate('/student');
    }
  }, [isStudent, isLoading, navigate]);

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

  // 인증번호 요청
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const result = await requestVerificationCode(phone);
      if (result.success) {
        setStep('verification');
        if (result.mockCode) {
          setMockCode(result.mockCode);
        }
        if (result.userName) {
          setUserName(result.userName);
        }
        // 학생 타입 확인
        if (result.userType !== 'student') {
          setError('학생 계정이 아닙니다. 부모 로그인 페이지를 이용해주세요.');
          setStep('phone');
          return;
        }
      } else {
        setError(result.error || '인증번호 요청에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('Verification code error:', err);
      setError('인증번호 요청 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 인증번호 확인 및 로그인
  const handleVerifyAndLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const result = await loginWithVerificationCode(phone, verificationCode);
      if (result.success) {
        navigate('/student');
      } else {
        setError(result.error || '로그인에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError('로그인 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 뒤로 가기
  const handleBack = () => {
    setStep('phone');
    setVerificationCode('');
    setMockCode(null);
    setError('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/70">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">학생 로그인</h1>
          <p className="text-gray-500 mt-2">CheckMate 출결 관리</p>
        </div>

        {step === 'phone' ? (
          // Step 1: 전화번호 입력
          <form onSubmit={handleRequestCode} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">핸드폰 번호</label>
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                className="input-field"
                placeholder="010-0000-0000"
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
              className="btn-primary w-full bg-blue-500 hover:bg-blue-600"
            >
              {isSubmitting ? '처리 중...' : '인증번호 받기'}
            </button>
          </form>
        ) : (
          // Step 2: 인증번호 입력
          <form onSubmit={handleVerifyAndLogin} className="space-y-4">
            {userName && (
              <div className="text-center mb-4">
                <p className="text-gray-600">
                  안녕하세요, <span className="font-semibold text-gray-900">{userName}</span>님
                </p>
              </div>
            )}

            {/* 목업 모드: 인증번호 표시 */}
            {mockCode && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                <p className="text-sm text-blue-600 mb-1">[테스트 모드] 인증번호</p>
                <p className="text-2xl font-bold text-blue-700 tracking-widest">{mockCode}</p>
                <p className="text-xs text-blue-500 mt-1">실제 운영 시 SMS로 발송됩니다</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">인증번호</label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                className="input-field text-center text-xl tracking-widest"
                placeholder="000000"
                maxLength={6}
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                뒤로
              </button>
              <button
                type="submit"
                disabled={isSubmitting || verificationCode.length !== 6}
                className="flex-1 btn-primary bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300"
              >
                {isSubmitting ? '로그인 중...' : '로그인'}
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-gray-500">
            계정이 없으신가요?{' '}
            <span className="text-gray-400">선생님께 등록을 요청하세요</span>
          </p>
          <div className="flex justify-center gap-4 text-sm">
            <Link to="/parent/login" className="text-green-600 hover:underline">
              부모 로그인
            </Link>
            <Link to="/admin/login" className="text-accent hover:underline">
              관리자 로그인
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
