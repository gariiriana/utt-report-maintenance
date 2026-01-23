import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc, onSnapshot } from 'firebase/firestore';

interface UserData {
  email: string;
  uid: string;
  role: 'admin' | 'engineer';
  companyType?: 'neutra' | 'bri';
  createdAt: any;
}

interface AuthContextType {
  user: User | null;
  userRole: 'admin' | 'engineer' | 'standby_engineer' | null;
  companyType: 'neutra' | 'bri' | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'engineer' | 'standby_engineer' | null>(null);
  const [companyType, setCompanyType] = useState<'neutra' | 'bri' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);

      // Cleanup previous listener if exists
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (user) {
        // ✅ FIX: Create user document FIRST if it doesn't exist (to prevent BloomFilter error)
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);

          // If user document doesn't exist, create it NOW
          if (!userDoc.exists()) {
            const isAdminEmail = user.email === 'Adminreportlampiranutt@gmail.com';
            await setDoc(userDocRef, {
              email: user.email,
              uid: user.uid,
              role: isAdminEmail ? 'admin' : 'engineer',
              companyType: 'neutra',
              createdAt: serverTimestamp(),
            });
            // Set role immediately
            setUserRole(isAdminEmail ? 'admin' : 'engineer');
          }
        } catch (error) {
          console.warn('Error creating user document:', error);
          // Continue anyway, listener will handle it
        }

        // ✅ NOW setup snapshot listener (user document should exist)
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeDoc = onSnapshot(
          userDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const userData = docSnap.data() as UserData;
              setUserRole(userData.role || 'engineer'); // Default to engineer
              setCompanyType(userData.companyType || 'neutra'); // Default to neutra
            } else {
              setUserRole('engineer'); // Default role if document doesn't exist yet
              setCompanyType('neutra'); // Default company type
            }
            setLoading(false);
          },
          (error) => {
            // ✅ Handle permission denied error gracefully
            console.warn('Error listening to user document:', error.message);
            // Set default role and mark as loaded
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
    // ✅ Login user
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    // ✅ Auto-create user document in Firestore if not exists
    if (userCredential.user) {
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const userDoc = await getDoc(userDocRef);

      // Jika user document belum ada, buat baru dengan role default
      if (!userDoc.exists()) {
        // ✅ Check if email is admin
        const isAdminEmail = userCredential.user.email === 'Adminreportlampiranutt@gmail.com';

        await setDoc(userDocRef, {
          email: userCredential.user.email,
          uid: userCredential.user.uid,
          role: isAdminEmail ? 'admin' : 'engineer', // ✅ Set role based on email
          companyType: 'neutra', // ✅ Default company type
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