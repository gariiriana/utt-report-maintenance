import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { auth, db } from '@/api/firebase';
import { doc, setDoc, serverTimestamp, getDoc, onSnapshot, getDocFromCache } from 'firebase/firestore';

interface UserData {
  email: string;
  uid: string;
  role: 'admin' | 'engineer' | 'standby_engineer' | 'tde' | 'cbre' | 'hse' | 'pmo' | 'sales' | 'presales' | 'purchasing' | 'dirut' | 'direksiSDM' | 'DireksiKeuangan' | 'site_manager' | 'manager' | 'inventory';
  companyType?: 'neutra' | 'bri';
  createdAt: any;
}

interface AuthContextType {
  user: User | null;
  userRole: 'admin' | 'engineer' | 'standby_engineer' | 'tde' | 'cbre' | 'hse' | 'pmo' | 'sales' | 'presales' | 'purchasing' | 'dirut' | 'direksiSDM' | 'DireksiKeuangan' | 'site_manager' | 'manager' | 'inventory' | null;
  companyType: 'neutra' | 'bri' | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'engineer' | 'standby_engineer' | 'tde' | 'cbre' | 'hse' | 'pmo' | 'sales' | 'presales' | 'purchasing' | 'dirut' | 'direksiSDM' | 'DireksiKeuangan' | 'site_manager' | 'manager' | 'inventory' | null>(null);
  const [companyType, setCompanyType] = useState<'neutra' | 'bri' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;
    
    // Explicitly set persistence
    setPersistence(auth, browserLocalPersistence).catch(err => console.error("Persistence failed", err));

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);

      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (user) {
        try {
          // Use a shorter timeout or handle offline gracefully
          const userDocRef = doc(db, 'users', user.uid);
          // Firestore with persistence enabled will automatically try cache first or in parallel
          const userDoc = await getDoc(userDocRef);

          if (!userDoc.exists()) {
            const isAdminEmail = user.email === 'Adminreportlampiranutt@gmail.com';
            await setDoc(userDocRef, {
              email: user.email,
              uid: user.uid,
              role: isAdminEmail ? 'admin' : 'engineer',
              companyType: 'neutra',
              createdAt: serverTimestamp(),
            });
            setUserRole(isAdminEmail ? 'admin' : 'engineer');
          }
        } catch (error) {
          console.warn('Error creating/fetching user document:', error);
          // Don't block loading if it's just a connectivity issue
          setLoading(false);
        }

        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeDoc = onSnapshot(
          userDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const userData = docSnap.data() as UserData;
              setUserRole(userData.role || 'engineer');
              setCompanyType(userData.companyType || 'neutra');
            } else {
              setUserRole('engineer');
              setCompanyType('neutra');
            }
            setLoading(false);
          },
          (error) => {
            console.warn('Error listening to user document:', error.message);
            setUserRole('engineer');
            setCompanyType('neutra');
            setLoading(false);
          }
        );
      } else {
        setUserRole(null);
        setCompanyType(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubscribeDoc) {
        unsubscribeDoc();
      }
    };
  }, []);

  const login = async (email: string, password: string) => {
    if (!navigator.onLine) {
      throw new Error('Login memerlukan koneksi internet untuk verifikasi keamanan pertama kali.');
    }
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    if (userCredential.user) {
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        const isAdminEmail = userCredential.user.email === 'Adminreportlampiranutt@gmail.com';

        await setDoc(userDocRef, {
          email: userCredential.user.email,
          uid: userCredential.user.uid,
          role: isAdminEmail ? 'admin' : 'engineer',
          companyType: 'neutra',
          createdAt: serverTimestamp(),
        });
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUserRole(null);
    setCompanyType(null);
  };

  const value = {
    user,
    userRole,
    companyType,
    loading,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}