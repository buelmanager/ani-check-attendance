import * as XLSX from 'xlsx';
import type { Student, Class, StudentStatus, Parent } from '../types';

// 상태 라벨
const STATUS_LABELS: Record<StudentStatus, string> = {
  active: '재원',
  inactive: '휴원',
  withdrawn: '퇴원'
};

// 성별 라벨
const GENDER_LABELS: Record<string, string> = {
  male: '남',
  female: '여'
};

interface ExportStudentRow {
  이름: string;
  초대코드: string;
  상태: string;
  학년: string;
  생년월일: string;
  나이: string;
  성별: string;
  학교: string;
  학생연락처: string;
  보호자연락처: string;
  긴급연락처: string;
  주소: string;
  등록클래스: string;
  입학일: string;
  계정연결: string;
  부모연결: string;
  메모: string;
  생성일: string;
}

interface ExportParentRow {
  이름: string;
  이메일: string;
  연락처: string;
  연결된자녀: string;
  자녀수: number;
  생성일: string;
}

// 나이 계산
const calculateAge = (birthDate: string): number => {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

// 날짜 포맷
const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch {
    return dateStr;
  }
};

// 학생 데이터를 엑셀 행 데이터로 변환
const studentToRow = (student: Student, classes: Class[]): ExportStudentRow => {
  // 학생이 속한 클래스 이름 목록
  const studentClasses = classes
    .filter(c => c.studentIds.includes(student.id))
    .map(c => c.name)
    .join(', ');

  return {
    이름: student.name,
    초대코드: student.inviteCode || '',
    상태: STATUS_LABELS[student.status || 'active'],
    학년: student.grade || '',
    생년월일: formatDate(student.birthDate),
    나이: student.birthDate ? `만 ${calculateAge(student.birthDate)}세` : '',
    성별: student.gender ? GENDER_LABELS[student.gender] : '',
    학교: student.school || '',
    학생연락처: student.phone || '',
    보호자연락처: student.parentPhone || '',
    긴급연락처: student.emergencyContact || '',
    주소: student.address || '',
    등록클래스: studentClasses || '-',
    입학일: formatDate(student.enrolledAt),
    계정연결: student.userId ? '연결됨' : '미연결',
    부모연결: student.parentIds && student.parentIds.length > 0
      ? `${student.parentIds.length}명`
      : '미연결',
    메모: student.notes || '',
    생성일: formatDate(student.createdAt)
  };
};

// 부모 데이터를 엑셀 행 데이터로 변환
const parentToRow = (parent: Parent, students: Student[]): ExportParentRow => {
  // 연결된 자녀 이름 목록
  const childNames = students
    .filter(s => parent.studentIds.includes(s.id))
    .map(s => s.name)
    .join(', ');

  return {
    이름: parent.name,
    이메일: parent.email || '',
    연락처: parent.phone || '',
    연결된자녀: childNames || '-',
    자녀수: parent.studentIds?.length || 0,
    생성일: formatDate(parent.createdAt)
  };
};

// 엑셀 파일 다운로드 (학생만)
const downloadExcel = (data: ExportStudentRow[], filename: string): void => {
  // 워크북 생성
  const wb = XLSX.utils.book_new();

  // 워크시트 생성
  const ws = XLSX.utils.json_to_sheet(data);

  // 컬럼 너비 설정
  const columnWidths = [
    { wch: 10 },  // 이름
    { wch: 10 },  // 초대코드
    { wch: 8 },   // 상태
    { wch: 8 },   // 학년
    { wch: 12 },  // 생년월일
    { wch: 10 },  // 나이
    { wch: 6 },   // 성별
    { wch: 15 },  // 학교
    { wch: 15 },  // 학생연락처
    { wch: 15 },  // 보호자연락처
    { wch: 15 },  // 긴급연락처
    { wch: 30 },  // 주소
    { wch: 20 },  // 등록클래스
    { wch: 12 },  // 입학일
    { wch: 10 },  // 계정연결
    { wch: 10 },  // 부모연결
    { wch: 30 },  // 메모
    { wch: 12 },  // 생성일
  ];
  ws['!cols'] = columnWidths;

  // 워크시트를 워크북에 추가
  XLSX.utils.book_append_sheet(wb, ws, '학생목록');

  // 파일 다운로드
  XLSX.writeFile(wb, filename);
};

// 엑셀 파일 다운로드 (학생 + 부모 시트)
const downloadExcelWithParents = (
  studentData: ExportStudentRow[],
  parentData: ExportParentRow[],
  filename: string
): void => {
  // 워크북 생성
  const wb = XLSX.utils.book_new();

  // 학생 워크시트 생성
  const studentWs = XLSX.utils.json_to_sheet(studentData);
  const studentColumnWidths = [
    { wch: 10 },  // 이름
    { wch: 10 },  // 초대코드
    { wch: 8 },   // 상태
    { wch: 8 },   // 학년
    { wch: 12 },  // 생년월일
    { wch: 10 },  // 나이
    { wch: 6 },   // 성별
    { wch: 15 },  // 학교
    { wch: 15 },  // 학생연락처
    { wch: 15 },  // 보호자연락처
    { wch: 15 },  // 긴급연락처
    { wch: 30 },  // 주소
    { wch: 20 },  // 등록클래스
    { wch: 12 },  // 입학일
    { wch: 10 },  // 계정연결
    { wch: 10 },  // 부모연결
    { wch: 30 },  // 메모
    { wch: 12 },  // 생성일
  ];
  studentWs['!cols'] = studentColumnWidths;
  XLSX.utils.book_append_sheet(wb, studentWs, '학생목록');

  // 부모 워크시트 생성
  const parentWs = XLSX.utils.json_to_sheet(parentData);
  const parentColumnWidths = [
    { wch: 10 },  // 이름
    { wch: 25 },  // 이메일
    { wch: 15 },  // 연락처
    { wch: 20 },  // 연결된자녀
    { wch: 8 },   // 자녀수
    { wch: 12 },  // 생성일
  ];
  parentWs['!cols'] = parentColumnWidths;
  XLSX.utils.book_append_sheet(wb, parentWs, '학부모목록');

  // 파일 다운로드
  XLSX.writeFile(wb, filename);
};

// 전체 학생 엑셀 내보내기
export const exportAllStudents = (students: Student[], classes: Class[]): void => {
  const data = students.map(student => studentToRow(student, classes));
  const today = new Date().toISOString().split('T')[0];
  downloadExcel(data, `전체_학생목록_${today}.xlsx`);
};

// 필터링된 학생 엑셀 내보내기
export const exportFilteredStudents = (
  students: Student[],
  classes: Class[],
  filterName?: string
): void => {
  const data = students.map(student => studentToRow(student, classes));
  const today = new Date().toISOString().split('T')[0];
  const filename = filterName
    ? `${filterName}_학생목록_${today}.xlsx`
    : `학생목록_${today}.xlsx`;
  downloadExcel(data, filename);
};

// 특정 클래스의 학생 엑셀 내보내기
export const exportClassStudents = (
  classInfo: Class,
  students: Student[],
  allClasses: Class[]
): void => {
  // 해당 클래스에 속한 학생만 필터링
  const classStudents = students.filter(s => classInfo.studentIds.includes(s.id));
  const data = classStudents.map(student => studentToRow(student, allClasses));
  const today = new Date().toISOString().split('T')[0];
  downloadExcel(data, `${classInfo.name}_학생목록_${today}.xlsx`);
};

// 상태별 학생 엑셀 내보내기
export const exportStudentsByStatus = (
  students: Student[],
  classes: Class[],
  status: StudentStatus
): void => {
  const filteredStudents = students.filter(s => (s.status || 'active') === status);
  const data = filteredStudents.map(student => studentToRow(student, classes));
  const today = new Date().toISOString().split('T')[0];
  const statusLabel = STATUS_LABELS[status];
  downloadExcel(data, `${statusLabel}_학생목록_${today}.xlsx`);
};

// 전체 백업용 엑셀 내보내기 (학생 + 부모 시트)
export const exportFullBackup = (
  students: Student[],
  classes: Class[],
  parents: Parent[]
): void => {
  const studentData = students.map(student => studentToRow(student, classes));
  const parentData = parents.map(parent => parentToRow(parent, students));
  const today = new Date().toISOString().split('T')[0];
  downloadExcelWithParents(studentData, parentData, `전체_백업_${today}.xlsx`);
};
