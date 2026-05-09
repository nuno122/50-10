import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const AuthContext = createContext();

const normalizeUserData = (userData) => {
    if (!userData || typeof userData !== 'object') {
        return userData;
    }

    const idUtilizador = userData.IdUtilizador || userData.Id || null;
    const nomeCompleto = userData.NomeCompleto || userData.Nome || '';

    return {
        ...userData,
        ...(idUtilizador ? { Id: idUtilizador, IdUtilizador: idUtilizador } : {}),
        ...(nomeCompleto ? { Nome: nomeCompleto, NomeCompleto: nomeCompleto } : {})
    };
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(null);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const login = useCallback((newToken, userData) => {
        const normalizedUser = normalizeUserData(userData);
        setToken(newToken);
        setUser(normalizedUser);
        localStorage.setItem('authToken', newToken);
        localStorage.setItem('authUser', JSON.stringify(normalizedUser));
    }, []);

    const logout = useCallback(() => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
    }, []);

    useEffect(() => {
        // Load token from localStorage on app start
        const savedToken = localStorage.getItem('authToken');
        const savedUser = localStorage.getItem('authUser');
        if (savedToken) {
            setToken(savedToken);
            if (savedUser) setUser(normalizeUserData(JSON.parse(savedUser)));
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        const handleAuthInvalid = () => {
            logout();
        };

        window.addEventListener('entartes:auth-invalid', handleAuthInvalid);
        return () => {
            window.removeEventListener('entartes:auth-invalid', handleAuthInvalid);
        };
    }, [logout]);

    const value = {
        token,
        user,
        login,
        logout,
        isAuthenticated: !!token,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

