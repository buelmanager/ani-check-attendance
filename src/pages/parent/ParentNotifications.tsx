import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ParentLayout } from '../../components/parent/ParentLayout';
import { notificationService } from '../../services/notificationService';
import type { Notification } from '../../types';

export default function ParentNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const unsub = notificationService.subscribeForUser(user.uid, (notifs) => {
      setNotifications(notifs);
      setIsLoading(false);
    });

    return unsub;
  }, [user]);

  const handleMarkAsRead = async (id: string) => {
    await notificationService.markAsRead(id);
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    await notificationService.markAllAsRead(user.uid);
  };

  const getTypeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'checkin':
        return (
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'late':
        return (
          <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      case 'absent':
        return (
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      case 'announcement':
        return (
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
        );
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (isLoading) {
    return (
      <ParentLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      </ParentLayout>
    );
  }

  return (
    <ParentLayout>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">알림</h2>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-sm text-accent font-medium"
            >
              모두 읽음 처리
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <p className="text-gray-500">알림이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => (
              <button
                key={notif.id}
                onClick={() => !notif.isRead && handleMarkAsRead(notif.id)}
                className={`w-full text-left rounded-xl p-4 transition-colors ${
                  notif.isRead
                    ? 'bg-white'
                    : 'bg-green-50 border border-green-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {getTypeIcon(notif.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className={`font-medium ${notif.isRead ? 'text-gray-700' : 'text-gray-900'}`}>
                        {notif.title}
                      </h4>
                      {!notif.isRead && (
                        <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></span>
                      )}
                    </div>
                    <p className={`text-sm mt-1 ${notif.isRead ? 'text-gray-500' : 'text-gray-600'}`}>
                      {notif.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      {formatTime(notif.createdAt)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </ParentLayout>
  );
}
