import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function StudentLogin() {
  const navigate = useNavigate();
  const { loginAsStudent, isStudent, isLoading } = useAuth();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await loginAsStudent(phone, password);
      navigate('/student');
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('핸드폰 번호 또는 비밀번호가 올바르지 않습니다.');
      } else if (err.message === '학생 계정이 아닙니다.') {
        setError('학생 계정이 아닙니다. 다른 로그인 페이지를 이용해주세요.');
      } else {
        setError('로그인 중 오류가 발생했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
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
          <p className="text-gray-500 mt-2">ANI CHECK 출결 관리</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="비밀번호 입력"
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
            {isSubmitting ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-gray-500">
            계정이 없으신가요?{' '}
            <span className="text-gray-400">선생님께 초대 링크를 요청하세요</span>
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
