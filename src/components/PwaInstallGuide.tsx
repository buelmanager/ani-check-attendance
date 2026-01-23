import { useState, useEffect } from 'react';
import { getWebviewInfo, getBrowserName, DeviceOS } from '../utils/webviewDetect';

interface PwaInstallGuideProps {
  onClose: () => void;
}

const PwaInstallGuide = ({ onClose }: PwaInstallGuideProps) => {
  const [activeTab, setActiveTab] = useState<DeviceOS>('ios');
  const webviewInfo = getWebviewInfo();

  // 사용자 OS에 맞게 탭 초기 설정
  useEffect(() => {
    if (webviewInfo.os === 'android') {
      setActiveTab('android');
    } else {
      setActiveTab('ios');
    }
  }, [webviewInfo.os]);

  const browserName = getBrowserName(webviewInfo.browser);
  const currentUrl = window.location.origin;

  // iOS 설치 가이드
  const IosGuide = () => (
    <div className="space-y-4">
      {/* Step 1: Safari로 열기 */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
            1
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 mb-2">Safari 브라우저로 열기</h4>
            <p className="text-sm text-gray-600 mb-3">
              아래 주소를 복사하여 <strong>Safari</strong>에서 열어주세요.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={currentUrl}
                className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(currentUrl);
                  alert('주소가 복사되었습니다!');
                }}
                className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"
              >
                복사
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: 공유 버튼 */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
            2
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 mb-2">공유 버튼 누르기</h4>
            <p className="text-sm text-gray-600 mb-2">
              Safari 하단의 <strong>공유 버튼</strong>을 눌러주세요.
            </p>
            <div className="flex justify-center py-2">
              <div className="w-12 h-12 bg-white border-2 border-gray-300 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step 3: 홈 화면에 추가 */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
            3
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 mb-2">"홈 화면에 추가" 선택</h4>
            <p className="text-sm text-gray-600 mb-2">
              공유 메뉴에서 <strong>"홈 화면에 추가"</strong>를 찾아 눌러주세요.
            </p>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
              <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-sm text-gray-700">홈 화면에 추가</span>
            </div>
          </div>
        </div>
      </div>

      {/* Step 4: 추가 확인 */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
            4
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 mb-2">"추가" 버튼 누르기</h4>
            <p className="text-sm text-gray-600">
              오른쪽 상단의 <strong>"추가"</strong> 버튼을 눌러 완료하세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // Android 설치 가이드
  const AndroidGuide = () => (
    <div className="space-y-4">
      {/* Step 1: Chrome으로 열기 */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
            1
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 mb-2">Chrome 브라우저로 열기</h4>
            <p className="text-sm text-gray-600 mb-3">
              아래 주소를 복사하여 <strong>Chrome</strong>에서 열어주세요.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={currentUrl}
                className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(currentUrl);
                  alert('주소가 복사되었습니다!');
                }}
                className="px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600"
              >
                복사
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: 메뉴 버튼 */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
            2
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 mb-2">메뉴 버튼 누르기</h4>
            <p className="text-sm text-gray-600 mb-2">
              Chrome 오른쪽 상단의 <strong>점 3개 메뉴(⋮)</strong>를 눌러주세요.
            </p>
            <div className="flex justify-center py-2">
              <div className="w-10 h-10 bg-white border-2 border-gray-300 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step 3: 홈 화면에 추가 */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
            3
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 mb-2">"홈 화면에 추가" 선택</h4>
            <p className="text-sm text-gray-600 mb-2">
              메뉴에서 <strong>"홈 화면에 추가"</strong> 또는 <strong>"앱 설치"</strong>를 선택하세요.
            </p>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
              <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-sm text-gray-700">홈 화면에 추가</span>
            </div>
          </div>
        </div>
      </div>

      {/* Step 4: 설치 확인 */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
            4
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 mb-2">"설치" 또는 "추가" 확인</h4>
            <p className="text-sm text-gray-600">
              팝업에서 <strong>"설치"</strong> 또는 <strong>"추가"</strong> 버튼을 눌러 완료하세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] bg-white rounded-2xl overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="p-6 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">앱 설치 안내</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 현재 환경 알림 */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
            <p className="text-sm text-amber-800">
              현재 <strong>{browserName}</strong>에서 접속하셨습니다.<br />
              아래 방법으로 앱을 설치하시면 더 편리하게 이용하실 수 있습니다.
            </p>
          </div>

          {/* 왜 설치해야 하는지 */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">홈 화면에 추가하면?</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                앱처럼 빠르게 실행
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                전체 화면으로 편리하게 사용
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                매번 주소 입력 없이 바로 접속
              </li>
            </ul>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('ios')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'ios'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              iPhone
            </span>
          </button>
          <button
            onClick={() => setActiveTab('android')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'android'
                ? 'text-green-600 border-b-2 border-green-600 bg-green-50/50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993s-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993s-.4482.9997-.9993.9997m11.4043-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.2439 13.8533 7.8508 12 7.8508s-3.5902.3931-5.1367 1.0989L4.841 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3435-4.1021-2.6892-7.5743-6.1187-9.4396"/>
              </svg>
              Android
            </span>
          </button>
        </div>

        {/* 가이드 내용 */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'ios' ? <IosGuide /> : <AndroidGuide />}
        </div>

        {/* 하단 버튼 */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
          >
            나중에 하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default PwaInstallGuide;
