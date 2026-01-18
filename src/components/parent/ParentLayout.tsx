import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { notificationService } from '../../services/notificationService';

interface ParentLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  {
    to: '/parent',
    label: '홈',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )
  },
  {
    to: '/parent/notices',
    label: '공지',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    )
  },
  {
    to: '/parent/notifications',
    label: '알림',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    hasBadge: true
  }
];

export function ParentLayout({ children }: ParentLayoutProps) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchUnread = async () => {
      const count = await notificationService.getUnreadCount(user.uid);
      setUnreadCount(count);
    };

    fetchUnread();

    // 실시간 구독
    const unsub = notificationService.subscribeForUser(user.uid, (notifications) => {
      setUnreadCount(notifications.filter(n => !n.isRead).length);
    });

    return unsub;
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pwa-safe-top">
      {/* Main Content - 헤더 제거, PWA safe area 적용 */}
      <main className="flex-1 overflow-auto pb-20">
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 safe-area-bottom">
        <div className="flex justify-around items-center max-w-md mx-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/parent'}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[60px] ${
                  isActive
                    ? 'text-green-500 bg-green-50'
                    : 'text-gray-400 hover:text-gray-600'
                }`
              }
            >
              {item.icon}
              <span className="text-xs font-medium">{item.label}</span>
              {item.hasBadge && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
