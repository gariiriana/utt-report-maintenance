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
import { doc, setDoc, serverTimestamp, getDoc, onSnapshot } from 'firebase/firestore';

interface UserData {
  email: string;
  uid: string;
  role: 'admin' | 'engineer' | 'standby_engineer' | 'tde' | 'cbre' | 'hse' | 'pmo' | 'sales' | 'presales' | 'purchasing' | 'dirut' | 'direksiSDM' | 'DireksiKeuangan' | 'site_manager' | 'manager' | 'DME';
  companyType?: 'neutra' | 'bri';
  createdAt: any;
}

const getRoleFromEmail = (email: string | null): 'admin' | 'engineer' | 'standby_engineer' | 'tde' | 'cbre' | 'hse' | 'pmo' | 'sales' | 'presales' | 'purchasing' | 'dirut' | 'direksiSDM' | 'DireksiKeuangan' | 'site_manager' | 'manager' | 'DME' => {
  if (!email) return 'engineer';
  const lowerEmail = email.toLowerCase();
  if (lowerEmail.includes('admin')) return 'admin';
  if (lowerEmail.includes('hse')) return 'hse';
  if (lowerEmail.includes('tde')) return 'tde';
  if (lowerEmail.includes('cbre')) return 'cbre';
  if (lowerEmail.includes('site_manager') || lowerEmail.includes('sitemanager')) return 'site_manager';
  if (lowerEmail.includes('manager')) return 'manager';
  if (lowerEmail.includes('pmo')) return 'pmo';
  if (lowerEmail.includes('sales')) return 'sales';
  if (lowerEmail.includes('presales')) return 'presales';
  if (lowerEmail.includes('purchasing')) return 'purchasing';
  if (lowerEmail.includes('dirut')) return 'dirut';
  if (lowerEmail.includes('dme')) return 'DME';
  if (lowerEmail === 'agil@utt.com' || lowerEmail === 'krishna@utt.com' || lowerEmail === 'asep@utt.com' || lowerEmail === 'salman@utt.com' || lowerEmail === 'gilang@utt.com' || lowerEmail === 'dison@utt.com' || lowerEmail.includes('standby')) return 'standby_engineer';
  return 'engineer';
};

interface AuthContextType {
  user: User | null;
  userRole: 'admin' | 'engineer' | 'standby_engineer' | 'tde' | 'cbre' | 'hse' | 'pmo' | 'sales' | 'presales' | 'purchasing' | 'dirut' | 'direksiSDM' | 'DireksiKeuangan' | 'site_manager' | 'manager' | 'DME' | null;
  companyType: 'neutra' | 'bri' | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'engineer' | 'standby_engineer' | 'tde' | 'cbre' | 'hse' | 'pmo' | 'sales' | 'presales' | 'purchasing' | 'dirut' | 'direksiSDM' | 'DireksiKeuangan' | 'site_manager' | 'manager' | 'DME' | null>(null);
  const [companyType, setCompanyType] = useState<'neutra' | 'bri' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;
    

    setPersistence(auth, browserLocalPersistence).catch(err => console.error("Persistence failed", err));

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);

      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (user) {
        const userDocRef = doc(db, 'users', user.uid);

        try {
          const userDoc = await getDoc(userDocRef);

          if (!userDoc.exists()) {
            const initialRole = getRoleFromEmail(user.email);
            await setDoc(userDocRef, {
              email: user.email,
              uid: user.uid,
              role: initialRole,
              companyType: 'neutra',
              createdAt: serverTimestamp(),
            });
            setUserRole(initialRole);
          }
        } catch (error) {
          console.warn('Error creating/fetching user document (offline?):', error);
        }

        unsubscribeDoc = onSnapshot(
          userDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const userData = docSnap.data() as UserData;
              let finalRole = userData.role || 'engineer';
              if ((finalRole as string) === 'dme') {
                finalRole = 'DME';
              }

              setUserRole(finalRole);
              setCompanyType(userData.companyType || 'neutra');
            } else {
              const defaultRole = getRoleFromEmail(user.email);
              setUserRole(defaultRole);
              setCompanyType('neutra');
            }
            setLoading(false);
          },
          (error) => {
            console.warn('Error listening to user document:', error.message);
            const defaultRole = getRoleFromEmail(user.email);
            setUserRole(defaultRole);
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

    try {
      if (userCredential.user) {
        const userDocRef = doc(db, 'users', userCredential.user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
          const initialRole = getRoleFromEmail(userCredential.user.email);
          await setDoc(userDocRef, {
            email: userCredential.user.email,
            uid: userCredential.user.uid,
            role: initialRole,
            companyType: 'neutra',
            createdAt: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      console.warn('Error during background user doc sync:', error);
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
