import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [name, setName] = useState('');

  const { loginAsAdmin, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isRegisterMode) {
        if (!name.trim()) {
          setError('이름을 입력해주세요.');
          setIsLoading(false);
          return;
        }
        await register(email, password, name);
      } else {
        await loginAsAdmin(email, password);
      }
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '오류가 발생했습니다.';
      if (errorMessage.includes('auth/invalid-credential') || errorMessage.includes('auth/wrong-password')) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else if (errorMessage.includes('auth/user-not-found')) {
        setError('등록되지 않은 이메일입니다.');
      } else if (errorMessage.includes('auth/email-already-in-use')) {
        setError('이미 사용 중인 이메일입니다.');
      } else if (errorMessage.includes('auth/weak-password')) {
        setError('비밀번호는 6자 이상이어야 합니다.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-accent mb-2">ANI WID</h1>
          <p className="text-gray-500">
            {isRegisterMode ? '관리자 계정 생성' : '관리자 로그인'}
          </p>
        </div>

        {/* Login Form */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {isRegisterMode && (
              <div>
                <label className="text-sm text-gray-600 mb-2 block">이름</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                  placeholder="관리자 이름"
                  required
                />
              </div>
            )}

            <div>
              <label className="text-sm text-gray-600 mb-2 block">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="admin@example.com"
                required
              />
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-2 block">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="********"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-accent disabled:opacity-50"
            >
              {isLoading ? '처리 중...' : isRegisterMode ? '계정 생성' : '로그인'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setError('');
              }}
              className="text-accent text-sm hover:underline"
            >
              {isRegisterMode ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 등록하기'}
            </button>
          </div>
        </div>

        {/* Back link */}
        <p className="text-center text-gray-500 text-sm mt-6">
          <Link to="/dashboard" className="text-accent hover:underline">
            학생용 페이지로 이동
          </Link>
        </p>
      </div>
    </div>
  );
}
