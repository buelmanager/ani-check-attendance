import type { GradeLevel } from '../types';

// 데모 학생 데이터 50명
export interface DemoStudent {
  name: string;
  phone: string;
  birthDate: string;
  gender: 'male' | 'female';
  school: string;
  grade: GradeLevel;
  address: string;
  notes: string;
  parent: {
    name: string;
    phone: string;
    relationType: 'father' | 'mother' | 'guardian';
  };
}

// 한국 이름 생성용 데이터
const lastNames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍'];
const maleFirstNames = ['민준', '서준', '도윤', '예준', '시우', '하준', '주원', '지호', '지후', '준서', '준우', '현우', '도현', '건우', '우진', '선우', '서진', '민재', '현준', '연우'];
const femaleFirstNames = ['서연', '서윤', '지우', '서현', '민서', '하은', '하윤', '윤서', '지유', '채원', '수아', '지아', '지윤', '다은', '은서', '예린', '수빈', '소율', '예은', '지원'];

// 학교 목록
const elementarySchools = ['서울초등학교', '한강초등학교', '명동초등학교', '강남초등학교', '송파초등학교', '마포초등학교', '영등포초등학교', '용산초등학교'];
const middleSchools = ['서울중학교', '한강중학교', '명동중학교', '강남중학교', '송파중학교', '마포중학교', '영등포중학교', '용산중학교'];
const highSchools = ['서울고등학교', '한강고등학교', '명동고등학교', '강남고등학교', '송파고등학교', '마포고등학교', '영등포고등학교', '용산고등학교'];

// 주소 목록
const addresses = [
  '서울시 강남구 역삼동 123-45',
  '서울시 서초구 서초동 234-56',
  '서울시 송파구 잠실동 345-67',
  '서울시 마포구 서교동 456-78',
  '서울시 영등포구 여의도동 567-89',
  '서울시 용산구 이태원동 678-90',
  '서울시 종로구 종로1가 789-01',
  '서울시 중구 명동 890-12',
  '서울시 성동구 성수동 901-23',
  '서울시 광진구 자양동 012-34',
];

// 메모 목록
const notesList = [
  '미술에 관심이 많음',
  '창의력이 뛰어남',
  '색감이 좋음',
  '집중력이 좋음',
  '성실하게 수업에 참여함',
  '데생 실력 향상 중',
  '수채화에 재능이 있음',
  '유화에 관심이 많음',
  '만화 그리기를 좋아함',
  '캐릭터 디자인에 관심',
  '풍경화를 잘 그림',
  '인물화에 소질이 있음',
  '추상화에 관심이 많음',
  '디지털 아트에 관심',
  '공예에도 관심이 있음',
  '',
];

// 랜덤 선택 함수
const randomPick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// 랜덤 전화번호 생성
const generatePhone = (index: number): string => {
  const prefix = '010';
  const middle = String(1000 + index).slice(-4);
  const suffix = String(1000 + Math.floor(Math.random() * 9000)).slice(-4);
  return `${prefix}-${middle}-${suffix}`;
};

// 랜덤 생년월일 생성 (7~18세)
const generateBirthDate = (): string => {
  const currentYear = new Date().getFullYear();
  const age = 7 + Math.floor(Math.random() * 12); // 7~18세
  const year = currentYear - age;
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 나이에 따른 학교/학년 결정
const getSchoolAndGrade = (birthDate: string): { school: string; grade: GradeLevel } => {
  const birthYear = parseInt(birthDate.split('-')[0]);
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;

  if (age >= 8 && age <= 13) {
    // 초등학생 (1~6학년)
    const gradeNum = Math.min(6, Math.max(1, age - 7));
    const gradeMap: Record<number, GradeLevel> = { 1: '초1', 2: '초2', 3: '초3', 4: '초4', 5: '초5', 6: '초6' };
    return {
      school: randomPick(elementarySchools),
      grade: gradeMap[gradeNum],
    };
  } else if (age >= 14 && age <= 16) {
    // 중학생 (1~3학년)
    const gradeNum = Math.min(3, Math.max(1, age - 13));
    const gradeMap: Record<number, GradeLevel> = { 1: '중1', 2: '중2', 3: '중3' };
    return {
      school: randomPick(middleSchools),
      grade: gradeMap[gradeNum],
    };
  } else if (age >= 17 && age <= 19) {
    // 고등학생 (1~3학년)
    const gradeNum = Math.min(3, Math.max(1, age - 16));
    const gradeMap: Record<number, GradeLevel> = { 1: '고1', 2: '고2', 3: '고3' };
    return {
      school: randomPick(highSchools),
      grade: gradeMap[gradeNum],
    };
  } else {
    // 미취학 또는 기타
    return {
      school: '',
      grade: '미취학',
    };
  }
};

// 50명의 데모 학생 데이터 생성
export const generateDemoStudents = (): DemoStudent[] => {
  const students: DemoStudent[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < 50; i++) {
    // 학생 정보 생성
    const gender: 'male' | 'female' = Math.random() > 0.5 ? 'male' : 'female';
    let studentName = '';

    // 중복되지 않는 이름 생성
    do {
      const lastName = randomPick(lastNames);
      const firstName = gender === 'male' ? randomPick(maleFirstNames) : randomPick(femaleFirstNames);
      studentName = lastName + firstName;
    } while (usedNames.has(studentName));
    usedNames.add(studentName);

    const birthDate = generateBirthDate();
    const { school, grade } = getSchoolAndGrade(birthDate);
    const studentPhone = generatePhone(i);

    // 부모 정보 생성
    const parentGender = Math.random() > 0.5 ? 'father' : 'mother';
    const parentLastName = studentName.charAt(0); // 학생과 같은 성
    const parentFirstName = parentGender === 'father'
      ? randomPick(['철수', '영호', '민수', '정호', '성민', '준혁', '동현', '상훈', '재민', '현수'])
      : randomPick(['영희', '미영', '수진', '은주', '혜진', '지영', '선희', '정숙', '미선', '현정']);
    const parentName = parentLastName + parentFirstName;
    const parentPhone = generatePhone(100 + i);

    students.push({
      name: studentName,
      phone: studentPhone,
      birthDate,
      gender,
      school,
      grade,
      address: randomPick(addresses),
      notes: randomPick(notesList),
      parent: {
        name: parentName,
        phone: parentPhone,
        relationType: parentGender === 'father' ? 'father' : 'mother',
      },
    });
  }

  return students;
};

// 미리 생성된 50명의 데모 데이터 (일관성 유지를 위해)
export const demoStudents: DemoStudent[] = [
  { name: '김민준', phone: '010-1001-2345', birthDate: '2015-03-15', gender: 'male', school: '서울초등학교', grade: '초3', address: '서울시 강남구 역삼동 123-45', notes: '미술에 관심이 많음', parent: { name: '김철수', phone: '010-1101-3456', relationType: 'father' } },
  { name: '이서연', phone: '010-1002-2346', birthDate: '2014-05-20', gender: 'female', school: '한강초등학교', grade: '초4', address: '서울시 서초구 서초동 234-56', notes: '창의력이 뛰어남', parent: { name: '이영희', phone: '010-1102-3457', relationType: 'mother' } },
  { name: '박도윤', phone: '010-1003-2347', birthDate: '2013-07-10', gender: 'male', school: '명동초등학교', grade: '초5', address: '서울시 송파구 잠실동 345-67', notes: '색감이 좋음', parent: { name: '박민수', phone: '010-1103-3458', relationType: 'father' } },
  { name: '최서윤', phone: '010-1004-2348', birthDate: '2016-01-25', gender: 'female', school: '강남초등학교', grade: '초2', address: '서울시 마포구 서교동 456-78', notes: '집중력이 좋음', parent: { name: '최수진', phone: '010-1104-3459', relationType: 'mother' } },
  { name: '정예준', phone: '010-1005-2349', birthDate: '2012-09-08', gender: 'male', school: '송파초등학교', grade: '초6', address: '서울시 영등포구 여의도동 567-89', notes: '성실하게 수업에 참여함', parent: { name: '정영호', phone: '010-1105-3460', relationType: 'father' } },
  { name: '강지우', phone: '010-1006-2350', birthDate: '2011-11-12', gender: 'female', school: '서울중학교', grade: '중1', address: '서울시 용산구 이태원동 678-90', notes: '데생 실력 향상 중', parent: { name: '강은주', phone: '010-1106-3461', relationType: 'mother' } },
  { name: '조시우', phone: '010-1007-2351', birthDate: '2010-02-18', gender: 'male', school: '한강중학교', grade: '중2', address: '서울시 종로구 종로1가 789-01', notes: '수채화에 재능이 있음', parent: { name: '조정호', phone: '010-1107-3462', relationType: 'father' } },
  { name: '윤서현', phone: '010-1008-2352', birthDate: '2009-04-22', gender: 'female', school: '명동중학교', grade: '중3', address: '서울시 중구 명동 890-12', notes: '유화에 관심이 많음', parent: { name: '윤혜진', phone: '010-1108-3463', relationType: 'mother' } },
  { name: '장하준', phone: '010-1009-2353', birthDate: '2008-06-30', gender: 'male', school: '서울고등학교', grade: '고1', address: '서울시 성동구 성수동 901-23', notes: '만화 그리기를 좋아함', parent: { name: '장성민', phone: '010-1109-3464', relationType: 'father' } },
  { name: '임민서', phone: '010-1010-2354', birthDate: '2007-08-14', gender: 'female', school: '한강고등학교', grade: '고2', address: '서울시 광진구 자양동 012-34', notes: '캐릭터 디자인에 관심', parent: { name: '임지영', phone: '010-1110-3465', relationType: 'mother' } },
  { name: '한주원', phone: '010-1011-2355', birthDate: '2015-10-05', gender: 'male', school: '마포초등학교', grade: '초3', address: '서울시 강남구 역삼동 123-45', notes: '풍경화를 잘 그림', parent: { name: '한준혁', phone: '010-1111-3466', relationType: 'father' } },
  { name: '오하은', phone: '010-1012-2356', birthDate: '2014-12-20', gender: 'female', school: '영등포초등학교', grade: '초4', address: '서울시 서초구 서초동 234-56', notes: '인물화에 소질이 있음', parent: { name: '오선희', phone: '010-1112-3467', relationType: 'mother' } },
  { name: '서지호', phone: '010-1013-2357', birthDate: '2013-02-28', gender: 'male', school: '용산초등학교', grade: '초5', address: '서울시 송파구 잠실동 345-67', notes: '추상화에 관심이 많음', parent: { name: '서동현', phone: '010-1113-3468', relationType: 'father' } },
  { name: '신하윤', phone: '010-1014-2358', birthDate: '2016-04-15', gender: 'female', school: '서울초등학교', grade: '초2', address: '서울시 마포구 서교동 456-78', notes: '디지털 아트에 관심', parent: { name: '신정숙', phone: '010-1114-3469', relationType: 'mother' } },
  { name: '권지후', phone: '010-1015-2359', birthDate: '2012-06-10', gender: 'male', school: '한강초등학교', grade: '초6', address: '서울시 영등포구 여의도동 567-89', notes: '공예에도 관심이 있음', parent: { name: '권상훈', phone: '010-1115-3470', relationType: 'father' } },
  { name: '황윤서', phone: '010-1016-2360', birthDate: '2011-08-25', gender: 'female', school: '강남중학교', grade: '중1', address: '서울시 용산구 이태원동 678-90', notes: '미술에 관심이 많음', parent: { name: '황미선', phone: '010-1116-3471', relationType: 'mother' } },
  { name: '안준서', phone: '010-1017-2361', birthDate: '2010-10-08', gender: 'male', school: '송파중학교', grade: '중2', address: '서울시 종로구 종로1가 789-01', notes: '창의력이 뛰어남', parent: { name: '안재민', phone: '010-1117-3472', relationType: 'father' } },
  { name: '송지유', phone: '010-1018-2362', birthDate: '2009-12-12', gender: 'female', school: '마포중학교', grade: '중3', address: '서울시 중구 명동 890-12', notes: '색감이 좋음', parent: { name: '송현정', phone: '010-1118-3473', relationType: 'mother' } },
  { name: '류준우', phone: '010-1019-2363', birthDate: '2008-01-20', gender: 'male', school: '명동고등학교', grade: '고1', address: '서울시 성동구 성수동 901-23', notes: '집중력이 좋음', parent: { name: '류현수', phone: '010-1119-3474', relationType: 'father' } },
  { name: '홍채원', phone: '010-1020-2364', birthDate: '2007-03-18', gender: 'female', school: '강남고등학교', grade: '고2', address: '서울시 광진구 자양동 012-34', notes: '성실하게 수업에 참여함', parent: { name: '홍미영', phone: '010-1120-3475', relationType: 'mother' } },
  { name: '김현우', phone: '010-1021-2365', birthDate: '2015-05-22', gender: 'male', school: '영등포초등학교', grade: '초3', address: '서울시 강남구 역삼동 123-45', notes: '데생 실력 향상 중', parent: { name: '김정호', phone: '010-1121-3476', relationType: 'father' } },
  { name: '이수아', phone: '010-1022-2366', birthDate: '2014-07-30', gender: 'female', school: '용산초등학교', grade: '초4', address: '서울시 서초구 서초동 234-56', notes: '수채화에 재능이 있음', parent: { name: '이은주', phone: '010-1122-3477', relationType: 'mother' } },
  { name: '박도현', phone: '010-1023-2367', birthDate: '2013-09-14', gender: 'male', school: '서울초등학교', grade: '초5', address: '서울시 송파구 잠실동 345-67', notes: '유화에 관심이 많음', parent: { name: '박성민', phone: '010-1123-3478', relationType: 'father' } },
  { name: '최지아', phone: '010-1024-2368', birthDate: '2016-11-05', gender: 'female', school: '한강초등학교', grade: '초2', address: '서울시 마포구 서교동 456-78', notes: '만화 그리기를 좋아함', parent: { name: '최혜진', phone: '010-1124-3479', relationType: 'mother' } },
  { name: '정건우', phone: '010-1025-2369', birthDate: '2012-12-28', gender: 'male', school: '명동초등학교', grade: '초6', address: '서울시 영등포구 여의도동 567-89', notes: '캐릭터 디자인에 관심', parent: { name: '정준혁', phone: '010-1125-3480', relationType: 'father' } },
  { name: '강지윤', phone: '010-1026-2370', birthDate: '2011-02-15', gender: 'female', school: '영등포중학교', grade: '중1', address: '서울시 용산구 이태원동 678-90', notes: '풍경화를 잘 그림', parent: { name: '강지영', phone: '010-1126-3481', relationType: 'mother' } },
  { name: '조우진', phone: '010-1027-2371', birthDate: '2010-04-20', gender: 'male', school: '용산중학교', grade: '중2', address: '서울시 종로구 종로1가 789-01', notes: '인물화에 소질이 있음', parent: { name: '조동현', phone: '010-1127-3482', relationType: 'father' } },
  { name: '윤다은', phone: '010-1028-2372', birthDate: '2009-06-25', gender: 'female', school: '서울중학교', grade: '중3', address: '서울시 중구 명동 890-12', notes: '추상화에 관심이 많음', parent: { name: '윤선희', phone: '010-1128-3483', relationType: 'mother' } },
  { name: '장선우', phone: '010-1029-2373', birthDate: '2008-08-10', gender: 'male', school: '송파고등학교', grade: '고1', address: '서울시 성동구 성수동 901-23', notes: '디지털 아트에 관심', parent: { name: '장상훈', phone: '010-1129-3484', relationType: 'father' } },
  { name: '임은서', phone: '010-1030-2374', birthDate: '2007-10-18', gender: 'female', school: '마포고등학교', grade: '고2', address: '서울시 광진구 자양동 012-34', notes: '공예에도 관심이 있음', parent: { name: '임정숙', phone: '010-1130-3485', relationType: 'mother' } },
  { name: '한서진', phone: '010-1031-2375', birthDate: '2015-12-01', gender: 'male', school: '강남초등학교', grade: '초3', address: '서울시 강남구 역삼동 123-45', notes: '미술에 관심이 많음', parent: { name: '한재민', phone: '010-1131-3486', relationType: 'father' } },
  { name: '오예린', phone: '010-1032-2376', birthDate: '2014-01-15', gender: 'female', school: '송파초등학교', grade: '초4', address: '서울시 서초구 서초동 234-56', notes: '창의력이 뛰어남', parent: { name: '오미선', phone: '010-1132-3487', relationType: 'mother' } },
  { name: '서민재', phone: '010-1033-2377', birthDate: '2013-03-22', gender: 'male', school: '마포초등학교', grade: '초5', address: '서울시 송파구 잠실동 345-67', notes: '색감이 좋음', parent: { name: '서현수', phone: '010-1133-3488', relationType: 'father' } },
  { name: '신수빈', phone: '010-1034-2378', birthDate: '2016-05-28', gender: 'female', school: '영등포초등학교', grade: '초2', address: '서울시 마포구 서교동 456-78', notes: '집중력이 좋음', parent: { name: '신현정', phone: '010-1134-3489', relationType: 'mother' } },
  { name: '권현준', phone: '010-1035-2379', birthDate: '2012-07-08', gender: 'male', school: '용산초등학교', grade: '초6', address: '서울시 영등포구 여의도동 567-89', notes: '성실하게 수업에 참여함', parent: { name: '권정호', phone: '010-1135-3490', relationType: 'father' } },
  { name: '황소율', phone: '010-1036-2380', birthDate: '2011-09-12', gender: 'female', school: '한강중학교', grade: '중1', address: '서울시 용산구 이태원동 678-90', notes: '데생 실력 향상 중', parent: { name: '황미영', phone: '010-1136-3491', relationType: 'mother' } },
  { name: '안연우', phone: '010-1037-2381', birthDate: '2010-11-25', gender: 'male', school: '명동중학교', grade: '중2', address: '서울시 종로구 종로1가 789-01', notes: '수채화에 재능이 있음', parent: { name: '안성민', phone: '010-1137-3492', relationType: 'father' } },
  { name: '송예은', phone: '010-1038-2382', birthDate: '2009-01-30', gender: 'female', school: '강남중학교', grade: '중3', address: '서울시 중구 명동 890-12', notes: '유화에 관심이 많음', parent: { name: '송수진', phone: '010-1138-3493', relationType: 'mother' } },
  { name: '류도현', phone: '010-1039-2383', birthDate: '2008-03-14', gender: 'male', school: '영등포고등학교', grade: '고1', address: '서울시 성동구 성수동 901-23', notes: '만화 그리기를 좋아함', parent: { name: '류준혁', phone: '010-1139-3494', relationType: 'father' } },
  { name: '홍지원', phone: '010-1040-2384', birthDate: '2007-05-20', gender: 'female', school: '용산고등학교', grade: '고2', address: '서울시 광진구 자양동 012-34', notes: '캐릭터 디자인에 관심', parent: { name: '홍은주', phone: '010-1140-3495', relationType: 'mother' } },
  { name: '김지호', phone: '010-1041-2385', birthDate: '2015-07-05', gender: 'male', school: '서울초등학교', grade: '초3', address: '서울시 강남구 역삼동 123-45', notes: '풍경화를 잘 그림', parent: { name: '김동현', phone: '010-1141-3496', relationType: 'father' } },
  { name: '이채원', phone: '010-1042-2386', birthDate: '2014-09-18', gender: 'female', school: '한강초등학교', grade: '초4', address: '서울시 서초구 서초동 234-56', notes: '인물화에 소질이 있음', parent: { name: '이혜진', phone: '010-1142-3497', relationType: 'mother' } },
  { name: '박준서', phone: '010-1043-2387', birthDate: '2013-11-22', gender: 'male', school: '명동초등학교', grade: '초5', address: '서울시 송파구 잠실동 345-67', notes: '추상화에 관심이 많음', parent: { name: '박상훈', phone: '010-1143-3498', relationType: 'father' } },
  { name: '최하은', phone: '010-1044-2388', birthDate: '2016-12-10', gender: 'female', school: '강남초등학교', grade: '초2', address: '서울시 마포구 서교동 456-78', notes: '디지털 아트에 관심', parent: { name: '최지영', phone: '010-1144-3499', relationType: 'mother' } },
  { name: '정시우', phone: '010-1045-2389', birthDate: '2012-02-28', gender: 'male', school: '송파초등학교', grade: '초6', address: '서울시 영등포구 여의도동 567-89', notes: '공예에도 관심이 있음', parent: { name: '정재민', phone: '010-1145-3500', relationType: 'father' } },
  { name: '강민서', phone: '010-1046-2390', birthDate: '2011-04-15', gender: 'female', school: '송파중학교', grade: '중1', address: '서울시 용산구 이태원동 678-90', notes: '미술에 관심이 많음', parent: { name: '강선희', phone: '010-1146-3501', relationType: 'mother' } },
  { name: '조하준', phone: '010-1047-2391', birthDate: '2010-06-20', gender: 'male', school: '마포중학교', grade: '중2', address: '서울시 종로구 종로1가 789-01', notes: '창의력이 뛰어남', parent: { name: '조현수', phone: '010-1147-3502', relationType: 'father' } },
  { name: '윤지유', phone: '010-1048-2392', birthDate: '2009-08-25', gender: 'female', school: '영등포중학교', grade: '중3', address: '서울시 중구 명동 890-12', notes: '색감이 좋음', parent: { name: '윤정숙', phone: '010-1148-3503', relationType: 'mother' } },
  { name: '장민재', phone: '010-1049-2393', birthDate: '2008-10-10', gender: 'male', school: '서울고등학교', grade: '고1', address: '서울시 성동구 성수동 901-23', notes: '집중력이 좋음', parent: { name: '장영호', phone: '010-1149-3504', relationType: 'father' } },
  { name: '임수아', phone: '010-1050-2394', birthDate: '2007-12-15', gender: 'female', school: '한강고등학교', grade: '고2', address: '서울시 광진구 자양동 012-34', notes: '성실하게 수업에 참여함', parent: { name: '임미선', phone: '010-1150-3505', relationType: 'mother' } },
];
