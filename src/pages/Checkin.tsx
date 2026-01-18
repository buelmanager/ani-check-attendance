import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useStore } from '../store/useStore';
import QRCode from 'qrcode';

export default function Checkin() {
  const { classes, students, addAttendance, attendances } = useStore();
  const [selectedClass, setSelectedClass] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [mode, setMode] = useState<'qr' | 'manual'>('qr');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const currentTime = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  const selectedClassData = classes.find((c) => c.id === selectedClass);
  const classStudents = selectedClassData
    ? students.filter((s) => selectedClassData.studentIds.includes(s.id))
    : [];

  const todayAttendances = attendances.filter(
    (a) => a.date === today && a.classId === selectedClass
  );

  useEffect(() => {
    if (selectedClass) {
      generateQR();
    }
  }, [selectedClass]);

  const generateQR = async () => {
    if (!selectedClass) return;

    const qrData = JSON.stringify({
      classId: selectedClass,
      date: today,
      timestamp: Date.now(),
    });

    try {
      const url = await QRCode.toDataURL(qrData, {
        width: 280,
        margin: 2,
        color: { dark: '#1E3A5F', light: '#FFFFFF' },
      });
      setQrCodeUrl(url);
    } catch (err) {
      console.error(err);
    }
  };

  const handleManualCheckin = (studentId: string) => {
    if (!selectedClass) return;

    const existingAttendance = todayAttendances.find((a) => a.studentId === studentId);
    if (existingAttendance) {
      showMessage('이미 출석 처리된 학생입니다');
      return;
    }

    const classTime = selectedClassData?.time || '00:00';
    const [classHour, classMin] = classTime.split(':').map(Number);
    const now = new Date();
    const classDateTime = new Date();
    classDateTime.setHours(classHour, classMin, 0);

    const diffMinutes = Math.floor((now.getTime() - classDateTime.getTime()) / 60000);
    const status = diffMinutes > 10 ? 'late' : 'present';

    addAttendance({
      classId: selectedClass,
      studentId,
      date: today,
      status,
      checkInTime: currentTime,
      checkInMethod: 'manual',
    });

    const student = students.find((s) => s.id === studentId);
    showMessage(`${student?.name}님 ${status === 'late' ? '지각' : '출석'} 처리됨`);
  };

  const showMessage = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const getStudentStatus = (studentId: string) => {
    return todayAttendances.find((a) => a.studentId === studentId);
  };

  const avatarColors = ['#E85D4C', '#1E3A5F', '#F8A035', '#2ECC71', '#9B59B6'];

  return (
    <Layout>
      <div className="px-5 pt-6 pb-4">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-primary">출석 체크</h1>
          <p className="text-gray-400 text-sm">{today} · {currentTime}</p>
        </header>

        {/* Class Selection */}
        <div className="mb-6">
          <label className="text-sm text-gray-500 mb-2 block font-medium">클래스 선택</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full bg-white border-2 border-gray-100 rounded-2xl px-4 py-4 text-primary focus:outline-none focus:border-primary appearance-none shadow-sm"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%238E9AAB'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 1rem center',
              backgroundSize: '1.5rem'
            }}
          >
            <option value="">클래스를 선택하세요</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
        </div>

        {selectedClass && (
          <>
            {/* Mode Toggle */}
            <div className="tab-container mb-6">
              <button
                onClick={() => setMode('qr')}
                className={`tab-item ${mode === 'qr' ? 'active' : ''}`}
              >
                QR 코드
              </button>
              <button
                onClick={() => setMode('manual')}
                className={`tab-item ${mode === 'manual' ? 'active' : ''}`}
              >
                수동 체크
              </button>
            </div>

            {mode === 'qr' ? (
              <div className="card text-center">
                <h2 className="text-lg font-semibold text-primary mb-2">{selectedClassData?.name}</h2>
                <p className="text-gray-400 text-sm mb-6">학생들이 이 QR을 스캔하여 출석합니다</p>

                {qrCodeUrl && (
                  <div className="bg-gray-50 rounded-2xl p-6 inline-block mb-6">
                    <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
                  </div>
                )}

                <button onClick={generateQR} className="flex items-center justify-center gap-2 w-full btn-outline">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  QR 새로고침
                </button>

                <div className="flex justify-center gap-6 mt-6 pt-6 border-t border-gray-100">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-success">
                      {todayAttendances.filter((a) => a.status === 'present').length}
                    </p>
                    <p className="text-xs text-gray-400">출석</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-warning">
                      {todayAttendances.filter((a) => a.status === 'late').length}
                    </p>
                    <p className="text-xs text-gray-400">지각</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-400">
                      {classStudents.length - todayAttendances.length}
                    </p>
                    <p className="text-xs text-gray-400">미체크</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {classStudents.length > 0 ? (
                  classStudents.map((student, index) => {
                    const status = getStudentStatus(student.id);

                    return (
                      <div key={student.id} className="card flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${
                            status?.status === 'present' ? 'bg-green-100 text-green-600' :
                            status?.status === 'late' ? 'bg-amber-100 text-amber-600' :
                            'text-white'
                          }`}
                          style={{
                            backgroundColor: status ? undefined : avatarColors[index % avatarColors.length],
                          }}
                        >
                          {student.name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-primary">{student.name}</p>
                          <p className="text-sm text-gray-400">
                            {status ? `${status.checkInTime} · ${status.status === 'present' ? '출석' : '지각'}` : '미체크'}
                          </p>
                        </div>
                        {!status ? (
                          <button
                            onClick={() => handleManualCheckin(student.id)}
                            className="btn-accent py-2 px-4 text-sm"
                          >
                            출석
                          </button>
                        ) : (
                          <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${
                            status.status === 'present' ? 'status-present' :
                            status.status === 'late' ? 'status-late' : 'status-absent'
                          }`}>
                            {status.status === 'present' ? '출석' : '지각'}
                          </span>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="card text-center py-8">
                    <p className="text-gray-400">이 클래스에 등록된 학생이 없습니다</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!selectedClass && (
          <div className="card text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <p className="text-gray-400">클래스를 선택하여 출석을 시작하세요</p>
          </div>
        )}
      </div>

      {/* Toast */}
      {showToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
          <div className="bg-white px-6 py-3 rounded-full shadow-lg border border-gray-100">
            <p className="text-primary font-medium">{toastMessage}</p>
          </div>
        </div>
      )}
    </Layout>
  );
}
