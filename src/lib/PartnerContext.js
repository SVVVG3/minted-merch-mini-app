import { createContext, useContext, useState, useEffect } from 'react';

const PartnerContext = createContext();

export function usePartner() {
  const context = useContext(PartnerContext);
  if (!context) {
    throw new Error('usePartner must be used within a PartnerProvider');
  }
  return context;
}

export function PartnerProvider({ children }) {
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/partner/verify', {
        credentials: 'include' // Include cookies
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setPartner(result.partner);
        } else {
          setPartner(null);
        }
      } else {
        setPartner(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setPartner(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      const response = await fetch('/api/partner/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (result.success) {
        setPartner(result.partner);
        return { success: true };
      } else {
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Login failed:', error);
      const errorMessage = 'Login failed. Please try again.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      const response = await fetch('/api/partner/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        setPartner(null);
        return { success: true };
      } else {
        throw new Error('Logout failed');
      }
    } catch (error) {
      console.error('Logout failed:', error);
      return { success: false, error: 'Logout failed' };
    }
  };

  const value = {
    partner,
    loading,
    error,
    login,
    logout,
    checkAuth,
    isAuthenticated: !!partner
  };

  return (
    <PartnerContext.Provider value={value}>
      {children}
    </PartnerContext.Provider>
  );
} 