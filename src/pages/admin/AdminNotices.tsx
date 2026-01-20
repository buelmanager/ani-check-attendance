import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../contexts/AuthContext';
import { noticeService, replaceTemplateVariables } from '../../services/noticeService';
import type { Notice, NoticeTargetType, NoticeTemplate, CreateNoticeData } from '../../types/notice';
import type { Student } from '../../types';

type ViewMode = 'list' | 'create' | 'detail';

export default function AdminNotices() {
  const { user, adminData } = useAuth();
  const { classes, students } = useStore();

  const [notices, setNotices] = useState<Notice[]>([]);
  const [templates, setTemplates] = useState<NoticeTemplate[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 필터
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'sent'>('all');

  // 폼 상태
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    targetType: 'all' as NoticeTargetType,
    targetIds: [] as string[],
    status: 'draft' as 'draft' | 'sent'
  });

  // 템플릿 모달
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // 미리보기 모달
  const [showPreview, setShowPreview] = useState(false);
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);

  useEffect(() => {
    const unsubNotices = noticeService.subscribeAll(setNotices);
    const unsubTemplates = noticeService.subscribeTemplates(setTemplates);
    setLoading(false);

    return () => {
      unsubNotices();
      unsubTemplates();
    };
  }, []);

  const activeStudents = students.filter(s => s.status === 'active');

  const filteredNotices = notices.filter(notice => {
    if (statusFilter === 'all') return true;
    return notice.status === statusFilter;
  });

  const getTargetStudents = (): Student[] => {
    if (formData.targetType === 'all') {
      return activeStudents;
    } else if (formData.targetType === 'class') {
      // 선택된 반에 속한 학생들 찾기
      const selectedClassStudentIds = classes
        .filter(c => formData.targetIds.includes(c.id))
        .flatMap(c => c.studentIds);
      return activeStudents.filter(s => selectedClassStudentIds.includes(s.id));
    } else {
      return activeStudents.filter(s => formData.targetIds.includes(s.id));
    }
  };

  const getTargetNames = (): string[] => {
    if (formData.targetType === 'all') {
      return ['전체'];
    } else if (formData.targetType === 'class') {
      return classes
        .filter(c => formData.targetIds.includes(c.id))
        .map(c => c.name);
    } else {
      return students
        .filter(s => formData.targetIds.includes(s.id))
        .map(s => s.name);
    }
  };

  const handleCreate = () => {
    setFormData({
      title: '',
      content: '',
      targetType: 'all',
      targetIds: [],
      status: 'draft'
    });
    setSelectedNotice(null);
    setViewMode('create');
  };

  const handleEdit = (notice: Notice) => {
    setFormData({
      title: notice.title,
      content: notice.content,
      targetType: notice.targetType,
      targetIds: notice.targetIds,
      status: notice.status === 'sent' ? 'sent' : 'draft'
    });
    setSelectedNotice(notice);
    setViewMode('create');
  };

  const handleViewDetail = (notice: Notice) => {
    setSelectedNotice(notice);
    setViewMode('detail');
  };

  const handleSave = async (send: boolean = false) => {
    if (!user || !adminData) return;
    if (!formData.title.trim() || !formData.content.trim()) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const data: CreateNoticeData = {
        title: formData.title,
        content: formData.content,
        targetType: formData.targetType,
        targetIds: formData.targetType === 'all' ? [] : formData.targetIds,
        targetNames: getTargetNames(),
        status: send ? 'sent' : 'draft',
        createdBy: user.uid,
        createdByName: adminData.name || '관리자',
        scheduledAt: undefined
      };

      if (selectedNotice && selectedNotice.status !== 'sent') {
        await noticeService.update(selectedNotice.id, {
          ...data,
          ...(send && { sentAt: new Date().toISOString() })
        });
        if (send) {
          await noticeService.send(selectedNotice.id);
        }
      } else {
        const id = await noticeService.create(data);
        if (send) {
          await noticeService.send(id);
        }
      }

      setViewMode('list');
    } catch (error) {
      console.error('Error saving notice:', error);
      alert('알림장 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (notice: Notice) => {
    if (!confirm('정말 이 알림장을 삭제하시겠습니까?')) return;

    try {
      await noticeService.delete(notice.id);
      if (viewMode === 'detail') {
        setViewMode('list');
      }
    } catch (error) {
      console.error('Error deleting notice:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleSaveTemplate = async () => {
    if (!user || !templateName.trim()) return;

    try {
      await noticeService.createTemplate({
        name: templateName,
        title: formData.title,
        content: formData.content,
        createdBy: user.uid
      });
      setShowTemplateModal(false);
      setTemplateName('');
      alert('템플릿이 저장되었습니다.');
    } catch (error) {
      console.error('Error saving template:', error);
      alert('템플릿 저장 중 오류가 발생했습니다.');
    }
  };

  const handleLoadTemplate = (template: NoticeTemplate) => {
    setFormData(prev => ({
      ...prev,
      title: template.title,
      content: template.content
    }));
    setShowTemplateModal(false);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('이 템플릿을 삭제하시겠습니까?')) return;
    try {
      await noticeService.deleteTemplate(templateId);
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const handlePreview = () => {
    const targetStudents = getTargetStudents();
    if (targetStudents.length > 0) {
      setPreviewStudent(targetStudents[0]);
    }
    setShowPreview(true);
  };

  const getPreviewContent = () => {
    if (!previewStudent) return formData.content;
    // 학생이 속한 반 찾기
    const studentClass = classes.find(c => c.studentIds.includes(previewStudent.id));
    return replaceTemplateVariables(
      formData.content,
      previewStudent.name,
      studentClass?.name
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // 상세 보기
  if (viewMode === 'detail' && selectedNotice) {
    const readCount = selectedNotice.readReceipts.length;
    const totalTargets = selectedNotice.targetType === 'all'
      ? activeStudents.length
      : selectedNotice.targetIds.length;

    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => setViewMode('list')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          목록으로
        </button>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  selectedNotice.status === 'sent'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {selectedNotice.status === 'sent' ? '발송됨' : '임시저장'}
                </span>
                <span className="text-sm text-gray-500">
                  대상: {selectedNotice.targetNames.join(', ')}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{selectedNotice.title}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {selectedNotice.createdByName} · {formatDate(selectedNotice.sentAt || selectedNotice.createdAt)}
              </p>
            </div>
            <div className="flex gap-2">
              {selectedNotice.status !== 'sent' && (
                <button
                  onClick={() => handleEdit(selectedNotice)}
                  className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                >
                  수정
                </button>
              )}
              <button
                onClick={() => handleDelete(selectedNotice)}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                삭제
              </button>
            </div>
          </div>

          <div className="prose max-w-none mb-8">
            <div className="whitespace-pre-wrap text-gray-700">
              {selectedNotice.content}
            </div>
          </div>

          {selectedNotice.status === 'sent' && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">
                읽음 현황 ({readCount}/{totalTargets})
              </h3>
              {selectedNotice.readReceipts.length > 0 ? (
                <ul className="space-y-2">
                  {selectedNotice.readReceipts.map((receipt, index) => (
                    <li key={index} className="flex items-center justify-between text-sm">
                      <span>{receipt.userName}</span>
                      <span className="text-gray-500">{formatDate(receipt.readAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-sm">아직 읽은 사람이 없습니다.</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 작성/수정 폼
  if (viewMode === 'create') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => setViewMode('list')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          취소
        </button>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            {selectedNotice ? '알림장 수정' : '새 알림장 작성'}
          </h1>

          <div className="space-y-6">
            {/* 대상 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">발송 대상</label>
              <div className="flex gap-4 mb-3">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={formData.targetType === 'all'}
                    onChange={() => setFormData(prev => ({ ...prev, targetType: 'all', targetIds: [] }))}
                    className="mr-2"
                  />
                  전체
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={formData.targetType === 'class'}
                    onChange={() => setFormData(prev => ({ ...prev, targetType: 'class', targetIds: [] }))}
                    className="mr-2"
                  />
                  반별
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={formData.targetType === 'student'}
                    onChange={() => setFormData(prev => ({ ...prev, targetType: 'student', targetIds: [] }))}
                    className="mr-2"
                  />
                  개별 학생
                </label>
              </div>

              {formData.targetType === 'class' && (
                <div className="flex flex-wrap gap-2">
                  {classes.map(cls => (
                    <label
                      key={cls.id}
                      className={`px-3 py-2 rounded-lg border cursor-pointer ${
                        formData.targetIds.includes(cls.id)
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.targetIds.includes(cls.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({ ...prev, targetIds: [...prev.targetIds, cls.id] }));
                          } else {
                            setFormData(prev => ({ ...prev, targetIds: prev.targetIds.filter(id => id !== cls.id) }));
                          }
                        }}
                        className="hidden"
                      />
                      {cls.name}
                    </label>
                  ))}
                </div>
              )}

              {formData.targetType === 'student' && (
                <div className="max-h-48 overflow-y-auto border rounded-lg p-2">
                  {activeStudents.map(student => (
                    <label
                      key={student.id}
                      className={`flex items-center p-2 rounded cursor-pointer ${
                        formData.targetIds.includes(student.id)
                          ? 'bg-indigo-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.targetIds.includes(student.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({ ...prev, targetIds: [...prev.targetIds, student.id] }));
                          } else {
                            setFormData(prev => ({ ...prev, targetIds: prev.targetIds.filter(id => id !== student.id) }));
                          }
                        }}
                        className="mr-3"
                      />
                      <span>{student.name}</span>
                      <span className="ml-2 text-sm text-gray-500">
                        ({classes.find(c => c.studentIds.includes(student.id))?.name || '미배정'})
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* 제목 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">제목</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="알림장 제목을 입력하세요"
              />
            </div>

            {/* 내용 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">내용</label>
                <div className="text-xs text-gray-500">
                  사용 가능한 변수: {'{학생이름}'}, {'{반이름}'}, {'{오늘날짜}'}, {'{내일날짜}'}
                </div>
              </div>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                rows={10}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="알림장 내용을 입력하세요"
              />
            </div>

            {/* 버튼들 */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex gap-2">
                <button
                  onClick={() => setShowTemplateModal(true)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  템플릿 불러오기
                </button>
                <button
                  onClick={handlePreview}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  미리보기
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '임시 저장'}
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving || (formData.targetType !== 'all' && formData.targetIds.length === 0)}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? '발송 중...' : '발송하기'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 템플릿 모달 */}
        {showTemplateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b">
                <h2 className="text-xl font-bold">템플릿 관리</h2>
              </div>
              <div className="p-6 overflow-y-auto max-h-[50vh]">
                {templates.length > 0 ? (
                  <ul className="space-y-3">
                    {templates.map(template => (
                      <li key={template.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <button
                          onClick={() => handleLoadTemplate(template)}
                          className="flex-1 text-left"
                        >
                          <p className="font-medium">{template.name}</p>
                          <p className="text-sm text-gray-500">{template.title}</p>
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="ml-2 text-red-500 hover:text-red-700"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 text-center py-8">저장된 템플릿이 없습니다.</p>
                )}

                <div className="mt-6 pt-6 border-t">
                  <h3 className="font-medium mb-3">현재 내용을 템플릿으로 저장</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="템플릿 이름"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                    />
                    <button
                      onClick={handleSaveTemplate}
                      disabled={!templateName.trim() || !formData.title.trim()}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      저장
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t bg-gray-50">
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="w-full py-2 text-gray-600 hover:text-gray-900"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 미리보기 모달 */}
        {showPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
              <div className="p-6 border-b flex items-center justify-between">
                <h2 className="text-xl font-bold">미리보기</h2>
                {getTargetStudents().length > 1 && (
                  <select
                    value={previewStudent?.id || ''}
                    onChange={(e) => {
                      const student = activeStudents.find(s => s.id === e.target.value);
                      setPreviewStudent(student || null);
                    }}
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    {getTargetStudents().map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold mb-4">{formData.title}</h3>
                <div className="whitespace-pre-wrap text-gray-700">
                  {getPreviewContent()}
                </div>
              </div>
              <div className="p-4 border-t bg-gray-50">
                <button
                  onClick={() => setShowPreview(false)}
                  className="w-full py-2 text-gray-600 hover:text-gray-900"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 목록 뷰
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">알림장 관리</h1>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          새 알림장
        </button>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-6">
        {(['all', 'sent', 'draft'] as const).map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg ${
              statusFilter === status
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status === 'all' ? '전체' : status === 'sent' ? '발송됨' : '임시저장'}
          </button>
        ))}
      </div>

      {/* 알림장 목록 */}
      {filteredNotices.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500">알림장이 없습니다.</p>
          <button
            onClick={handleCreate}
            className="mt-4 text-indigo-600 hover:text-indigo-700"
          >
            새 알림장 작성하기
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNotices.map(notice => {
            const readCount = notice.readReceipts.length;
            const totalTargets = notice.targetType === 'all'
              ? activeStudents.length
              : notice.targetIds.length;

            return (
              <div
                key={notice.id}
                className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleViewDetail(notice)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        notice.status === 'sent'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {notice.status === 'sent' ? '발송됨' : '임시저장'}
                      </span>
                      <span className="text-sm text-gray-500">
                        대상: {notice.targetNames.join(', ')}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">{notice.title}</h3>
                    <p className="text-gray-600 text-sm mt-1 line-clamp-2">{notice.content}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {notice.createdByName} · {formatDate(notice.sentAt || notice.createdAt)}
                    </p>
                  </div>
                  {notice.status === 'sent' && (
                    <div className="ml-4 text-center">
                      <div className="text-2xl font-bold text-indigo-600">
                        {totalTargets > 0 ? Math.round((readCount / totalTargets) * 100) : 0}%
                      </div>
                      <div className="text-xs text-gray-500">
                        읽음 {readCount}/{totalTargets}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
