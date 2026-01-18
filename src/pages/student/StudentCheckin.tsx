import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../../contexts/AuthContext';
import { StudentLayout } from '../../components/student/StudentLayout';
import { classService } from '../../services/classService';
import { attendanceService } from '../../services/attendanceService';
import { qrSessionService } from '../../services/qrSessionService';
import type { Class } from '../../types';

export default function StudentCheckin() {
  const { studentData } = useAuth();
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'qr-reader';

  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<'success' | 'error' | 'already' | null>(null);
  const [scanMessage, setScanMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // QR 스캔 후 수업 선택 관련 상태
  const [showClassSelectModal, setShowClassSelectModal] = useState(false);
  const [pendingSessionDate, setPendingSessionDate] = useState<string | null>(null);

  useEffect(() => {
    if (!studentData) return;

    const unsub = classService.subscribe((allClasses) => {
      const myClasses = allClasses.filter(c => c.studentIds.includes(studentData.id));
      setClasses(myClasses);
      setIsLoading(false);
    });

    return unsub;
  }, [studentData]);

  // QR 코드 처리 함수
  const handleQRResult = useCallback(async (scannedValue: string) => {
    if (!studentData || isProcessing) return;
    setIsProcessing(true);

    try {
      // URL 형식인 경우 토큰 추출 (예: https://domain.com/qr/TOKEN)
      let token = scannedValue;
      if (scannedValue.includes('/qr/')) {
        const parts = scannedValue.split('/qr/');
        token = parts[parts.length - 1];
      } else if (scannedValue.startsWith('http')) {
        // 다른 URL 형식인 경우 마지막 경로 세그먼트를 토큰으로 사용
        const url = new URL(scannedValue);
        const pathParts = url.pathname.split('/').filter(p => p);
        token = pathParts[pathParts.length - 1] || scannedValue;
      }

      // QR 세션 검증 (통합 QR 지원)
      const session = await qrSessionService.validateTokenWithGlobal(token);
      if (!session.valid || !session.date) {
        setScanResult('error');
        let errorMsg = '[QR 검증 실패]\n';
        errorMsg += `사유: ${session.reason || '알 수 없음'}\n`;
        if (session.debug) {
          errorMsg += `상세: ${session.debug}\n`;
        }
        errorMsg += `스캔 시간: ${new Date().toLocaleString()}`;
        setScanMessage(errorMsg);
        await stopScanning();
        return;
      }

      const sessionDate = session.date;

      // 통합 QR인 경우 - 수업 선택 모달 표시
      if (session.isGlobal) {
        await stopScanning();
        setPendingSessionDate(sessionDate);
        setShowClassSelectModal(true);
        setIsProcessing(false);
        return;
      }

      // 클래스 QR인 경우 - 자기 반인지 확인
      const sessionClassId = session.classId!;
      const isMyClass = classes.some(c => c.id === sessionClassId);

      if (!isMyClass) {
        setScanResult('error');
        setScanMessage('이 QR 코드는 다른 클래스의 QR 코드입니다.\n본인이 등록된 클래스의 QR 코드를 스캔해주세요.');
        await stopScanning();
        return;
      }

      // 클래스 QR인 경우 해당 클래스로 체크인
      await processCheckin(sessionClassId, sessionDate);
      await stopScanning();
    } catch (error) {
      console.error('QR checkin error:', error);
      setScanResult('error');
      // 상세 오류 정보 표시
      let errorDetail = '체크인 중 오류가 발생했습니다.';
      if (error instanceof Error) {
        errorDetail = `[QR 오류]\n${error.name}: ${error.message}`;
        if ('code' in error) {
          errorDetail += `\n코드: ${(error as { code: string }).code}`;
        }
      } else if (typeof error === 'string') {
        errorDetail = `[QR 오류]\n${error}`;
      } else {
        errorDetail = `[QR 오류]\n${JSON.stringify(error)}`;
      }
      setScanMessage(errorDetail);
      await stopScanning();
    } finally {
      setIsProcessing(false);
    }
  }, [studentData, classes, isProcessing]);

  // 체크인 처리 함수 (중복 방지 포함, 결석->출석 업데이트 지원)
  const processCheckin = async (classId: string, date: string) => {
    if (!studentData) return;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const targetClass = classes.find(c => c.id === classId);
    let status: 'present' | 'late' = 'present';

    // 요일별 시간 지원
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][now.getDay()];
    const classTimeStr = targetClass?.timeByDay?.[dayOfWeek] || targetClass?.time;

    if (classTimeStr) {
      const classTime = classTimeStr.split(':');
      const classMinutes = parseInt(classTime[0]) * 60 + parseInt(classTime[1]);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      if (currentMinutes > classMinutes + 10) {
        status = 'late';
      }
    }

    try {
      // 기존 출석 기록 확인
      const existing = await attendanceService.getExisting(classId, studentData.id, date);

      if (existing) {
        // 이미 출석/지각으로 되어 있으면 중복 처리 안함
        if (existing.status === 'present' || existing.status === 'late') {
          setScanResult('already');
          setScanMessage('이미 출석 처리되었습니다.');
          return;
        }

        // 결석/기타 상태면 출석으로 업데이트
        await attendanceService.update(existing.id, {
          status,
          checkInTime: currentTime,
          checkInMethod: 'qr'
        });
        setScanResult('success');
        setScanMessage(status === 'present' ? '출석으로 변경되었습니다!' : '지각으로 변경되었습니다.');
        return;
      }

      // 새로운 출석 기록 생성
      const result = await attendanceService.createSafe({
        classId,
        studentId: studentData.id,
        date,
        status,
        checkInTime: currentTime,
        checkInMethod: 'qr'
      });

      if (result.alreadyExists) {
        setScanResult('already');
        setScanMessage('이미 출석 처리되었습니다.');
      } else {
        setScanResult('success');
        setScanMessage(status === 'present' ? '출석 완료!' : '지각 처리되었습니다.');
      }
    } catch (error) {
      // 중복 요청 오류는 로딩 상태 유지 (UI에 오류 표시 안함)
      if (error instanceof Error && error.message === '이미 처리 중인 요청입니다.') {
        return;
      }
      throw error;
    }
  };

  // QR 스캐너 시작
  const startScanning = async () => {
    try {
      setIsScanning(true);

      // 잠시 대기하여 DOM이 렌더링되도록 함
      await new Promise(resolve => setTimeout(resolve, 100));

      const html5QrCode = new Html5Qrcode(scannerContainerId);
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1
        },
        (decodedText) => {
          handleQRResult(decodedText);
        },
        () => {
          // QR 코드를 찾지 못했을 때 (무시)
        }
      );
    } catch (error) {
      console.error('Camera error:', error);
      setScanResult('error');
      setScanMessage('카메라에 접근할 수 없습니다. 카메라 권한을 확인해주세요.');
      setIsScanning(false);
    }
  };

  // QR 스캐너 중지
  const stopScanning = async () => {
    try {
      if (html5QrCodeRef.current) {
        const state = html5QrCodeRef.current.getState();
        if (state === 2) { // Html5QrcodeScannerState.SCANNING
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current = null;
      }
    } catch (error) {
      console.error('Error stopping scanner:', error);
    }
    setIsScanning(false);
  };

  // 수업 선택 후 체크인 처리
  const handleClassSelectAndCheckin = async (classId: string) => {
    if (!pendingSessionDate || isProcessing) return;
    setIsProcessing(true);
    setShowClassSelectModal(false);

    try {
      await processCheckin(classId, pendingSessionDate);
    } catch (error) {
      console.error('Checkin error:', error);
      setScanResult('error');
      let errorDetail = '체크인 중 오류가 발생했습니다.';
      if (error instanceof Error) {
        errorDetail = `[체크인 오류]\n${error.name}: ${error.message}`;
      }
      setScanMessage(errorDetail);
    } finally {
      setIsProcessing(false);
      setPendingSessionDate(null);
    }
  };

  // 컴포넌트 언마운트 시 스캐너 정리
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(console.error);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <StudentLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="px-1">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-primary">출석 체크인</h1>
          <p className="text-gray-400 text-sm">QR 코드를 스캔하여 출석을 확인하세요</p>
        </header>

        {/* 결과 표시 */}
        {scanResult && (
          <div className={`mb-6 card overflow-hidden ${
            scanResult === 'success' ? 'border-2 border-green-200' :
            scanResult === 'already' ? 'border-2 border-yellow-200' : 'border-2 border-red-200'
          }`}>
            <div className={`p-6 ${
              scanResult === 'success' ? 'bg-green-50' :
              scanResult === 'already' ? 'bg-yellow-50' : 'bg-red-50'
            }`}>
              <div className="flex flex-col items-center text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                  scanResult === 'success' ? 'bg-green-500' :
                  scanResult === 'already' ? 'bg-yellow-500' : 'bg-red-500'
                }`}>
                  {scanResult === 'success' ? (
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : scanResult === 'already' ? (
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <h3 className={`text-xl font-bold mb-2 ${
                  scanResult === 'success' ? 'text-green-800' :
                  scanResult === 'already' ? 'text-yellow-800' : 'text-red-800'
                }`}>
                  {scanResult === 'success' ? '체크인 완료!' :
                   scanResult === 'already' ? '이미 체크인됨' : '오류 발생'}
                </h3>
                <p className={`text-sm whitespace-pre-wrap text-left ${
                  scanResult === 'success' ? 'text-green-600' :
                  scanResult === 'already' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {scanMessage}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setScanResult(null);
                setScanMessage('');
              }}
              className="w-full py-4 font-medium text-gray-700 hover:bg-gray-50 transition-colors border-t"
            >
              확인
            </button>
          </div>
        )}

        {/* QR 스캐너 영역 */}
        {isScanning && !scanResult && (
          <div className="mb-6">
            <div className="card p-0 overflow-hidden">
              {/* QR 스캐너 */}
              <div className="relative bg-black">
                <div id={scannerContainerId} className="w-full" />
                {isProcessing && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              <div className="p-4 bg-gray-50">
                <p className="text-center text-gray-500 text-sm">
                  QR 코드를 화면 중앙에 맞춰주세요
                </p>
              </div>
            </div>
            <button
              onClick={stopScanning}
              className="w-full mt-4 py-4 bg-gray-100 text-gray-700 rounded-2xl font-semibold hover:bg-gray-200 transition-colors"
            >
              취소
            </button>
          </div>
        )}

        {/* 내 수업 목록 및 QR 스캔 버튼 */}
        {!isScanning && !scanResult && (
          <>
            {/* 내 수업 목록 (보기 전용) */}
            <div className="card mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">내 수업 목록</label>
              {classes.length > 0 ? (
                <div className="space-y-2">
                  {classes.map((cls) => (
                    <div
                      key={cls.id}
                      className="w-full p-4 rounded-xl bg-gray-50 border-2 border-transparent"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-accent/20">
                          <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-semibold text-primary">{cls.name}</p>
                          <p className="text-sm text-gray-400">{cls.schedule} · {cls.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <p className="text-gray-400">등록된 수업이 없습니다</p>
                </div>
              )}
            </div>

            {/* QR 스캔 버튼 */}
            {classes.length > 0 && (
              <button
                onClick={startScanning}
                className="w-full py-4 gradient-primary text-white rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                QR 코드 스캔
              </button>
            )}
          </>
        )}

        {/* QR 스캔 후 수업 선택 모달 */}
        {showClassSelectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => {
                setShowClassSelectModal(false);
                setPendingSessionDate(null);
              }}
            />
            <div className="relative w-full max-w-md bg-white rounded-2xl overflow-hidden">
              <div className="p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">출석할 수업 선택</h2>
                <p className="text-gray-500 text-sm mt-1">체크인할 수업을 선택해주세요</p>
              </div>

              <div className="p-4 max-h-80 overflow-y-auto">
                <div className="space-y-2">
                  {classes.map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() => handleClassSelectAndCheckin(cls.id)}
                      disabled={isProcessing}
                      className="w-full p-4 rounded-xl text-left transition-all bg-gray-50 hover:bg-accent/10 hover:border-accent border-2 border-transparent disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-accent/20">
                          <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-semibold text-primary">{cls.name}</p>
                          <p className="text-sm text-gray-400">{cls.schedule} · {cls.time}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t">
                <button
                  onClick={() => {
                    setShowClassSelectModal(false);
                    setPendingSessionDate(null);
                  }}
                  className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 안내 */}
        <div className="mt-6 card bg-blue-50 border border-blue-100">
          <div className="flex gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-medium text-blue-900 mb-1">출석 체크 안내</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• 선생님이 보여주는 QR 코드를 스캔하세요</li>
                <li>• QR 스캔 후 출석할 수업을 선택하세요</li>
                <li>• 수업 시작 10분 후 체크인 시 지각 처리됩니다</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
