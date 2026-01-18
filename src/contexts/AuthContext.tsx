import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface AdminData {
  email: string;
  name: string;
  role: 'admin' | 'superadmin';
}

interface AuthContextType {
  user: User | null;
  adminData: AdminData | null;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const adminDoc = await getDoc(doc(db, 'admins', user.uid));
          if (adminDoc.exists()) {
            setAdminData(adminDoc.data() as AdminData);
          } else {
            setAdminData(null);
          }
        } catch (error) {
          console.error('Error fetching admin data:', error);
          setAdminData(null);
        }
      } else {
        setAdminData(null);
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    // Check if user is admin
    const adminDoc = await getDoc(doc(db, 'admins', result.user.uid));
    if (!adminDoc.exists()) {
      await signOut(auth);
      throw new Error('관리자 권한이 없습니다.');
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const register = async (email: string, password: string, name: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    // Create admin document
    await setDoc(doc(db, 'admins', result.user.uid), {
      email,
      name,
      role: 'admin',
      createdAt: serverTimestamp()
    });
    setAdminData({ email, name, role: 'admin' });
  };

  return (
    <AuthContext.Provider value={{
      user,
      adminData,
      isAdmin: !!adminData,
      isLoading,
      login,
      logout,
      register
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
