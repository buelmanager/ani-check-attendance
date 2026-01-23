import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { parentService } from '../../services/parentService';
import { studentService } from '../../services/studentService';
import { batchDeleteParents } from '../../lib/firebase';
import type { Parent, Student } from '../../types';

export default function AdminGuardians() {
  const navigate = useNavigate();
  const [parents, setParents] = useState<Parent[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // 데이터 구독
  useEffect(() => {
    const unsubParents = parentService.subscribe((data) => {
      setParents(data);
      setIsLoading(false);
    });
    const unsubStudents = studentService.subscribe((data) => {
      setStudents(data);
    });

    return () => {
      unsubParents();
      unsubStudents();
    };
  }, []);

  // 자연 정렬 함수 (숫자를 자연스럽게 정렬: 1, 2, 10, 11 순서)
  const naturalSort = (a: string, b: string) => {
    return a.localeCompare(b, 'ko', { numeric: true, sensitivity: 'base' });
  };

  // 필터링된 보호자 목록 (자연 정렬 적용)
  const filteredParents = parents
    .filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.phone && p.phone.includes(searchQuery));
      return matchesSearch;
    })
    .sort((a, b) => naturalSort(a.name, b.name));

  // 학생 ID로 학생 정보 가져오기
  const getStudentById = (studentId: string): Student | undefined => {
    return students.find(s => s.id === studentId);
  };

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectedIds.size === filteredParents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredParents.map(p => p.id)));
    }
  };

  // 개별 선택/해제
  const handleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // 선택 삭제 (Cloud Functions 사용)
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    const selectedParents = parents.filter(p => selectedIds.has(p.id));
    const hasAccountCount = selectedParents.filter(p => p.userId).length;

    let confirmMsg = `선택한 ${selectedIds.size}명의 보호자를 삭제하시겠습니까?`;
    if (hasAccountCount > 0) {
      confirmMsg += `\n\n⚠️ ${hasAccountCount}명의 앱 계정도 함께 삭제됩니다.`;
    }

    if (!confirm(confirmMsg)) return;

    setIsDeleting(true);
    try {
      // Cloud Functions를 사용하여 일괄 삭제
      const result = await batchDeleteParents(Array.from(selectedIds));

      setSelectedIds(new Set());

      if (result.success) {
        alert(`${result.deletedParents}명의 보호자가 삭제되었습니다.${result.deletedAuthUsers > 0 ? `\n(Auth 계정 ${result.deletedAuthUsers}개 삭제)` : ''}`);
      } else {
        const errorMessages = result.errors.map(e => e.error).join('\n');
        alert(`삭제 완료: ${result.deletedParents}명\n\n일부 오류 발생:\n${errorMessages}`);
      }
    } catch (error) {
      console.error('보호자 삭제 실패:', error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">로딩 중...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">보호자 관리</h1>
          <p className="text-gray-500">{parents.length}명의 보호자</p>
        </div>
      </div>

      {/* Search & Actions */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="보호자 이름 또는 연락처 검색..."
            className="input-field !pl-11"
          />
        </div>
        {selectedIds.size > 0 && (
          <button
            onClick={handleDeleteSelected}
            disabled={isDeleting}
            className="btn-secondary !bg-red-50 !text-red-600 hover:!bg-red-100 flex items-center gap-2"
          >
            {isDeleting ? (
              <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
            {selectedIds.size}명 삭제
          </button>
        )}
      </div>

      {/* Parents Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={filteredParents.length > 0 && selectedIds.size === filteredParents.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
                  />
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">이름</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">연락처</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">연결된 자녀</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">계정 상태</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-gray-500">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredParents.map((parent) => {
                const hasAccount = !!parent.userId;
                const childCount = parent.studentIds?.length || 0;

                return (
                  <tr key={parent.id} className={`hover:bg-gray-50/50 ${selectedIds.has(parent.id) ? 'bg-accent/5' : ''}`}>
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(parent.id)}
                        onChange={() => handleSelect(parent.id)}
                        className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <span className="text-green-700 font-bold text-sm">{parent.name.charAt(0)}</span>
                        </div>
                        <span className="font-medium text-gray-900">{parent.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{parent.phone || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {childCount > 0 ? (
                          parent.studentIds?.map(studentId => {
                            const student = getStudentById(studentId);
                            return student ? (
                              <button
                                key={studentId}
                                onClick={() => navigate(`/admin/students/${studentId}`)}
                                className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100 transition-colors"
                              >
                                {student.name}
                              </button>
                            ) : null;
                          })
                        ) : (
                          <span className="text-gray-400 text-sm">연결된 자녀 없음</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        hasAccount ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {hasAccount ? '연결됨' : '미연결'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {childCount > 0 && (
                          <button
                            onClick={() => navigate(`/admin/students/${parent.studentIds?.[0]}`)}
                            className="p-2 text-gray-500 hover:text-primary rounded-lg hover:bg-primary/10"
                            title="자녀 상세보기"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredParents.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {searchQuery ? '검색 결과가 없습니다.' : '등록된 보호자가 없습니다.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className="mt-6 bg-blue-50 rounded-xl p-4">
        <h3 className="font-medium text-blue-900 mb-2">보호자 관리 안내</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• 보호자는 학생 등록 시 함께 등록됩니다.</li>
          <li>• 같은 전화번호의 보호자가 등록되면 자동으로 기존 계정과 연결됩니다.</li>
          <li>• 여러 자녀의 보호자는 하나의 계정으로 통합 관리됩니다.</li>
        </ul>
      </div>
    </AdminLayout>
  );
}
