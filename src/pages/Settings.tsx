import { useState } from 'react';
import Layout from '../components/Layout';

export default function Settings() {
  const [notifications, setNotifications] = useState(true);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [autoCheckout, setAutoCheckout] = useState(false);

  const settingGroups = [
    {
      title: '출석 설정',
      items: [
        {
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
          label: 'GPS 위치 확인',
          description: '출석 시 위치 확인 필수',
          value: gpsEnabled,
          onChange: () => setGpsEnabled(!gpsEnabled),
          color: '#2ECC71',
        },
        {
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          label: '자동 하원 처리',
          description: '수업 종료 시 자동 체크아웃',
          value: autoCheckout,
          onChange: () => setAutoCheckout(!autoCheckout),
          color: '#1E3A5F',
        },
      ],
    },
    {
      title: '알림 설정',
      items: [
        {
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          ),
          label: '푸시 알림',
          description: '출석, 결석 알림 받기',
          value: notifications,
          onChange: () => setNotifications(!notifications),
          color: '#E85D4C',
        },
      ],
    },
  ];

  const menuItems = [
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      label: '학원 정보 관리',
      color: '#1E3A5F',
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      label: '데이터 내보내기',
      color: '#F8A035',
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: '도움말',
      color: '#2ECC71',
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: '앱 정보',
      color: '#8E9AAB',
    },
  ];

  return (
    <Layout>
      <div className="px-5 pt-6 pb-4">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-primary">설정</h1>
          <p className="text-gray-400 text-sm">앱 설정을 관리합니다</p>
        </header>

        {/* Profile Card */}
        <div className="card flex items-center gap-4 mb-6">
          <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center">
            <span className="text-white font-bold text-2xl">관</span>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-primary">관리자</h2>
            <p className="text-gray-400 text-sm">학원 관리</p>
          </div>
          <button className="btn-outline py-2 px-4 text-sm">
            편집
          </button>
        </div>

        {/* Settings Groups */}
        {settingGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="mb-6">
            <h3 className="text-sm text-gray-400 mb-3 px-1 font-medium">{group.title}</h3>
            <div className="card overflow-hidden p-0">
              {group.items.map((item, itemIndex) => (
                <div
                  key={itemIndex}
                  className={`flex items-center gap-4 p-4 ${
                    itemIndex !== group.items.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${item.color}15`, color: item.color }}
                  >
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-primary font-medium">{item.label}</p>
                    <p className="text-sm text-gray-400">{item.description}</p>
                  </div>
                  <button
                    onClick={item.onChange}
                    className={`w-12 h-7 rounded-full transition-all ${
                      item.value ? 'bg-accent' : 'bg-gray-200'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
                        item.value ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Menu Items */}
        <div className="mb-6">
          <h3 className="text-sm text-gray-400 mb-3 px-1 font-medium">기타</h3>
          <div className="card overflow-hidden p-0">
            {menuItems.map((item, index) => (
              <button
                key={index}
                className={`flex items-center gap-4 p-4 w-full text-left ${
                  index !== menuItems.length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${item.color}15`, color: item.color }}
                >
                  {item.icon}
                </div>
                <p className="flex-1 text-primary font-medium">{item.label}</p>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* Version */}
        <div className="text-center">
          <p className="text-gray-400 text-sm">CheckMate v1.0.0</p>
        </div>
      </div>
    </Layout>
  );
}
