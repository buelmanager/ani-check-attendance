import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { StudentLayout } from '../../components/student/StudentLayout';
import { classService } from '../../services/classService';
import { announcementService } from '../../services/announcementService';
import type { Class, Announcement } from '../../types';

export default function StudentNotices() {
  const { studentData } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    if (!studentData) return;

    // 먼저 클래스 로드
    const unsubClasses = classService.subscribe((allClasses) => {
      const myClasses = allClasses.filter(c => c.studentIds.includes(studentData.id));
      setClasses(myClasses);
    });

    return unsubClasses;
  }, [studentData]);

  useEffect(() => {
    if (!studentData) return;

    const classIds = classes.map(c => c.id);
    const unsubAnnouncements = announcementService.subscribeForStudent(
      studentData.id,
      classIds,
      (anns) => {
        setAnnouncements(anns);
        setIsLoading(false);
      }
    );

    return unsubAnnouncements;
  }, [studentData, classes]);

  const getTargetLabel = (announcement: Announcement) => {
    if (announcement.targetType === 'all') return '전체 공지';
    if (announcement.targetType === 'class') {
      const targetClasses = classes.filter(c => announcement.classIds?.includes(c.id));
      return targetClasses.map(c => c.name).join(', ') || '클래스 공지';
    }
    return '개인 공지';
  };

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
      <div className="p-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">공지사항</h2>

        {announcements.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <p className="text-gray-500">공지사항이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((ann) => (
              <button
                key={ann.id}
                onClick={() => setSelectedAnnouncement(ann)}
                className="w-full bg-white rounded-xl p-4 shadow-sm text-left hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        ann.targetType === 'all'
                          ? 'bg-blue-100 text-blue-700'
                          : ann.targetType === 'class'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {getTargetLabel(ann)}
                      </span>
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">{ann.title}</h4>
                    <p className="text-sm text-gray-500 line-clamp-2">{ann.content}</p>
                  </div>
                  <div className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(ann.createdAt).toLocaleDateString('ko-KR', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* 공지 상세 모달 */}
        {selectedAnnouncement && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-900">공지사항</h3>
                <button
                  onClick={() => setSelectedAnnouncement(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 overflow-y-auto">
                <div className="mb-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    selectedAnnouncement.targetType === 'all'
                      ? 'bg-blue-100 text-blue-700'
                      : selectedAnnouncement.targetType === 'class'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    {getTargetLabel(selectedAnnouncement)}
                  </span>
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">{selectedAnnouncement.title}</h4>
                <p className="text-sm text-gray-500 mb-4">
                  {new Date(selectedAnnouncement.createdAt).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                  {selectedAnnouncement.authorName && ` · ${selectedAnnouncement.authorName}`}
                </p>
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedAnnouncement.content}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
