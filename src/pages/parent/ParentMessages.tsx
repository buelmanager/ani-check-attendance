import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ParentLayout } from '../../components/parent/ParentLayout';
import { studentService } from '../../services/studentService';
import { classService } from '../../services/classService';
import { noticeService, replaceTemplateVariables } from '../../services/noticeService';
import type { Student, Class } from '../../types';
import type { Notice } from '../../types/notice';

export default function ParentMessages() {
  const { user, parentData } = useAuth();
  const [children, setChildren] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);

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
      setClasses(allClasses);
    });

    return unsubClasses;
  }, [parentData]);

  useEffect(() => {
    if (!parentData || children.length === 0) return;

    // 알림장 구독 - 발송된 것만
    const unsubNotices = noticeService.subscribeSent((allNotices) => {
      const childIds = parentData.studentIds;
      // 자녀들이 속한 반 ID 찾기
      const childClassIds = classes
        .filter(c => c.studentIds.some(sid => childIds.includes(sid)))
        .map(c => c.id);

      // 필터링: 전체 대상 OR 자녀의 반 OR 자녀 개별
      const filtered = allNotices.filter(notice => {
        if (notice.targetType === 'all') return true;
        if (notice.targetType === 'class' && notice.targetIds.some(id => childClassIds.includes(id))) return true;
        if (notice.targetType === 'student' && notice.targetIds.some(id => childIds.includes(id))) return true;
        return false;
      });

      setNotices(filtered);
      setIsLoading(false);
    });

    return unsubNotices;
  }, [parentData, children]);

  // 알림장 열람 시 읽음 처리
  const handleOpenNotice = async (notice: Notice) => {
    setSelectedNotice(notice);

    // 읽음 처리 (이미 읽었으면 스킵)
    if (user && parentData) {
      const alreadyRead = notice.readReceipts.some(r => r.userId === user.uid);
      if (!alreadyRead) {
        try {
          await noticeService.markAsRead(notice.id, user.uid, parentData.name || '학부모');
        } catch (error) {
          console.error('Error marking notice as read:', error);
        }
      }
    }
  };

  // 변수 치환된 내용 가져오기
  const getReplacedContent = (notice: Notice) => {
    // 첫 번째 자녀 정보로 치환
    if (children.length > 0) {
      const child = children[0];
      // 자녀가 속한 반 찾기
      const childClass = classes.find(c => c.studentIds.includes(child.id));
      return replaceTemplateVariables(notice.content, child.name, childClass?.name);
    }
    return notice.content;
  };

  const getTargetLabel = (notice: Notice) => {
    if (notice.targetType === 'all') return '전체';
    if (notice.targetType === 'class') return notice.targetNames.join(', ');
    return notice.targetNames.join(', ');
  };

  const isRead = (notice: Notice) => {
    if (!user) return false;
    return notice.readReceipts.some(r => r.userId === user.uid);
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
        <h2 className="text-xl font-bold text-gray-900 mb-4">알림장</h2>

        {notices.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-500">받은 알림장이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notices.map((notice) => {
              const read = isRead(notice);
              return (
                <button
                  key={notice.id}
                  onClick={() => handleOpenNotice(notice)}
                  className={`w-full bg-white rounded-xl p-4 shadow-sm text-left hover:shadow-md transition-shadow ${
                    !read ? 'border-l-4 border-l-accent' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {!read && (
                          <span className="w-2 h-2 bg-accent rounded-full"></span>
                        )}
                        <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700">
                          {getTargetLabel(notice)}
                        </span>
                      </div>
                      <h4 className={`font-semibold mb-1 ${read ? 'text-gray-600' : 'text-gray-900'}`}>
                        {notice.title}
                      </h4>
                      <p className="text-sm text-gray-500 line-clamp-2">
                        {getReplacedContent(notice)}
                      </p>
                    </div>
                    <div className="text-xs text-gray-400 whitespace-nowrap">
                      {notice.sentAt && new Date(notice.sentAt).toLocaleDateString('ko-KR', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 알림장 상세 모달 */}
        {selectedNotice && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-900">알림장</h3>
                <button
                  onClick={() => setSelectedNotice(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 overflow-y-auto">
                <div className="mb-4">
                  <span className="px-2 py-1 text-xs rounded-full bg-indigo-100 text-indigo-700">
                    {getTargetLabel(selectedNotice)}
                  </span>
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">{selectedNotice.title}</h4>
                <p className="text-sm text-gray-500 mb-4">
                  {selectedNotice.sentAt && new Date(selectedNotice.sentAt).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                  {selectedNotice.createdByName && ` · ${selectedNotice.createdByName}`}
                </p>
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {getReplacedContent(selectedNotice)}
                  </p>
                </div>

                {/* 첨부파일 */}
                {selectedNotice.attachments && selectedNotice.attachments.length > 0 && (
                  <div className="mt-6 pt-4 border-t">
                    <h5 className="text-sm font-medium text-gray-700 mb-2">첨부파일</h5>
                    <ul className="space-y-2">
                      {selectedNotice.attachments.map((file, index) => (
                        <li key={index}>
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            {file.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ParentLayout>
  );
}
