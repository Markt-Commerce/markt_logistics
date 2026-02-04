import React, { createContext, useContext, useState, ReactNode } from 'react';

interface Partner {
  id: string;
  name: string;
  status: string;
}

interface AuthContextType {
  partner: Partner | null;
  login: (phone: string, otp: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [partner, setPartner] = useState<Partner | null>(null);

  const login = async (phone: string, otp: string) => {
    // TODO: Implement login API call
    // For now, mock login
    const mockPartner: Partner = {
      id: 'dp_123',
      name: 'John',
      status: 'ACTIVE',
    };
    setPartner(mockPartner);
  };

  const logout = () => {
    setPartner(null);
  };

  return (
    <AuthContext.Provider value={{ partner, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
