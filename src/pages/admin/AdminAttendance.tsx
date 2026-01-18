import { useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../contexts/AuthContext';
import { qrSessionService, QRSession } from '../../services/qrSessionService';
import QRCode from 'qrcode';

export default function AdminAttendance() {
  const { classes, students, attendances, addAttendance } = useStore();
  const { user } = useAuth();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [currentSession, setCurrentSession] = useState<QRSession | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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

  const handleManualCheckin = async (studentId: string, status: 'present' | 'late' | 'absent') => {
    if (!selectedClass) return;

    const existing = getStudentAttendance(studentId);
    if (existing) {
      // Update existing
      await useStore.getState().updateAttendance(existing.id, { status });
    } else {
      // Create new
      await addAttendance({
        classId: selectedClass,
        studentId,
        date: selectedDate,
        status,
        checkInTime: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        checkInMethod: 'manual'
      });
    }
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

  const presentCount = dateAttendances.filter((a) => a.status === 'present').length;
  const lateCount = dateAttendances.filter((a) => a.status === 'late').length;
  const absentCount = dateAttendances.filter((a) => a.status === 'absent').length;

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">출석 관리</h1>
          <p className="text-gray-500">QR 코드 생성 및 수동 출석 체크</p>
        </div>
        <button
          onClick={generateQR}
          disabled={!selectedClass || isGenerating}
          className="btn-accent flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          {isGenerating ? 'QR 생성 중...' : 'QR 코드 생성'}
        </button>
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
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            attendance.status === 'present' ? 'bg-green-500/20 text-green-400' :
                            attendance.status === 'late' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {attendance.status === 'present' ? '출석' :
                             attendance.status === 'late' ? '지각' : '결석'}
                          </span>
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
    </AdminLayout>
  );
}
