import { useState, useEffect, useRef, useCallback } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../contexts/AuthContext';
import { qrSessionService, QRSession } from '../../services/qrSessionService';
import { parentService } from '../../services/parentService';
import { notificationService } from '../../services/notificationService';
import QRCode from 'qrcode';

const REFRESH_INTERVAL = 600; // 10분(600초)마다 갱신

export default function AdminAttendance() {
  const { classes, students, attendances, addAttendance, updateAttendance } = useStore();
  const { user } = useAuth();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showGlobalQRModal, setShowGlobalQRModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [globalQrCodeUrl, setGlobalQrCodeUrl] = useState('');
  const [currentSession, setCurrentSession] = useState<QRSession | null>(null);
  const [, setGlobalSession] = useState<QRSession | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingGlobal, setIsGeneratingGlobal] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState(REFRESH_INTERVAL);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 결석 사유 모달 관련 상태
  const [showAbsentReasonModal, setShowAbsentReasonModal] = useState(false);
  const [absentReason, setAbsentReason] = useState('');
  const [absentTargetStudentId, setAbsentTargetStudentId] = useState<string | null>(null);

  // 더미 데이터 생성 관련 상태
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [demoProgress, setDemoProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const selectedClassData = classes.find((c) => c.id === selectedClass);
  const classStudents = selectedClassData
    ? students.filter((s) => selectedClassData.studentIds.includes(s.id))
    : [];

  const dateAttendances = attendances.filter(
    (a) => a.date === selectedDate && (selectedClass ? a.classId === selectedClass : true)
  );

  const getStudentAttendance = (studentId: string) => {
    return dateAttendances.find((a) => a.studentId === studentId && a.classId === selectedClass);
  };

  const handleManualCheckin = async (studentId: string, status: 'present' | 'late' | 'absent', reason?: string) => {
    if (!selectedClass) return;

    // 결석 처리 시 사유 입력 모달 표시
    if (status === 'absent' && reason === undefined) {
      setAbsentTargetStudentId(studentId);
      setAbsentReason('');
      setShowAbsentReasonModal(true);
      return;
    }

    try {
      const existing = getStudentAttendance(studentId);
      if (existing) {
        // Update existing
        await updateAttendance(existing.id, {
          status,
          checkInTime: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          absentReason: status === 'absent' ? reason : undefined
        });
      } else {
        // Create new
        await addAttendance({
          classId: selectedClass,
          studentId,
          date: selectedDate,
          status,
          checkInTime: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          checkInMethod: 'manual',
          absentReason: status === 'absent' ? reason : undefined
        });
      }

      // 부모에게 알림 전송 (비동기 처리)
      const student = students.find(s => s.id === studentId);
      const className = selectedClassData?.name || '';
      if (student && className) {
        parentService.getParentsByStudentId(studentId).then(parents => {
          const parentUserIds = parents.map(p => p.userId);
          if (parentUserIds.length > 0) {
            notificationService.notifyParentsOfAttendanceChange(
              parentUserIds,
              student.name,
              className,
              status,
              selectedDate
            ).catch(err => console.error('Failed to notify parents:', err));
          }
        }).catch(err => console.error('Failed to get parents:', err));
      }
    } catch (error) {
      console.error('Failed to update attendance:', error);
    }
  };

  // 결석 사유 입력 후 처리
  const handleAbsentWithReason = async () => {
    if (!absentTargetStudentId) return;
    await handleManualCheckin(absentTargetStudentId, 'absent', absentReason);
    setShowAbsentReasonModal(false);
    setAbsentTargetStudentId(null);
    setAbsentReason('');
  };

  const generateQR = async () => {
    if (!selectedClass || !user) return;

    setIsGenerating(true);
    try {
      const session = await qrSessionService.createSession(selectedClass, user.uid);
      setCurrentSession(session);

      const checkinUrl = `${window.location.origin}/qr/${session.token}`;
      const url = await QRCode.toDataURL(checkinUrl, {
        width: 300,
        margin: 2,
        color: { dark: '#1a1f2e', light: '#FFFFFF' }
      });
      setQrCodeUrl(url);
      setShowQRModal(true);
    } catch (error) {
      console.error('Error generating QR:', error);
      alert('QR 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  // 통합 QR 생성 함수
  const generateGlobalQRInternal = useCallback(async () => {
    if (!user) return;

    try {
      const session = await qrSessionService.createGlobalSession(user.uid);
      setGlobalSession(session);

      const checkinUrl = `${window.location.origin}/qr/${session.token}`;
      const url = await QRCode.toDataURL(checkinUrl, {
        width: 300,
        margin: 2,
        color: { dark: '#6366f1', light: '#FFFFFF' }
      });
      setGlobalQrCodeUrl(url);
      setRefreshCountdown(REFRESH_INTERVAL);
    } catch (error) {
      console.error('Error generating global QR:', error);
    }
  }, [user]);

  const generateGlobalQR = async () => {
    if (!user) return;

    setIsGeneratingGlobal(true);
    try {
      await generateGlobalQRInternal();
      setShowGlobalQRModal(true);
    } catch (error) {
      console.error('Error generating global QR:', error);
      alert('통합 QR 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingGlobal(false);
    }
  };

  // 통합 QR 모달이 열려있을 때 자동 갱신
  useEffect(() => {
    if (showGlobalQRModal) {
      // 카운트다운 타이머
      countdownIntervalRef.current = setInterval(() => {
        setRefreshCountdown(prev => {
          if (prev <= 1) {
            return REFRESH_INTERVAL;
          }
          return prev - 1;
        });
      }, 1000);

      // QR 갱신 타이머
      refreshIntervalRef.current = setInterval(() => {
        generateGlobalQRInternal();
      }, REFRESH_INTERVAL * 1000);

      return () => {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    } else {
      // 모달이 닫히면 타이머 정리
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      setRefreshCountdown(REFRESH_INTERVAL);
    }
  }, [showGlobalQRModal, generateGlobalQRInternal]);

  const presentCount = dateAttendances.filter((a) => a.status === 'present').length;
  const lateCount = dateAttendances.filter((a) => a.status === 'late').length;
  const absentCount = dateAttendances.filter((a) => a.status === 'absent').length;

  // 더미 출석 데이터 생성 함수 (최근 30일)
  const generateDemoAttendance = async () => {
    if (students.length === 0 || classes.length === 0) {
      alert('학생 또는 클래스가 없습니다. 먼저 데이터를 등록해주세요.');
      return;
    }

    if (!confirm(`최근 30일간 모든 학생(${students.length}명)의 더미 출석 데이터를 생성하시겠습니까?\n\n기존 출석 데이터가 있으면 덮어씁니다.`)) {
      return;
    }

    setIsDemoLoading(true);

    try {
      const dates: string[] = [];
      const now = new Date();

      // 최근 30일 날짜 생성
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        dates.push(date.toISOString().split('T')[0]);
      }

      // 각 학생이 속한 클래스 찾기
      const studentClassMap = new Map<string, string[]>();
      classes.forEach(cls => {
        cls.studentIds.forEach(studentId => {
          const existing = studentClassMap.get(studentId) || [];
          existing.push(cls.id);
          studentClassMap.set(studentId, existing);
        });
      });

      // 출석 생성 (학생 x 날짜 x 클래스)
      const totalRecords = students.reduce((sum, student) => {
        const classIds = studentClassMap.get(student.id) || [];
        return sum + (dates.length * classIds.length);
      }, 0);

      setDemoProgress({ current: 0, total: totalRecords });

      let processed = 0;

      for (const student of students) {
        const classIds = studentClassMap.get(student.id) || [];
        if (classIds.length === 0) continue;

        for (const classId of classIds) {
          for (const date of dates) {
            // 랜덤 출석 상태 (출석 75%, 지각 15%, 결석 10%)
            const rand = Math.random();
            let status: 'present' | 'late' | 'absent';
            if (rand < 0.75) {
              status = 'present';
            } else if (rand < 0.90) {
              status = 'late';
            } else {
              status = 'absent';
            }

            // 랜덤 체크인 시간 생성 (8:00 ~ 10:00 사이)
            const hour = status === 'late' ? 9 + Math.floor(Math.random() * 2) : 8 + Math.floor(Math.random() * 2);
            const minute = Math.floor(Math.random() * 60);
            const checkInTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

            await addAttendance({
              classId,
              studentId: student.id,
              date,
              status,
              checkInTime: status !== 'absent' ? checkInTime : undefined,
              checkInMethod: 'manual'
            });

            processed++;
            if (processed % 50 === 0) {
              setDemoProgress({ current: processed, total: totalRecords });
            }
          }
        }
      }

      setDemoProgress({ current: totalRecords, total: totalRecords });
      alert(`더미 출석 데이터 생성 완료!\n\n총 ${totalRecords}개 레코드 생성됨`);
    } catch (error) {
      console.error('Error generating demo attendance:', error);
      alert('더미 데이터 생성 중 오류가 발생했습니다.');
    } finally {
      setIsDemoLoading(false);
      setDemoProgress(null);
    }
  };

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">출석 관리</h1>
          <p className="text-gray-500">QR 코드 생성 및 수동 출석 체크</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={generateDemoAttendance}
            disabled={isDemoLoading}
            className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            {isDemoLoading ? '생성 중...' : '더미 30일'}
          </button>
          <button
            onClick={generateGlobalQR}
            disabled={isGeneratingGlobal}
            className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {isGeneratingGlobal ? '생성 중...' : '통합 QR'}
          </button>
          <button
            onClick={generateQR}
            disabled={!selectedClass || isGenerating}
            className="btn-accent flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            {isGenerating ? 'QR 생성 중...' : '클래스 QR'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-sm text-gray-500 mb-2 block">클래스 선택</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="input-field"
          >
            <option value="">클래스를 선택하세요</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-500 mb-2 block">날짜</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input-field"
          />
        </div>
      </div>

      {/* Stats */}
      {selectedClass && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card text-center">
            <p className="text-2xl font-bold text-green-400">{presentCount}</p>
            <p className="text-sm text-gray-500">출석</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-amber-400">{lateCount}</p>
            <p className="text-sm text-gray-500">지각</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-red-400">{absentCount}</p>
            <p className="text-sm text-gray-500">결석</p>
          </div>
        </div>
      )}

      {/* Students List */}
      {selectedClass ? (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">학생</th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-gray-500">상태</th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-gray-500">시간</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-gray-500">출석 처리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {classStudents.map((student) => {
                  const attendance = getStudentAttendance(student.id);

                  return (
                    <tr key={student.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                            attendance?.status === 'present' ? 'bg-green-500/20 text-green-400' :
                            attendance?.status === 'late' ? 'bg-amber-500/20 text-amber-400' :
                            attendance?.status === 'absent' ? 'bg-red-500/20 text-red-400' :
                            'bg-gray-200 text-gray-900'
                          }`}>
                            {student.name.charAt(0)}
                          </div>
                          <span className="font-medium text-gray-900">{student.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {attendance ? (
                          <div className="flex items-center justify-center gap-1">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              attendance.status === 'present' ? 'bg-green-500/20 text-green-400' :
                              attendance.status === 'late' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {attendance.status === 'present' ? '출석' :
                               attendance.status === 'late' ? '지각' : '결석'}
                            </span>
                            {attendance.status === 'absent' && attendance.absentReason && (
                              <div className="relative group">
                                <svg className="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-10 max-w-xs">
                                  <div className="font-medium mb-1">결석 사유:</div>
                                  <div className="whitespace-pre-wrap">{attendance.absentReason}</div>
                                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500 text-sm">미체크</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-gray-500">
                        {attendance?.checkInTime || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleManualCheckin(student.id, 'present')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              attendance?.status === 'present'
                                ? 'bg-green-500 text-gray-900'
                                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                            }`}
                          >
                            출석
                          </button>
                          <button
                            onClick={() => handleManualCheckin(student.id, 'late')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              attendance?.status === 'late'
                                ? 'bg-amber-500 text-gray-900'
                                : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                            }`}
                          >
                            지각
                          </button>
                          <button
                            onClick={() => handleManualCheckin(student.id, 'absent')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              attendance?.status === 'absent'
                                ? 'bg-red-500 text-gray-900'
                                : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            }`}
                          >
                            결석
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {classStudents.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">이 클래스에 등록된 학생이 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card text-center py-12">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-500">클래스를 선택하여 출석을 관리하세요.</p>
        </div>
      )}

      {/* QR Modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowQRModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedClassData?.name}</h2>
            <p className="text-gray-500 mb-6">학생들이 이 QR을 스캔하여 출석합니다</p>

            {qrCodeUrl && (
              <div className="bg-white rounded-2xl p-4 inline-block mb-6">
                <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
              </div>
            )}

            <p className="text-sm text-gray-500 mb-4">
              유효 시간: {currentSession ? new Date(currentSession.expiresAt).toLocaleTimeString('ko-KR') : '-'}까지
            </p>

            <button
              onClick={() => setShowQRModal(false)}
              className="w-full btn-accent"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* Global QR Modal */}
      {showGlobalQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowGlobalQRModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6 text-center">
            <h2 className="text-xl font-bold text-indigo-600 mb-2">통합 QR 코드</h2>
            <p className="text-gray-500 mb-4">모든 학생이 이 QR로 출석할 수 있습니다</p>

            {globalQrCodeUrl && (
              <div className="bg-white rounded-2xl p-4 inline-block mb-4 border-2 border-indigo-200 relative">
                <img src={globalQrCodeUrl} alt="Global QR Code" className="w-64 h-64" />
              </div>
            )}

            {/* 갱신 타이머 */}
            <div className="mb-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-indigo-600">
                  {Math.floor(refreshCountdown / 60)}:{(refreshCountdown % 60).toString().padStart(2, '0')} 후 자동 갱신
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-indigo-500 h-1.5 rounded-full transition-all duration-1000"
                  style={{ width: `${(refreshCountdown / REFRESH_INTERVAL) * 100}%` }}
                />
              </div>
            </div>

            <p className="text-xs text-gray-400 mb-4">
              보안을 위해 10분마다 QR이 자동 갱신됩니다
            </p>

            <button
              onClick={() => setShowGlobalQRModal(false)}
              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-3 rounded-xl font-medium transition-all"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 더미 데이터 생성 진행률 모달 */}
      {isDemoLoading && demoProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">더미 출석 데이터 생성 중...</h2>
            <p className="text-gray-500 mb-4">최근 30일간 출석 데이터를 생성하고 있습니다</p>

            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>진행률</span>
                <span>{demoProgress.current} / {demoProgress.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-pink-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${(demoProgress.current / demoProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-center text-sm text-gray-500 mt-2">
                {Math.round((demoProgress.current / demoProgress.total) * 100)}%
              </p>
            </div>

            <p className="text-xs text-gray-400 text-center">
              창을 닫지 마세요. 완료되면 자동으로 닫힙니다.
            </p>
          </div>
        </div>
      )}

      {/* 결석 사유 입력 모달 */}
      {showAbsentReasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowAbsentReasonModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">결석 처리</h2>
            <p className="text-gray-500 mb-4">
              {students.find(s => s.id === absentTargetStudentId)?.name}님의 결석 사유를 입력해주세요
            </p>

            <textarea
              value={absentReason}
              onChange={(e) => setAbsentReason(e.target.value)}
              placeholder="결석 사유를 입력하세요 (선택사항)"
              className="input-field mb-4 min-h-[100px] resize-none"
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAbsentReasonModal(false);
                  setAbsentTargetStudentId(null);
                  setAbsentReason('');
                }}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAbsentWithReason}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
              >
                결석 처리
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
