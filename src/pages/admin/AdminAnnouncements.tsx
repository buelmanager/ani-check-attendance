import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../contexts/AuthContext';
import { announcementService } from '../../services/announcementService';
import type { Announcement } from '../../types';

export default function AdminAnnouncements() {
  const { classes, students } = useStore();
  const { user, adminData } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'class' | 'student'>('all');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  useEffect(() => {
    const unsub = announcementService.subscribe((anns) => {
      setAnnouncements(anns);
      setIsLoading(false);
    });
    return unsub;
  }, []);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setTargetType('all');
    setSelectedClassIds([]);
    setSelectedStudentIds([]);
    setEditingAnnouncement(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (ann: Announcement) => {
    setEditingAnnouncement(ann);
    setTitle(ann.title);
    setContent(ann.content);
    setTargetType(ann.targetType);
    setSelectedClassIds(ann.classIds || []);
    setSelectedStudentIds(ann.studentIds || []);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }

    if (targetType === 'class' && selectedClassIds.length === 0) {
      alert('대상 클래스를 선택해주세요.');
      return;
    }

    if (targetType === 'student' && selectedStudentIds.length === 0) {
      alert('대상 학생을 선택해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = {
        title: title.trim(),
        content: content.trim(),
        authorId: user?.uid || '',
        authorName: adminData?.name || '관리자',
        targetType,
        classIds: targetType === 'class' ? selectedClassIds : undefined,
        studentIds: targetType === 'student' ? selectedStudentIds : undefined,
      };

      if (editingAnnouncement) {
        await announcementService.update(editingAnnouncement.id, data);
      } else {
        await announcementService.create(data);
      }

      closeModal();
    } catch (error) {
      console.error('Error saving announcement:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 이 공지사항을 삭제하시겠습니까?')) return;

    try {
      await announcementService.delete(id);
    } catch (error) {
      console.error('Error deleting announcement:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const getTargetLabel = (ann: Announcement) => {
    if (ann.targetType === 'all') return '전체';
    if (ann.targetType === 'class') {
      const targetClasses = classes.filter(c => ann.classIds?.includes(c.id));
      return targetClasses.map(c => c.name).join(', ') || '클래스';
    }
    if (ann.targetType === 'student') {
      const targetStudents = students.filter(s => ann.studentIds?.includes(s.id));
      return targetStudents.map(s => s.name).join(', ') || '학생';
    }
    return '';
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">공지사항 관리</h1>
          <p className="text-gray-500">{announcements.length}개의 공지사항</p>
        </div>
        <button onClick={openCreateModal} className="btn-accent flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          공지 작성
        </button>
      </div>

      {/* Announcements List */}
      <div className="card overflow-hidden p-0">
        {announcements.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <p className="text-gray-500">등록된 공지사항이 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {announcements.map((ann) => (
              <div key={ann.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-4">
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
                      <span className="text-xs text-gray-400">
                        {new Date(ann.createdAt).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{ann.title}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2">{ann.content}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(ann)}
                      className="p-2 text-gray-500 hover:text-accent rounded-lg hover:bg-accent/10"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(ann.id)}
                      className="p-2 text-gray-500 hover:text-red-500 rounded-lg hover:bg-red-50"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeModal} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                {editingAnnouncement ? '공지사항 수정' : '새 공지사항 작성'}
              </h2>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Title */}
              <div>
                <label className="text-sm text-gray-500 mb-2 block">제목</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="공지 제목을 입력하세요"
                  className="input-field"
                />
              </div>

              {/* Content */}
              <div>
                <label className="text-sm text-gray-500 mb-2 block">내용</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="공지 내용을 입력하세요"
                  rows={5}
                  className="input-field resize-none"
                />
              </div>

              {/* Target Type */}
              <div>
                <label className="text-sm text-gray-500 mb-2 block">대상</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetType('all')}
                    className={`flex-1 py-2 px-4 rounded-lg border transition-all ${
                      targetType === 'all'
                        ? 'bg-accent text-white border-accent'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-accent'
                    }`}
                  >
                    전체
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType('class')}
                    className={`flex-1 py-2 px-4 rounded-lg border transition-all ${
                      targetType === 'class'
                        ? 'bg-accent text-white border-accent'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-accent'
                    }`}
                  >
                    클래스
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType('student')}
                    className={`flex-1 py-2 px-4 rounded-lg border transition-all ${
                      targetType === 'student'
                        ? 'bg-accent text-white border-accent'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-accent'
                    }`}
                  >
                    학생
                  </button>
                </div>
              </div>

              {/* Class Selection */}
              {targetType === 'class' && (
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">클래스 선택</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-2">
                    {classes.map((cls) => (
                      <label key={cls.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedClassIds.includes(cls.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedClassIds([...selectedClassIds, cls.id]);
                            } else {
                              setSelectedClassIds(selectedClassIds.filter(id => id !== cls.id));
                            }
                          }}
                          className="w-4 h-4 text-accent rounded"
                        />
                        <span className="text-gray-700">{cls.name}</span>
                        <span className="text-xs text-gray-400">({cls.studentIds.length}명)</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Student Selection */}
              {targetType === 'student' && (
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">학생 선택</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-2">
                    {students.map((student) => (
                      <label key={student.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(student.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudentIds([...selectedStudentIds, student.id]);
                            } else {
                              setSelectedStudentIds(selectedStudentIds.filter(id => id !== student.id));
                            }
                          }}
                          className="w-4 h-4 text-accent rounded"
                        />
                        <span className="text-gray-700">{student.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t flex gap-3">
              <button onClick={closeModal} className="flex-1 btn-outline">
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 btn-accent disabled:opacity-50"
              >
                {isSubmitting ? '저장 중...' : editingAnnouncement ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
