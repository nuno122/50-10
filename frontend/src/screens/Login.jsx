import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { loginUtilizador, loginAutenticacao } from '../services/api';
import TestesBackend from './TestsBackend';

const buttonStyle = {
    padding: '12px 24px',
    borderRadius: '999px',
    border: 'none',
    background: 'linear-gradient(135deg, #6f4e2c 0%, #b98543 100%)',
    color: '#fffaf2',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: '16px',
    width: '100%',
    marginBottom: '12px'
};

const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1px solid #d8c3a5',
    backgroundColor: '#fffaf3',
    fontSize: '16px',
    marginBottom: '16px',
    boxSizing: 'border-box'
};

const Login = () => {
    const { login, isAuthenticated } = useAuth();
    const [credentials, setCredentials] = useState({
        Email: 'geral@entartes.pt',
        Password: '123456', // or PalavraPasseHash
        useUtilizadores: true // true: /utilizadores/login, false: /autenticacao/login
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            let result;
            if (credentials.useUtilizadores) {
                // /utilizadores/login NÃO retorna token, só validação
                result = await loginUtilizador({
                    Email: credentials.Email,
                    PalavraPasseHash: credentials.Password
                });
                setError('✅ VALIDAÇÃO OK! (sem token) Desmarca para JWT + testes →');
                return; // Não avança
            } else {
                result = await loginAutenticacao({
                    Email: credentials.Email,
                    Password: credentials.Password
                });
            }

            if (result.token) {
                login(result.token, result.utilizador || { email: credentials.Email });
            } else {
                setError(`❌ Sem token! Resposta: ${JSON.stringify(result, null, 2)}`);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (isAuthenticated) {
        return <TestesBackend />;
    }

    return (
        <main style={{
            minHeight: '100vh',
            padding: '60px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f8f4ed 0%, #e8d9c2 100%)'
        }}>
            <section style={{
                width: '100%',
                maxWidth: '420px',
                backgroundColor: 'rgba(255, 252, 246, 0.95)',
                border: '1px solid rgba(123, 92, 48, 0.2)',
                borderRadius: '28px',
                padding: '48px 36px',
                boxShadow: '0 32px 80px rgba(89, 61, 25, 0.15)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h1 style={{
                        margin: '0 0 12px',
                        fontSize: '36px',
                        color: '#2f2419',
                        fontWeight: 800
                    }}>
                        Ent'Artes
                    </h1>
                    <p style={{ margin: 0, color: '#5f5447', fontSize: '18px' }}>
                        Autentica-te para aceder aos testes da API
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#3c2d1b' }}>
                        Email
                    </label>
                    <input
                        type="email"
                        value={credentials.Email}
                        onChange={(e) => setCredentials({ ...credentials, Email: e.target.value })}
                        style={inputStyle}
                        required
                    />

                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#3c2d1b' }}>
                        Password / PalavraPasseHash
                    </label>
                    <input
                        type="password"
                        value={credentials.Password}
                        onChange={(e) => setCredentials({ ...credentials, Password: e.target.value })}
                        style={inputStyle}
                        required
                    />

                    <label style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                        <input
                            type="checkbox"
                            checked={credentials.useUtilizadores}
                            onChange={(e) => setCredentials({ ...credentials, useUtilizadores: e.target.checked })}
                            style={{ marginRight: '12px', width: '18px', height: '18px' }}
                        />
                        <span style={{ fontSize: '14px', color: '#5f5447' }}>🔒 Teste SEM token (só valida - FICA aqui)</span>
                    </label>

                    {error && (
                        <div style={{
                            backgroundColor: '#fee',
                            color: '#9f2d2d',
                            padding: '12px',
                            borderRadius: '8px',
                            marginBottom: '16px',
                            border: '1px solid #fcc'
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            ...buttonStyle,
                            opacity: loading ? 0.7 : 1,
                            cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {loading ? 'A autenticar...' : 'Entrar nos Testes'}
                    </button>

                    <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: '#736554' }}>
                        <strong>Credenciais de teste:</strong><br />
                        Email: <code>geral@entartes.pt</code><br />
                        Password: <code>123456</code>
                    </div>
                </form>
            </section>
        </main>
    );
};

export default Login;

