import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/types';
import { fetchWithAuth } from '@/lib/api';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  signup: (username: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check for stored session and token
    const storedUser = localStorage.getItem('collab-user');
    const token = localStorage.getItem('collab-token');
    
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
      
      // Verify token/fetch latest profile silently
      fetchWithAuth('/users/me')
        .then(u => {
          if (u) {
            setUser(u);
            localStorage.setItem('collab-user', JSON.stringify(u));
          }
        })
        .catch(err => {
          console.error('Session expired or invalid', err);
          logout();
        });
    }
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const lowerUsername = username.toLowerCase();
      
      // Allow logging in with either username or email natively
      const isEmail = lowerUsername.includes('@');
      const payload = isEmail 
        ? { email: lowerUsername, password } 
        : { username: lowerUsername, password };
      
      const response = await fetchWithAuth('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      if (response && response.access_token) {
        localStorage.setItem('collab-token', response.access_token);
        
        // Fetch real user info
        const userProfile = await fetchWithAuth('/users/me');
        if (userProfile) {
          setUser(userProfile);
          localStorage.setItem('collab-user', JSON.stringify(userProfile));
          return true;
        }
      }
      return false;
    } catch (e: any) {
      console.error('Login error:', e);
      toast.error(e.message || 'Failed to login');
      return false;
    }
  };

  const signup = async (username: string, email: string, password: string): Promise<boolean> => {
    try {
      const lowerUsername = username.toLowerCase();
      
      await fetchWithAuth('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: lowerUsername, email, password }),
      });
      
      // Auto login after successful signup
      return await login(lowerUsername, password);
    } catch (e: any) {
      console.error('Signup error:', e);
      toast.error(e.message || 'Failed to create account');
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('collab-user');
    localStorage.removeItem('collab-token');
  };

  const updateUser = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('collab-user', JSON.stringify(newUser));
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, signup, logout, updateUser }}>
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
