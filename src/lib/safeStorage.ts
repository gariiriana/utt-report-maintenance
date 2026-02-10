export const safeStorage = {
    getItem: (key: string): string | null => {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn('localStorage access denied:', e);
            return null;
        }
    },
    setItem: (key: string, value: string): void => {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn('localStorage access denied:', e);
        }
    },
    removeItem: (key: string): void => {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('localStorage access denied:', e);
        }
    }
};
