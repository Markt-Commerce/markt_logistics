import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import apiService from '../services/api';

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
        const token = await AsyncStorage.getItem('sessionToken');
        if (token) {
          apiService.setSessionToken(token);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const signIn = async (sessionToken: string) => {
    await AsyncStorage.setItem('sessionToken', sessionToken);
    apiService.setSessionToken(sessionToken);
    setIsAuthenticated(true);
  };

  const signOut = async () => {
    await AsyncStorage.clear();
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
