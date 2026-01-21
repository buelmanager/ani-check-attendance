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
  연락처: string;
  로그인이메일: string;
  주소: string;
  등록클래스: string;
  입학일: string;
  계정상태: string;
  보호자연결: string;
  메모: string;
  생성일: string;
}

interface ExportParentRow {
  이름: string;
  연락처: string;
  로그인이메일: string;
  연결된자녀: string;
  자녀수: number;
  계정상태: string;
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

// 전화번호로 로그인 이메일 생성 (student_01012345678@aniwith.com)
const generateLoginEmail = (phone: string | undefined, type: 'student' | 'guardian'): string => {
  if (!phone) return '';
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (!cleanPhone) return '';
  return `${type}_${cleanPhone}@aniwith.com`;
};

// 학생 데이터를 엑셀 행 데이터로 변환
const studentToRow = (student: Student, classes: Class[]): ExportStudentRow => {
  // 학생이 속한 클래스 이름 목록
  const studentClasses = classes
    .filter(c => c.studentIds.includes(student.id))
    .map(c => c.name)
    .join(', ');

  // 로그인 이메일 생성 (전화번호가 있는 경우)
  const loginEmail = generateLoginEmail(student.phone, 'student');

  return {
    이름: student.name,
    초대코드: student.inviteCode || '',
    상태: STATUS_LABELS[student.status || 'active'],
    학년: student.grade || '',
    생년월일: formatDate(student.birthDate),
    나이: student.birthDate ? `만 ${calculateAge(student.birthDate)}세` : '',
    성별: student.gender ? GENDER_LABELS[student.gender] : '',
    학교: student.school || '',
    연락처: student.phone || '',
    로그인이메일: loginEmail,
    주소: student.address || '',
    등록클래스: studentClasses || '-',
    입학일: formatDate(student.enrolledAt),
    계정상태: student.userId ? '활성화' : (student.phone ? '미활성화' : '연락처없음'),
    보호자연결: student.parentIds && student.parentIds.length > 0
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

  // 로그인 이메일 생성 (전화번호가 있는 경우)
  const loginEmail = generateLoginEmail(parent.phone, 'guardian');

  return {
    이름: parent.name,
    연락처: parent.phone || '',
    로그인이메일: loginEmail || parent.email || '',
    연결된자녀: childNames || '-',
    자녀수: parent.studentIds?.length || 0,
    계정상태: parent.userId ? '활성화' : (parent.phone ? '미활성화' : '연락처없음'),
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
    { wch: 15 },  // 연락처
    { wch: 35 },  // 로그인이메일
    { wch: 30 },  // 주소
    { wch: 20 },  // 등록클래스
    { wch: 12 },  // 입학일
    { wch: 12 },  // 계정상태
    { wch: 10 },  // 보호자연결
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
    { wch: 15 },  // 연락처
    { wch: 35 },  // 로그인이메일
    { wch: 30 },  // 주소
    { wch: 20 },  // 등록클래스
    { wch: 12 },  // 입학일
    { wch: 12 },  // 계정상태
    { wch: 10 },  // 보호자연결
    { wch: 30 },  // 메모
    { wch: 12 },  // 생성일
  ];
  studentWs['!cols'] = studentColumnWidths;
  XLSX.utils.book_append_sheet(wb, studentWs, '학생목록');

  // 부모 워크시트 생성
  const parentWs = XLSX.utils.json_to_sheet(parentData);
  const parentColumnWidths = [
    { wch: 10 },  // 이름
    { wch: 15 },  // 연락처
    { wch: 35 },  // 로그인이메일
    { wch: 20 },  // 연결된자녀
    { wch: 8 },   // 자녀수
    { wch: 12 },  // 계정상태
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

// ============== 엑셀 가져오기 (Import) ==============

// 상태 라벨 역변환
const STATUS_REVERSE: Record<string, StudentStatus> = {
  '재원': 'active',
  '휴원': 'inactive',
  '퇴원': 'withdrawn'
};

// 성별 라벨 역변환
const GENDER_REVERSE: Record<string, 'male' | 'female'> = {
  '남': 'male',
  '여': 'female'
};

// 한국어 날짜 포맷을 ISO 형식으로 변환 (예: "2024. 01. 15." -> "2024-01-15")
const parseKoreanDate = (dateStr: string): string => {
  if (!dateStr) return '';
  // 이미 ISO 형식이면 그대로 반환
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.split('T')[0];
  }
  // 한국어 형식 파싱 (2024. 01. 15. 또는 2024.01.15)
  const match = dateStr.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return '';
};

// 엑셀 행 데이터를 학생 데이터로 변환
interface ImportStudentData {
  name: string;
  inviteCode?: string;
  status: StudentStatus;
  grade?: string;
  birthDate?: string;
  gender?: 'male' | 'female';
  school?: string;
  phone?: string;
  address?: string;
  enrolledAt?: string;
  notes?: string;
}

const rowToStudent = (row: Record<string, unknown>): ImportStudentData | null => {
  const name = String(row['이름'] || '').trim();
  if (!name) return null;

  return {
    name,
    inviteCode: String(row['초대코드'] || '').trim() || undefined,
    status: STATUS_REVERSE[String(row['상태'] || '')] || 'active',
    grade: String(row['학년'] || '').trim() || undefined,
    birthDate: parseKoreanDate(String(row['생년월일'] || '')),
    gender: GENDER_REVERSE[String(row['성별'] || '')] || undefined,
    school: String(row['학교'] || '').trim() || undefined,
    phone: String(row['연락처'] || '').trim() || undefined,
    address: String(row['주소'] || '').trim() || undefined,
    enrolledAt: parseKoreanDate(String(row['입학일'] || '')),
    notes: String(row['메모'] || '').trim() || undefined
  };
};

// 엑셀 파일에서 학생 데이터 읽기
export const readStudentsFromExcel = (file: File): Promise<ImportStudentData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        // 첫 번째 시트 또는 '학생목록' 시트 찾기
        const sheetName = workbook.SheetNames.includes('학생목록')
          ? '학생목록'
          : workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // 시트를 JSON으로 변환
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        // 학생 데이터로 변환
        const students: ImportStudentData[] = [];
        for (const row of rows) {
          const student = rowToStudent(row);
          if (student) {
            students.push(student);
          }
        }

        resolve(students);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('파일을 읽을 수 없습니다.'));
    };

    reader.readAsBinaryString(file);
  });
};

// Import 결과 타입
export interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

// ============== 학부모 엑셀 가져오기 ==============

interface ImportParentData {
  name: string;
  phone?: string;
  childNames?: string[]; // 연결된 자녀 이름 (쉼표로 구분된 문자열에서 파싱)
}

const rowToParent = (row: Record<string, unknown>): ImportParentData | null => {
  const name = String(row['이름'] || '').trim();
  if (!name) return null;

  // 연결된 자녀 이름 파싱 (쉼표로 구분)
  const childNamesStr = String(row['연결된자녀'] || '').trim();
  const childNames = childNamesStr && childNamesStr !== '-'
    ? childNamesStr.split(',').map(n => n.trim()).filter(n => n)
    : [];

  return {
    name,
    phone: String(row['연락처'] || '').trim() || undefined,
    childNames: childNames.length > 0 ? childNames : undefined
  };
};

// 엑셀 파일에서 학부모 데이터 읽기
export const readParentsFromExcel = (file: File): Promise<ImportParentData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        console.log('[readParentsFromExcel] 시트 목록:', workbook.SheetNames);

        // '학부모목록' 시트 찾기
        if (!workbook.SheetNames.includes('학부모목록')) {
          console.warn('[readParentsFromExcel] "학부모목록" 시트가 없습니다. 시트 목록:', workbook.SheetNames);
          resolve([]); // 학부모 시트가 없으면 빈 배열 반환
          return;
        }

        const worksheet = workbook.Sheets['학부모목록'];

        // 시트를 JSON으로 변환
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
        console.log('[readParentsFromExcel] 학부모 행 데이터:', rows);

        // 학부모 데이터로 변환
        const parents: ImportParentData[] = [];
        for (const row of rows) {
          console.log('[readParentsFromExcel] 처리 중인 행:', row);
          const parent = rowToParent(row);
          console.log('[readParentsFromExcel] 변환 결과:', parent);
          if (parent) {
            parents.push(parent);
          }
        }

        console.log('[readParentsFromExcel] 최종 학부모 데이터:', parents);
        resolve(parents);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('파일을 읽을 수 없습니다.'));
    };

    reader.readAsBinaryString(file);
  });
};
