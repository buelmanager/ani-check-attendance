import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ParentLayout } from '../../components/parent/ParentLayout';
import { studentService } from '../../services/studentService';
import { classService } from '../../services/classService';
import { announcementService } from '../../services/announcementService';
import type { Student, Class, Announcement } from '../../types';

export default function ParentNotices() {
  const { parentData } = useAuth();
  const [children, setChildren] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    if (!parentData) return;

    // 자녀 정보 로드
    const loadChildren = async () => {
      const childrenData: Student[] = [];
      for (const studentId of parentData.studentIds) {
        const student = await studentService.getById(studentId);
        if (student) {
          childrenData.push(student);
        }
      }
      setChildren(childrenData);
    };

    loadChildren();

    // 클래스 구독
    const unsubClasses = classService.subscribe((allClasses) => {
      // 자녀가 수강 중인 클래스만
      const childClasses = allClasses.filter(c =>
        parentData.studentIds.some(sid => c.studentIds.includes(sid))
      );
      setClasses(childClasses);
    });

    return unsubClasses;
  }, [parentData]);

  useEffect(() => {
    if (!parentData) return;

    // 모든 공지사항 구독 (부모는 전체 + 자녀 관련 공지)
    const unsubAnnouncements = announcementService.subscribe((allAnnouncements) => {
      const childIds = parentData.studentIds;
      const classIds = classes.map(c => c.id);

      // 필터링: 전체 공지 OR 자녀의 클래스 공지 OR 자녀 개인 공지
      const filtered = allAnnouncements.filter(a => {
        if (a.targetType === 'all') return true;
        if (a.targetType === 'class' && a.classIds?.some(id => classIds.includes(id))) return true;
        if (a.targetType === 'student' && a.studentIds?.some(id => childIds.includes(id))) return true;
        return false;
      });

      setAnnouncements(filtered);
      setIsLoading(false);
    });

    return unsubAnnouncements;
  }, [parentData, classes]);

  const getTargetLabel = (announcement: Announcement) => {
    if (announcement.targetType === 'all') return '전체 공지';
    if (announcement.targetType === 'class') {
      const targetClasses = classes.filter(c => announcement.classIds?.includes(c.id));
      return targetClasses.map(c => c.name).join(', ') || '클래스 공지';
    }
    if (announcement.targetType === 'student') {
      const targetChildren = children.filter(c => announcement.studentIds?.includes(c.id));
      return targetChildren.map(c => `${c.name} 공지`).join(', ') || '개인 공지';
    }
    return '공지';
  };

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
        <h2 className="text-xl font-bold text-gray-900 mb-4">공지사항</h2>

        {announcements.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
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
    </ParentLayout>
  );
}
