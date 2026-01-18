import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function Home() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Progress animation
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 50);

    // Navigate to dashboard after loading
    const timer = setTimeout(() => {
      navigate('/dashboard');
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [navigate]);

  return (
    <div
      className="app-container min-h-screen flex flex-col items-center justify-center"
      style={{ backgroundColor: '#1a1f2e' }}
      onClick={() => navigate('/dashboard')}
    >
      {/* Logo */}
      <div className="mb-8">
        <h1
          className="text-5xl font-bold tracking-widest"
          style={{ color: '#c9a962' }}
        >
          ANI WID
        </h1>
      </div>

      {/* Subtitle */}
      <div className="text-center mb-12">
        <p className="text-gray-400 text-sm">예술가의 꿈을 현실로 만드는</p>
        <p className="text-gray-400 text-sm">최고의 미술 전문 교육기관</p>
      </div>

      {/* Progress Bar */}
      <div className="w-64">
        <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-100 ease-out"
            style={{
              width: `${progress}%`,
              backgroundColor: '#c9a962'
            }}
          />
        </div>
        <p
          className="text-center mt-3 text-sm font-medium"
          style={{ color: '#c9a962' }}
        >
          {progress}%
        </p>
      </div>

      {/* Skip hint */}
      <p className="absolute bottom-10 text-gray-600 text-xs">
        화면을 클릭하면 건너뛸 수 있습니다
      </p>
    </div>
  );
}
