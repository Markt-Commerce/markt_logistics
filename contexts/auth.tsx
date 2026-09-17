import React, { createContext, useContext, useEffect, useState } from 'react';
import apiService from '../services/api';
import { clearAuthToken, getAuthToken, setAuthToken } from '../services/authStorage';
import { registerForPush, unregisterPush } from '../services/notifications';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (sessionToken: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await getAuthToken();
        if (token) {
          apiService.setSessionToken(token);
          setIsAuthenticated(true);
          // A token can be revoked by the OS, or the rider may have refused
          // permission last time and changed their mind since.
          void registerForPush();
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const signIn = async (sessionToken: string) => {
    await setAuthToken(sessionToken);
    apiService.setSessionToken(sessionToken);
    setIsAuthenticated(true);
    // After the token is set, so the registration call is authenticated.
    // Not awaited: a rider should be on the dashboard immediately, and push
    // registration can finish behind them.
    void registerForPush();
  };

  const signOut = async () => {
    // Before the token is cleared -- unregistering is an authenticated call.
    await unregisterPush();
    // Named keys, not AsyncStorage.clear(): clearing everything also throws
    // away anything else the app keeps, now or later.
    await clearAuthToken();
    apiService.setSessionToken(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
