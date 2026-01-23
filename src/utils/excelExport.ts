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
  보호자이름: string;
  보호자연락처: string;
  메모: string;
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

// 전화번호로 로그인 이메일 생성 (student_01012345678@aniwid.com)
const generateLoginEmail = (phone: string | undefined, type: 'student' | 'guardian'): string => {
  if (!phone) return '';
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (!cleanPhone) return '';
  return `${type}_${cleanPhone}@aniwid.com`;
};

// 학생 데이터를 엑셀 행 데이터로 변환
const studentToRow = (student: Student, classes: Class[], parents: Parent[] = []): ExportStudentRow => {
  // 학생이 속한 클래스 이름 목록
  const studentClasses = classes
    .filter(c => c.studentIds.includes(student.id))
    .map(c => c.name)
    .join(', ');

  // 로그인 이메일 생성 (전화번호가 있는 경우)
  const loginEmail = generateLoginEmail(student.phone, 'student');

  // 보호자 정보 찾기 (연결된 부모들)
  // 디버그: parentIds와 parents 확인
  console.log(`[studentToRow] ${student.name}: parentIds=`, student.parentIds, ', parents count=', parents.length);
  if (parents.length > 0) {
    console.log(`[studentToRow] ${student.name}: 첫 번째 부모 id=`, parents[0].id, ', studentIds=', parents[0].studentIds);
  }

  // 방법 1: 학생의 parentIds로 부모 찾기
  const studentParentsByParentIds = parents.filter(p => student.parentIds?.includes(p.id));

  // 방법 2: 부모의 studentIds로 학생 찾기 (fallback)
  const studentParentsByStudentIds = parents.filter(p => p.studentIds?.includes(student.id));

  // 둘 중 하나라도 매칭되면 사용
  const studentParents = studentParentsByParentIds.length > 0
    ? studentParentsByParentIds
    : studentParentsByStudentIds;

  console.log(`[studentToRow] ${student.name}: 매칭된 부모 수 (by parentIds)=`, studentParentsByParentIds.length, ', (by studentIds)=', studentParentsByStudentIds.length);

  const parentNames = studentParents.map(p => p.name).filter(name => name).join(', ');
  const parentPhones = studentParents.map(p => p.phone).filter(phone => phone).join(', ');

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
    보호자이름: parentNames || '-',
    보호자연락처: parentPhones || '-',
    메모: student.notes || '',
    생성일: formatDate(student.createdAt)
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
    { wch: 12 },  // 보호자이름
    { wch: 15 },  // 보호자연락처
    { wch: 30 },  // 메모
    { wch: 12 },  // 생성일
  ];
  ws['!cols'] = columnWidths;

  // 워크시트를 워크북에 추가
  XLSX.utils.book_append_sheet(wb, ws, '학생목록');

  // 파일 다운로드
  XLSX.writeFile(wb, filename);
};

// 엑셀 파일 다운로드 (전체 데이터 - 단일 시트)
const downloadExcelFullBackup = (
  studentData: ExportStudentRow[],
  filename: string
): void => {
  // 워크북 생성
  const wb = XLSX.utils.book_new();

  // 전체 데이터 워크시트 생성 (학생 + 보호자 정보 포함)
  const ws = XLSX.utils.json_to_sheet(studentData);
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
    { wch: 12 },  // 보호자이름
    { wch: 15 },  // 보호자연락처
    { wch: 30 },  // 메모
    { wch: 12 },  // 생성일
  ];
  ws['!cols'] = columnWidths;
  XLSX.utils.book_append_sheet(wb, ws, '전체데이터');

  // 파일 다운로드
  XLSX.writeFile(wb, filename);
};

// 전체 학생 엑셀 내보내기
export const exportAllStudents = (students: Student[], classes: Class[], parents: Parent[] = []): void => {
  console.log('[exportAllStudents] 학생 수:', students.length);
  console.log('[exportAllStudents] 클래스 수:', classes.length);
  console.log('[exportAllStudents] 부모 수:', parents.length);
  if (students.length > 0) {
    console.log('[exportAllStudents] 첫 번째 학생:', students[0]);
    console.log('[exportAllStudents] 첫 번째 학생 parentIds:', students[0].parentIds);
  }
  if (parents.length > 0) {
    console.log('[exportAllStudents] 첫 번째 부모:', parents[0]);
  }

  const data = students.map(student => studentToRow(student, classes, parents));
  const today = new Date().toISOString().split('T')[0];
  downloadExcel(data, `전체_학생목록_${today}.xlsx`);
};

// 필터링된 학생 엑셀 내보내기
export const exportFilteredStudents = (
  students: Student[],
  classes: Class[],
  filterName?: string,
  parents: Parent[] = []
): void => {
  const data = students.map(student => studentToRow(student, classes, parents));
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
  allClasses: Class[],
  parents: Parent[] = []
): void => {
  // 해당 클래스에 속한 학생만 필터링
  const classStudents = students.filter(s => classInfo.studentIds.includes(s.id));
  const data = classStudents.map(student => studentToRow(student, allClasses, parents));
  const today = new Date().toISOString().split('T')[0];
  downloadExcel(data, `${classInfo.name}_학생목록_${today}.xlsx`);
};

// 상태별 학생 엑셀 내보내기
export const exportStudentsByStatus = (
  students: Student[],
  classes: Class[],
  status: StudentStatus,
  parents: Parent[] = []
): void => {
  const filteredStudents = students.filter(s => (s.status || 'active') === status);
  const data = filteredStudents.map(student => studentToRow(student, classes, parents));
  const today = new Date().toISOString().split('T')[0];
  const statusLabel = STATUS_LABELS[status];
  downloadExcel(data, `${statusLabel}_학생목록_${today}.xlsx`);
};

// 전체 백업용 엑셀 내보내기 (단일 시트 - 학생 정보에 보호자 정보 포함)
export const exportFullBackup = (
  students: Student[],
  classes: Class[],
  parents: Parent[]
): void => {
  console.log('[exportFullBackup] 학생 수:', students.length);
  console.log('[exportFullBackup] 클래스 수:', classes.length);
  console.log('[exportFullBackup] 부모 수:', parents.length);
  if (students.length > 0) {
    console.log('[exportFullBackup] 첫 번째 학생:', JSON.stringify(students[0], null, 2));
  }
  if (parents.length > 0) {
    console.log('[exportFullBackup] 첫 번째 부모:', JSON.stringify(parents[0], null, 2));
  }

  // 학생 데이터에 보호자 정보가 이미 포함되어 있음 (보호자이름, 보호자연락처 컬럼)
  const studentData = students.map(student => studentToRow(student, classes, parents));
  const today = new Date().toISOString().split('T')[0];
  downloadExcelFullBackup(studentData, `전체_백업_${today}.xlsx`);
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
  parentName?: string;  // 보호자 이름 (엑셀에서 읽어온 값)
  parentPhone?: string; // 보호자 연락처 (엑셀에서 읽어온 값)
}

// 다양한 엑셀 컬럼명 지원을 위한 헬퍼 함수
const getColumnValue = (row: Record<string, unknown>, ...possibleNames: string[]): string => {
  for (const name of possibleNames) {
    if (row[name] !== undefined && row[name] !== null) {
      const value = String(row[name]).trim();
      // '-' 또는 빈 값은 빈 문자열로 처리
      if (value === '-' || value === '') {
        return '';
      }
      return value;
    }
  }
  return '';
};

const rowToStudent = (row: Record<string, unknown>): ImportStudentData | null => {
  // 다양한 컬럼명 지원: '이름', '학생명', '성명', 'Name' 등
  const name = getColumnValue(row, '이름', '학생명', '성명', 'Name', 'name', '학생이름');
  if (!name) return null;

  // 상태: '상태', 'status', '재원상태' 등
  const statusValue = getColumnValue(row, '상태', 'status', '재원상태');

  // 학년: '학년', 'grade', '학교학년' 등
  const gradeValue = getColumnValue(row, '학년', 'grade', '학교학년');

  // 연락처: '연락처', '전화번호', '휴대폰', 'phone' 등
  const phoneValue = getColumnValue(row, '연락처', '전화번호', '휴대폰', 'phone', '핸드폰', '학생연락처');

  // 성별: '성별', 'gender' 등
  const genderValue = getColumnValue(row, '성별', 'gender');

  // 보호자이름: '보호자이름', '부모이름', '보호자명' 등
  const parentNameRaw = getColumnValue(row, '보호자이름', '부모이름', '보호자명', '학부모이름', 'parentName');
  // '-' 또는 빈 값은 undefined로 처리
  const parentNameValue = parentNameRaw && parentNameRaw !== '-' ? parentNameRaw : undefined;

  // 보호자연락처: '보호자연락처', '부모연락처', '보호자전화' 등
  const parentPhoneRaw = getColumnValue(row, '보호자연락처', '부모연락처', '보호자전화', '보호자휴대폰', 'parentPhone');
  // '-' 또는 빈 값은 undefined로 처리
  const parentPhoneValue = parentPhoneRaw && parentPhoneRaw !== '-' ? parentPhoneRaw : undefined;

  return {
    name,
    inviteCode: getColumnValue(row, '초대코드', 'inviteCode') || undefined,
    status: STATUS_REVERSE[statusValue] || 'active',
    grade: gradeValue || undefined,
    birthDate: parseKoreanDate(getColumnValue(row, '생년월일', '생일', 'birthDate', '생년월일(YYYY-MM-DD)')),
    gender: GENDER_REVERSE[genderValue] || undefined,
    school: getColumnValue(row, '학교', 'school', '학교명') || undefined,
    phone: phoneValue || undefined,
    address: getColumnValue(row, '주소', 'address', '거주지') || undefined,
    enrolledAt: parseKoreanDate(getColumnValue(row, '입학일', '등록일', 'enrolledAt', '입학일자')),
    notes: getColumnValue(row, '메모', 'notes', '비고', '특이사항') || undefined,
    parentName: parentNameValue,
    parentPhone: parentPhoneValue
  };
};

// 엑셀 파일에서 학생 데이터 읽기 (보호자 정보 포함)
export const readStudentsFromExcel = (file: File): Promise<ImportStudentData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        console.log('[readStudentsFromExcel] 시트 목록:', workbook.SheetNames);

        // 시트 우선순위: '전체데이터' > '학생목록' > 첫 번째 시트
        let sheetName = workbook.SheetNames[0];
        if (workbook.SheetNames.includes('전체데이터')) {
          sheetName = '전체데이터';
        } else if (workbook.SheetNames.includes('학생목록')) {
          sheetName = '학생목록';
        }
        const worksheet = workbook.Sheets[sheetName];

        console.log('[readStudentsFromExcel] 사용 시트:', sheetName);

        // 시트를 JSON으로 변환
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        console.log('[readStudentsFromExcel] 총 행 수:', rows.length);
        if (rows.length > 0) {
          console.log('[readStudentsFromExcel] 첫 번째 행 컬럼명:', Object.keys(rows[0]));
          console.log('[readStudentsFromExcel] 첫 번째 행 데이터:', rows[0]);
        }

        // 학생 데이터로 변환 (보호자 정보 포함)
        const students: ImportStudentData[] = [];
        let skippedCount = 0;
        for (const row of rows) {
          const student = rowToStudent(row);
          if (student) {
            students.push(student);
          } else {
            skippedCount++;
          }
        }

        console.log('[readStudentsFromExcel] 변환된 학생 수:', students.length);
        console.log('[readStudentsFromExcel] 스킵된 행 수 (이름 없음):', skippedCount);

        // 보호자 정보가 있는 학생 수 확인
        const studentsWithParent = students.filter(s => s.parentName || s.parentPhone);
        console.log('[readStudentsFromExcel] 보호자 정보 있는 학생 수:', studentsWithParent.length);

        resolve(students);
      } catch (error) {
        console.error('[readStudentsFromExcel] 오류:', error);
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

// 학부모 데이터는 이제 학생 시트에 포함됨 (보호자이름, 보호자연락처 컬럼)
// readParentsFromExcel 함수는 더 이상 사용하지 않음
