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

        // 1. Reference to this user's presence in RTDB
        const userPresenceRef = ref(rtdb, `presence/${user.uid}`);
        
        // 2. Reference to special ".info/connected" node
        const connectedRef = ref(rtdb, '.info/connected');

        const unsubscribeConnected = onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
                // User is connected! 
                // Set up the automatic cleanup for when they disconnect
                onDisconnect(userPresenceRef).remove().catch(err => {
                    console.error("Could not establish onDisconnect:", err);
                });

                // Mark as online
                set(userPresenceRef, {
                    uid: user.uid,
                    email: user.email,
                    lastSeen: serverTimestamp(),
                    online: true
                });
            }
        });

        // 3. Listen to ALL online users
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
            // Optional: manually remove presence on component unmount
            // set(userPresenceRef, null);
        };
    }, []);

    return onlineUsers;
}
