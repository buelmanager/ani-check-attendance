import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { qrSessionService } from '../services/qrSessionService';
import { attendanceService } from '../services/attendanceService';
import { classService } from '../services/classService';
import { studentService } from '../services/studentService';
import { parentService } from '../services/parentService';
import { notificationService } from '../services/notificationService';
import type { Class, Student } from '../types';

export default function QRCheckin() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'expired' | 'success' | 'already'>('loading');
  const [sessionData, setSessionData] = useState<{ classId: string; date: string } | null>(null);
  const [classData, setClassData] = useState<Class | null>(null);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkedInStudent, setCheckedInStudent] = useState<Student | null>(null);

  useEffect(() => {
    validateSession();
  }, [token]);

  const validateSession = async () => {
    if (!token) {
      setStatus('invalid');
      return;
    }

    try {
      const result = await qrSessionService.validateToken(token);

      if (result.valid && result.classId && result.date) {
        setSessionData({ classId: result.classId, date: result.date });

        // Fetch class and students
        const cls = await classService.getById(result.classId);
        if (cls) {
          setClassData(cls);
          const allStudents = await studentService.getAll();
          const enrolled = allStudents.filter(s => cls.studentIds.includes(s.id));
          setClassStudents(enrolled);
        }

        setStatus('valid');
      } else {
        setStatus('expired');
      }
    } catch (error) {
      console.error('Session validation error:', error);
      setStatus('invalid');
    }
  };

  const handleCheckin = async () => {
    if (!selectedStudent || !sessionData) return;

    setIsSubmitting(true);

    try {
      // Check if already checked in
      const exists = await attendanceService.checkIfExists(
        sessionData.classId,
        selectedStudent,
        sessionData.date
      );

      if (exists) {
        const student = classStudents.find(s => s.id === selectedStudent);
        setCheckedInStudent(student || null);
        setStatus('already');
        setIsSubmitting(false);
        return;
      }

      // Determine if late
      const classTime = classData?.time || '00:00';
      const [classHour, classMin] = classTime.split(':').map(Number);
      const now = new Date();
      const classDateTime = new Date();
      classDateTime.setHours(classHour, classMin, 0);
      const diffMinutes = Math.floor((now.getTime() - classDateTime.getTime()) / 60000);
      const attendanceStatus = diffMinutes > 10 ? 'late' : 'present';

      const checkInTime = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

      // Create attendance record
      await attendanceService.create({
        classId: sessionData.classId,
        studentId: selectedStudent,
        date: sessionData.date,
        status: attendanceStatus,
        checkInTime,
        checkInMethod: 'qr'
      });

      const student = classStudents.find(s => s.id === selectedStudent);
      setCheckedInStudent(student || null);

      // 부모에게 알림 전송 (비동기로 처리하여 UI 블로킹 방지)
      if (student && classData) {
        (async () => {
          try {
            // 해당 학생의 부모들 조회
            const parents = await parentService.getParentsByStudentId(selectedStudent);
            const parentUserIds = parents.map(p => p.userId);

            if (parentUserIds.length > 0) {
              // 부모들에게 체크인 알림 생성
              await notificationService.notifyParentsOfCheckin(
                parentUserIds,
                student.name,
                classData.name,
                attendanceStatus as 'present' | 'late',
                checkInTime
              );
            }
          } catch (error) {
            console.error('Failed to notify parents:', error);
          }
        })();
      }

      setStatus('success');
    } catch (error) {
      console.error('Checkin error:', error);
      alert('출석 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="app-container min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-accent border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">QR 코드 확인 중...</p>
        </div>
      </div>
    );
  }

  if (status === 'invalid' || status === 'expired') {
    return (
      <div className="app-container min-h-screen flex flex-col items-center justify-center p-6 text-center bg-gray-50">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          {status === 'expired' ? 'QR 코드가 만료되었습니다' : '유효하지 않은 QR 코드입니다'}
        </h1>
        <p className="text-gray-500 mb-6">선생님께 새로운 QR 코드를 요청해주세요.</p>
        <button onClick={() => navigate('/dashboard')} className="btn-outline">
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  if (status === 'success' || status === 'already') {
    return (
      <div className="app-container min-h-screen flex flex-col items-center justify-center p-6 text-center bg-gray-50">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
          status === 'success' ? 'bg-green-500/20' : 'bg-amber-500/20'
        }`}>
          <svg className={`w-10 h-10 ${status === 'success' ? 'text-green-500' : 'text-amber-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          {status === 'success' ? '출석 완료!' : '이미 출석 처리됨'}
        </h1>
        <p className="text-gray-500 mb-6">
          {checkedInStudent?.name}님, {classData?.name} 출석이 확인되었습니다.
        </p>
        <button onClick={() => navigate('/dashboard')} className="btn-accent">
          확인
        </button>
      </div>
    );
  }

  return (
    <div className="app-container min-h-screen p-6 bg-gray-50">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-accent mb-2">CheckMate</h1>
        <p className="text-gray-500">QR 출석 체크</p>
      </div>

      {/* Class Info */}
      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{classData?.name}</h2>
            <p className="text-sm text-gray-500">{classData?.schedule} {classData?.time}</p>
          </div>
        </div>
      </div>

      {/* Student Selection */}
      <div className="card">
        <label className="text-sm text-gray-500 mb-3 block">본인 이름을 선택하세요</label>

        <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
          {classStudents.map((student) => (
            <button
              key={student.id}
              onClick={() => setSelectedStudent(student.id)}
              className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${
                selectedStudent === student.id
                  ? 'bg-accent/20 border-2 border-accent'
                  : 'bg-gray-100 border-2 border-transparent hover:border-gray-600'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                selectedStudent === student.id
                  ? 'bg-accent text-primary'
                  : 'bg-gray-200 text-gray-900'
              }`}>
                {student.name.charAt(0)}
              </div>
              <span className="text-gray-900 font-medium">{student.name}</span>
              {selectedStudent === student.id && (
                <svg className="w-5 h-5 text-accent ml-auto" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={handleCheckin}
          disabled={!selectedStudent || isSubmitting}
          className="w-full btn-accent disabled:opacity-50"
        >
          {isSubmitting ? '처리 중...' : '출석 체크'}
        </button>
      </div>
    </div>
  );
}
