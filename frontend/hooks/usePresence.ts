import { useEffect, useState } from 'react';
import { rtdb, auth } from '@/api/firebase';
import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';

export interface PresenceUser {
    uid: string;
    email: string;
    lastSeen: number;
    online: boolean;
}

export function usePresence() {
    const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        const userPresenceRef = ref(rtdb, `presence/${user.uid}`);
        
        const connectedRef = ref(rtdb, '.info/connected');

        const unsubscribeConnected = onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
                onDisconnect(userPresenceRef).remove().catch(err => {
                    console.error("Could not establish onDisconnect:", err);
                });

                set(userPresenceRef, {
                    uid: user.uid,
                    email: user.email,
                    lastSeen: serverTimestamp(),
                    online: true
                });
            }
        });

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

        return () => {
            unsubscribeConnected();
            unsubscribeList();
        };
    }, []);

    return onlineUsers;
}
