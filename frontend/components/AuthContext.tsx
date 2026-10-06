// ============================================================================
// FILE: AuthContext.tsx
// Deskripsi: React Context Provider Autentikasi Utama DwimitraSystem.
//            Mengelola status login, peranan user (Role-Based Access Control / RBAC),
//            penyinkronan profil user ke Cloud Firestore, serta penanganan fallback login
//            jika jaringan Firebase terhalang AdBlocker/Firewall.
// ============================================================================

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut,
  onAuthStateChanged,
  onIdTokenChanged,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { auth, db } from '@/api/firebase';
import { doc, setDoc, serverTimestamp, getDoc, onSnapshot } from 'firebase/firestore';

/** Sesi hasil scan wajah (klaim faceUntil/facePerson di ID token perangkat ini). */
export interface FaceSession {
  person: string;
  until: number; // epoch detik
}

/**
 * Baca sesi wajah dari klaim token memakai jam SERVER (klaim iat), bukan jam perangkat:
 * HP/PC yang jamnya salah (misal maju sehari) tetap bisa masuk. Batas pastinya tetap
 * ditegakkan server (rules memakai request.time, FaceGate mengecek faceCheckSession).
 * remainingMs dihitung dari waktu token terbit, jadi bisa telat maksimal 1 jam.
 */
function faceSessionFromClaims(claims: Record<string, unknown>): { session: FaceSession; remainingMs: number } | null {
  const until = Number(claims.faceUntil || 0);
  const issuedAt = Number(claims.iat || 0);
  if (!until || !issuedAt || until <= issuedAt) return null;
  return { session: { person: String(claims.facePerson || ''), until }, remainingMs: (until - issuedAt) * 1000 };
}

// Interface struktur data profil user yang tersimpan di Firestore ('users' collection)
interface UserData {
  email: string;
  uid: string;
  role: 'admin' | 'qc_dme' | 'engineer' | 'Engineer_K2' | 'engineer_k2' | 'standby_engineer' | 'tde' | 'cbre' | 'hse' | 'pmo' | 'sales' | 'presales' | 'purchasing' | 'dirut' | 'direksiSDM' | 'DireksiKeuangan' | 'site_manager' | 'manager' | 'DME' | 'site_manager_dme' | 'drafter';
  companyType?: 'neutra' | 'bri' | 'k2';
  createdAt: any;
}

/**
 * Helper otomatis: Menentukan peranan (role) awal user.
 * Akun baru default-nya adalah 'engineer'.
 * Role istimewa (qc_dme, admin, dsb.) wajib terdaftar resmi di dokumen Firestore users/{uid}.
 * @param email Alamat email user
 * @returns Kode role resmi (engineer, standby_engineer, Engineer_K2, dsb.)
 */
const getRoleFromEmail = (email: string | null): 'admin' | 'qc_dme' | 'engineer' | 'Engineer_K2' | 'engineer_k2' | 'standby_engineer' | 'tde' | 'cbre' | 'hse' | 'pmo' | 'sales' | 'presales' | 'purchasing' | 'dirut' | 'direksiSDM' | 'DireksiKeuangan' | 'site_manager' | 'manager' | 'DME' | 'site_manager_dme' | 'drafter' => {
  if (!email) return 'engineer';
  const lowerEmail = email.toLowerCase();
  // Fallback khusus untuk akun QC DME resmi bila belum tersinkron
  if (lowerEmail === 'qcdme@dme.com') return 'qc_dme';
  if (lowerEmail.includes('k2') || lowerEmail.includes('engineer_k2')) return 'Engineer_K2';
  // Email spesifik teknisi Standby Engineer UTT eksisting
  if (lowerEmail === 'agil@utt.com' || lowerEmail === 'krishna@utt.com' || lowerEmail === 'asep@utt.com' || lowerEmail === 'salman@utt.com' || lowerEmail === 'gilang@utt.com' || lowerEmail === 'dison@utt.com' || lowerEmail === 'riyan@utt.com') return 'standby_engineer';
  return 'engineer';
};

/**
 * Helper pemeriksaan resmi wewenang penghapusan permanen:
 * Hanya akun resmi qcdme@dme.com yang berwenang menghapus berkas secara permanen.
 */
export const isQcDmeEmail = (email?: string | null): boolean => {
  return (email || '').toLowerCase().trim() === 'qcdme@dme.com';
};

// Interface konteks autentikasi React
interface AuthContextType {
  user: User | null;
  userRole: 'admin' | 'qc_dme' | 'engineer' | 'Engineer_K2' | 'engineer_k2' | 'standby_engineer' | 'tde' | 'cbre' | 'hse' | 'pmo' | 'sales' | 'presales' | 'purchasing' | 'dirut' | 'direksiSDM' | 'DireksiKeuangan' | 'site_manager' | 'manager' | 'DME' | 'site_manager_dme' | 'drafter' | null;
  companyType: 'neutra' | 'bri' | 'k2' | null;
  isQcDme: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** null = belum lolos scan wajah di perangkat ini (atau sudah kedaluwarsa). */
  faceSession: FaceSession | null;
  /** false selama klaim token belum selesai dibaca. */
  faceChecked: boolean;
  /** Tukar custom token dari faceVerify/faceBreakGlass menjadi sesi berklaim wajah. */
  completeFaceVerification: (customToken: string) => Promise<void>;
  /** Akhiri sesi wajah di perangkat ini (minta scan ulang) tanpa logout password. */
  endFaceSession: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'qc_dme' | 'engineer' | 'Engineer_K2' | 'engineer_k2' | 'standby_engineer' | 'tde' | 'cbre' | 'hse' | 'pmo' | 'sales' | 'presales' | 'purchasing' | 'dirut' | 'direksiSDM' | 'DireksiKeuangan' | 'site_manager' | 'manager' | 'DME' | 'site_manager_dme' | 'drafter' | null>(null);
  const [companyType, setCompanyType] = useState<'neutra' | 'bri' | 'k2' | null>(null);
  const [loading, setLoading] = useState(true);
  const [faceSession, setFaceSession] = useState<FaceSession | null>(null);
  const [faceChecked, setFaceChecked] = useState(false);

  // Sign-in ulang dengan custom token memakai uid yang sama, sehingga onAuthStateChanged
  // tidak terpicu. Klaim wajah dibaca dari onIdTokenChanged.
  useEffect(() => {
    let expiryTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = onIdTokenChanged(auth, async (tokenUser) => {
      if (expiryTimer) clearTimeout(expiryTimer);
      if (!tokenUser) {
        setFaceSession(null);
        setFaceChecked(true);
        return;
      }
      try {
        const { claims } = await tokenUser.getIdTokenResult();
        const face = faceSessionFromClaims(claims);
        setFaceSession(face ? face.session : null);
        // Minta scan ulang saat sesi wajah habis.
        if (face) expiryTimer = setTimeout(() => setFaceSession(null), face.remainingMs);
      } catch {
        setFaceSession(null);
      }
      setFaceChecked(true);
    });
    return () => {
      unsubscribe();
      if (expiryTimer) clearTimeout(expiryTimer);
    };
  }, []);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;
    
    // Set persistensi lokal browser (user tetap terautentikasi meskipun tab/browser ditutup)
    setPersistence(auth, browserLocalPersistence).catch(err => console.error("Persistence failed", err));

    // Event Listener perubahan status autentikasi Firebase
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);

      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (user) {
        // A signed Drafter claim resolves this restricted role without Firestore reads.
        // Refresh at login so newly assigned roles are visible immediately.
        try {
          const token = await user.getIdTokenResult(true).catch(() => user.getIdTokenResult());
          if (auth.currentUser?.uid !== user.uid) return;
          if (token.claims.role === 'drafter') {
            setUserRole('drafter');
            setCompanyType('neutra');
            setLoading(false);
            return;
          }
        } catch (error) { console.warn('Unable to refresh role claim:', error); }
        let resolvedRole = getRoleFromEmail(user.email);
        const userDocRef = doc(db, 'users', user.uid);

        try {
          const userDoc = await getDoc(userDocRef);

          // Jika user baru pertama kali login, buat dokumen profil awal di Firestore
          if (userDoc.exists()) {
            resolvedRole = userDoc.data().role || resolvedRole;
          } else {
            const initialRole = getRoleFromEmail(user.email);
            const initialCompanyType = (initialRole === 'Engineer_K2' || initialRole === 'engineer_k2') ? 'k2' : 'neutra';
            await setDoc(userDocRef, {
              email: user.email,
              uid: user.uid,
              role: initialRole,
              companyType: initialCompanyType,
              createdAt: serverTimestamp(),
            });
            setUserRole(initialRole);
            setCompanyType(initialCompanyType);
          } 
        } catch (error) {
          console.warn('Error creating/fetching user document (offline?):', error);
        }

        // Realtime Listener snapshot dokumen profil user dari Firestore
        unsubscribeDoc = onSnapshot(
          userDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const userData = docSnap.data() as UserData;
              let finalRole = userData.role || 'engineer';
              if ((finalRole as string) === 'dme') {
                finalRole = 'DME';
              }
              if ((finalRole as string).toLowerCase() === 'engineer_k2') {
                finalRole = 'Engineer_K2';
              }

              const resolvedCompanyType = userData.companyType || (finalRole === 'Engineer_K2' ? 'k2' : 'neutra');
              resolvedRole = finalRole;
              setUserRole(finalRole);
              setCompanyType(resolvedCompanyType);
            } else {
              const defaultRole = getRoleFromEmail(user.email);
              const defaultCompanyType = (defaultRole === 'Engineer_K2' || defaultRole === 'engineer_k2') ? 'k2' : 'neutra';
              setUserRole(defaultRole);
              setCompanyType(defaultCompanyType);
            }
            setLoading(false);
          },
          (error) => {
            console.warn('Error listening to user document:', error.message);
            const defaultRole = resolvedRole;
            const defaultCompanyType = (defaultRole === 'Engineer_K2' || defaultRole === 'engineer_k2') ? 'k2' : 'neutra';
            setUserRole(defaultRole);
            setCompanyType(defaultCompanyType);
            setLoading(false);
          }
        );
      } else {
        // Pengecekan fallback session jika koneksi Firebase Auth terputus
        try {
          const rawSession = localStorage.getItem('dwimitra_fallback_session');
          if (rawSession) {
            const parsed = JSON.parse(rawSession);
            if (parsed && parsed.uid && (Date.now() - parsed.timestamp < 7 * 24 * 60 * 60 * 1000)) {
              const fallbackUser = {
                uid: parsed.uid,
                email: parsed.email,
                emailVerified: true,
                isAnonymous: false,
                metadata: {},
                providerData: [],
                refreshToken: '',
                tenantId: null,
                delete: async () => {},
                getIdToken: async () => '',
                getIdTokenResult: async () => ({ token: '' }),
                reload: async () => {},
                toJSON: () => ({ uid: parsed.uid, email: parsed.email }),
                displayName: null,
                phoneNumber: null,
                photoURL: null,
                providerId: 'firebase'
              } as unknown as User;

              setUser(fallbackUser);
              setUserRole(getRoleFromEmail(parsed.email));
              setCompanyType('neutra');
              setLoading(false);
              return;
            }
          }
        } catch (e) {}

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

  /**
   * Fungsi Login Utama:
   * 1. Cek koneksi internet.
   * 2. Mencoba login Firebase Auth standar.
   * 3. Jika diblokir oleh AdBlocker/DNS lokal, otomatis fallback ke Backend Proxy Login (/api/auth/proxy-login).
   */
  const login = async (email: string, password: string) => {
    if (!navigator.onLine) {
      throw new Error('Login memerlukan koneksi internet untuk verifikasi keamanan pertama kali.');
    }

    const syncUserDoc = async (uid: string, userEmail: string | null) => {
      try {
        const userDocRef = doc(db, 'users', uid);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
          const initialRole = getRoleFromEmail(userEmail);
          const initialCompanyType = (initialRole === 'Engineer_K2' || initialRole === 'engineer_k2') ? 'k2' : 'neutra';
          await setDoc(userDocRef, {
            email: userEmail,
            uid: uid,
            role: initialRole,
            companyType: initialCompanyType,
            createdAt: serverTimestamp(),
          });
        }
      } catch (error) {
        console.warn('Error during background user doc sync:', error);
      }
    };

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        await syncUserDoc(userCredential.user.uid, userCredential.user.email);
        localStorage.removeItem('dwimitra_fallback_session');
      }
    } catch (primaryError: any) {
      console.warn('Primary Firebase login failed, attempting backend proxy fallback:', primaryError);

      // Mekanisme Fallback Backend Proxy saat Firebase Client SDK terhalang jaringan/firewall
      if (
        primaryError.code === 'auth/network-request-failed' ||
        primaryError.code === 'auth/internal-error' ||
        primaryError.message?.includes('fetch')
      ) {
        try {
          const apiBaseUrl = import.meta.env.VITE_API_URL || '/api';
          const resp = await fetch(`${apiBaseUrl}/auth/proxy-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });

          if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            const msg = errData.message || 'Email atau password salah';
            const err = new Error(msg) as any;
            err.code = errData.code || 'auth/invalid-credential';
            throw err;
          }

          const data = await resp.json();
          if (data.customToken) {
            try {
              const userCred = await signInWithCustomToken(auth, data.customToken);
              if (userCred.user) {
                await syncUserDoc(userCred.user.uid, userCred.user.email);
                localStorage.removeItem('dwimitra_fallback_session');
                return;
              }
            } catch (customTokenError) {
              console.warn('signInWithCustomToken also blocked by client network, activating fallback session:', customTokenError);
            }
          }

          if (data.uid) {
            const fallbackUser = {
              uid: data.uid,
              email: data.email || email,
              emailVerified: true,
              isAnonymous: false,
              metadata: {},
              providerData: [],
              refreshToken: data.refreshToken || '',
              tenantId: null,
              delete: async () => {},
              getIdToken: async () => data.idToken || '',
              getIdTokenResult: async () => ({ token: data.idToken || '' }),
              reload: async () => {},
              toJSON: () => ({ uid: data.uid, email: data.email }),
              displayName: null,
              phoneNumber: null,
              photoURL: null,
              providerId: 'firebase'
            } as unknown as User;

            setUser(fallbackUser);
            const initialRole = getRoleFromEmail(data.email || email);
            const initialCompanyType = (initialRole === 'Engineer_K2' || initialRole === 'engineer_k2') ? 'k2' : 'neutra';
            setUserRole(initialRole);
            setCompanyType(initialCompanyType);
            setLoading(false);

            try {
              localStorage.setItem('dwimitra_fallback_session', JSON.stringify({
                uid: data.uid,
                email: data.email || email,
                timestamp: Date.now()
              }));
            } catch (e) {}

            return;
          }
        } catch (fallbackErr: any) {
          console.error('Backend proxy login fallback failed:', fallbackErr);
          throw fallbackErr;
        }
      }

      throw primaryError;
    }
  };

  /**
   * Selesaikan verifikasi wajah: custom token dari server (uid sama dengan akun yang
   * sedang login) membawa klaim faceUntil + facePerson untuk sesi perangkat ini.
   */
  const completeFaceVerification = async (customToken: string) => {
    const currentUid = auth.currentUser?.uid;
    const cred = await signInWithCustomToken(auth, customToken);
    if (currentUid && cred.user.uid !== currentUid) {
      await signOut(auth);
      throw new Error('Token verifikasi wajah tidak sesuai dengan akun yang login.');
    }
    const { claims } = await cred.user.getIdTokenResult();
    setFaceSession(faceSessionFromClaims(claims)?.session ?? null);
  };

  const endFaceSession = () => setFaceSession(null);

  /**
   * Fungsi Logout Utama: Membersihkan sesi lokal & mereset state autentikasi
   */
  const logout = async () => {
    try {
      localStorage.removeItem('dwimitra_fallback_session');
    } catch (e) {}
    try {
      await signOut(auth);
    } catch (e) {}
    setUserRole(null);
    setCompanyType(null);
    setUser(null);
  };

  const value = {
    user,
    userRole,
    companyType,
    isQcDme: isQcDmeEmail(user?.email),
    loading,
    login,
    faceSession,
    faceChecked,
    completeFaceVerification,
    endFaceSession,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom Hook untuk memanggil AuthContext secara praktis di komponen mana pun
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
