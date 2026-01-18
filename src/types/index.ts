export interface Class {
  id: string;
  name: string;
  schedule: string;
  time: string;
  studentIds: string[];
  createdAt: string;
}

export interface Student {
  id: string;
  name: string;
  phone?: string;
  parentPhone?: string;
  createdAt: string;
}

export interface Attendance {
  id: string;
  classId: string;
  studentId: string;
  date: string;
  status: 'present' | 'late' | 'absent' | 'excused';
  checkInTime?: string;
  checkInMethod: 'qr' | 'manual' | 'gps';
}
