import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Class, Student, Attendance } from '../types';
import { classService } from '../services/classService';
import { studentService } from '../services/studentService';
import { attendanceService } from '../services/attendanceService';

interface AppState {
  // Data
  classes: Class[];
  students: Student[];
  attendances: Attendance[];

  // Firebase sync status
  isOnline: boolean;
  isSyncing: boolean;
  isInitialized: boolean;

  // Setters for Firebase subscriptions
  setClasses: (classes: Class[]) => void;
  setStudents: (students: Student[]) => void;
  setAttendances: (attendances: Attendance[]) => void;

  // Class operations
  addClass: (cls: Omit<Class, 'id' | 'createdAt'>) => Promise<void>;
  updateClass: (id: string, updates: Partial<Class>) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;

  // Student operations
  addStudent: (student: Omit<Student, 'id' | 'createdAt' | 'inviteCode' | 'parentIds'>) => Promise<void>;
  updateStudent: (id: string, updates: Partial<Student>) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;

  // Attendance operations
  addAttendance: (attendance: Omit<Attendance, 'id'>) => Promise<void>;
  updateAttendance: (id: string, updates: Partial<Attendance>) => Promise<void>;

  // Sync
  setOnlineStatus: (status: boolean) => void;
  initializeSubscriptions: () => () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      classes: [],
      students: [],
      attendances: [],
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isSyncing: false,
      isInitialized: false,

      setClasses: (classes) => set({ classes }),
      setStudents: (students) => set({ students }),
      setAttendances: (attendances) => set({ attendances }),

      addClass: async (cls) => {
        try {
          const id = await classService.create(cls);
          // Optimistic update (will be overwritten by subscription)
          set((state) => ({
            classes: [...state.classes, { ...cls, id, createdAt: new Date().toISOString() } as Class]
          }));
        } catch (error) {
          console.error('Error adding class:', error);
          throw error;
        }
      },

      updateClass: async (id, updates) => {
        try {
          await classService.update(id, updates);
          set((state) => ({
            classes: state.classes.map(c => c.id === id ? { ...c, ...updates } : c)
          }));
        } catch (error) {
          console.error('Error updating class:', error);
          throw error;
        }
      },

      deleteClass: async (id) => {
        try {
          await classService.delete(id);
          set((state) => ({
            classes: state.classes.filter(c => c.id !== id)
          }));
        } catch (error) {
          console.error('Error deleting class:', error);
          throw error;
        }
      },

      addStudent: async (student) => {
        try {
          const id = await studentService.create(student);
          set((state) => ({
            students: [...state.students, { ...student, id, createdAt: new Date().toISOString() } as Student]
          }));
        } catch (error) {
          console.error('Error adding student:', error);
          throw error;
        }
      },

      updateStudent: async (id, updates) => {
        try {
          await studentService.update(id, updates);
          set((state) => ({
            students: state.students.map(s => s.id === id ? { ...s, ...updates } : s)
          }));
        } catch (error) {
          console.error('Error updating student:', error);
          throw error;
        }
      },

      deleteStudent: async (id) => {
        try {
          await studentService.delete(id);
          set((state) => ({
            students: state.students.filter(s => s.id !== id)
          }));
        } catch (error) {
          console.error('Error deleting student:', error);
          throw error;
        }
      },

      addAttendance: async (attendance) => {
        try {
          const id = await attendanceService.create(attendance);
          set((state) => ({
            attendances: [...state.attendances, { ...attendance, id } as Attendance]
          }));
        } catch (error) {
          console.error('Error adding attendance:', error);
          throw error;
        }
      },

      updateAttendance: async (id, updates) => {
        try {
          await attendanceService.update(id, updates);
          set((state) => ({
            attendances: state.attendances.map(a => a.id === id ? { ...a, ...updates } : a)
          }));
        } catch (error) {
          console.error('Error updating attendance:', error);
          throw error;
        }
      },

      setOnlineStatus: (status) => set({ isOnline: status }),

      initializeSubscriptions: () => {
        set({ isSyncing: true });

        const unsubClasses = classService.subscribe((classes) => {
          set({ classes, isInitialized: true, isSyncing: false });
        });

        const unsubStudents = studentService.subscribe((students) => {
          set({ students });
        });

        const unsubAttendances = attendanceService.subscribeAll((attendances) => {
          set({ attendances });
        });

        // Listen for online/offline status
        const handleOnline = () => set({ isOnline: true });
        const handleOffline = () => set({ isOnline: false });

        if (typeof window !== 'undefined') {
          window.addEventListener('online', handleOnline);
          window.addEventListener('offline', handleOffline);
        }

        return () => {
          unsubClasses();
          unsubStudents();
          unsubAttendances();
          if (typeof window !== 'undefined') {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
          }
        };
      }
    }),
    {
      name: 'anicheck-storage',
      partialize: (state) => ({
        classes: state.classes,
        students: state.students,
        attendances: state.attendances
      })
    }
  )
);
