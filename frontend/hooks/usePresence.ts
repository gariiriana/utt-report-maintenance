// ============================================================================
// FILE: frontend/hooks/usePresence.ts
// Deskripsi: Custom React Hook Pelacakan Status Kehadiran Realtime User (Online/Offline).
//            Menggunakan Firebase Realtime Database (rtdb) `.info/connected` & `onDisconnect`
//            untuk menyinkronkan daftar pengguna yang sedang aktif/online di aplikasi.
// ============================================================================

import { useEffect, useState } from 'react';
import { rtdb, auth } from '@/api/firebase';
import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';

/** Interface Objek User yang Sedang Online */
export interface PresenceUser {
    uid: string;                            // User ID Firebase Auth
    email: string;                          // Email Akun User
    lastSeen: number;                       // Timestamp Terakhir Terhubung
    online: boolean;                        // Status Aktif (true = Online)
}

/**
 * Hook `usePresence()`
 * Junior Dev Notes: Hook ini mendengarkan event koneksi Firebase RTDB.
 * Saat koneksi terhubung, data user ditulis ke path `presence/{uid}`.
 * Jika koneksi terputus (aplikasi ditutup), Firebase otomatis menghapus data via `onDisconnect()`.
 */
export function usePresence() {
    // State daftar seluruh user yang sedang online
    const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);

    useEffect(() => {
        // 1. Ambil data user yang sedang login saat ini
        const user = auth.currentUser;
        if (!user) return;

        // 2. Referensi node kehadiran user spesifik di Firebase RTDB
        const userPresenceRef = ref(rtdb, `presence/${user.uid}`);

        // 3. Referensi status jaringan lokal Firebase RTDB
        const connectedRef = ref(rtdb, '.info/connected');

        // 4. Listener saat status koneksi lokal berubah
        const unsubscribeConnected = onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
                // Daftarkan listener auto-remove saat user disconnected
                onDisconnect(userPresenceRef).remove().catch(err => {
                    console.error("Could not establish onDisconnect:", err);
                });

                // Tulis status online user saat ini ke database
                set(userPresenceRef, {
                    uid: user.uid,
                    email: user.email,
                    lastSeen: serverTimestamp(),
                    online: true
                });
            }
        });

        // 5. Listener realtime membaca daftar seluruh user yang sedang online di path `presence`
        const allPresenceRef = ref(rtdb, 'presence');
        const unsubscribeList = onValue(allPresenceRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const users: PresenceUser[] = Object.values(data);
                setOnlineUsers(users);
            } else {
                setOnlineUsers([]);
            }
        });

        // 6. Cleanup function saat komponen di-unmount
        return () => {
            unsubscribeConnected();
            unsubscribeList();
        };
    }, []);

    // Kembalikan array berisi daftar user yang sedang online
    return onlineUsers;
}
