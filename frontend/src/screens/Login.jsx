import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { loginAutenticacao } from '../services/api';
import Portal from './Portal';
import logo from '../../Images/logo.png';

const Login = () => {
    const { login, isAuthenticated } = useAuth();
    const [credentials, setCredentials] = useState({
        Email: '',
        Password: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const validateCredentials = () => {
        const normalizedEmail = String(credentials.Email || '').trim();
        const password = String(credentials.Password || '');

        if (!normalizedEmail) {
            return 'Introduz o teu email.';
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return 'Introduz um email vÃ¡lido.';
        }

        if (!password.trim()) {
            return 'Introduz a tua palavra-passe.';
        }

        return '';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const validationError = validateCredentials();
        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);

        const normalizedEmail = String(credentials.Email || '').trim();

        try {
            const result = await loginAutenticacao({
                Email: normalizedEmail,
                Password: credentials.Password
            });

            if (result.token) {
                login(result.token, result.utilizador || { email: normalizedEmail });
            } else {
                setError(`Sem token na resposta: ${JSON.stringify(result, null, 2)}`);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (isAuthenticated) {
        return <Portal />;
    }

    return (
        <main className="login-page">
            <section className="login-shell login-shell--single">
                <section className="login-panel login-panel--form login-panel--single">
                    <div className="login-card">
                        <div className="login-brand login-brand--compact">
                            <div className="login-logo-wrap">
                                <img src={logo} alt="Ent'Artes" className="login-logo" />
                            </div>

                            <div>
                                <p className="login-eyebrow">Sistema de Gestão</p>
                                <h1>Ent'Artes</h1>
                                <p className="login-copy login-copy--dark">
                                    Autentica-te para aceder ao painel interno da plataforma.
                                </p>
                            </div>
                        </div>

                        <div className="login-card-header">
                            <h2>Autenticação</h2>
                            <p>Usa as tuas credenciais para entrar no painel interno.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="login-form">
                            <label className="login-label" htmlFor="email">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={credentials.Email}
                                onChange={(e) => setCredentials({ ...credentials, Email: e.target.value })}
                                className="login-input"
                                autoComplete="username"
                                inputMode="email"
                                placeholder="nome@exemplo.pt"
                                required
                            />

                            <label className="login-label" htmlFor="password">
                                Palavra-passe
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={credentials.Password}
                                onChange={(e) => setCredentials({ ...credentials, Password: e.target.value })}
                                className="login-input"
                                autoComplete="current-password"
                                placeholder="Introduz a tua palavra-passe"
                                required
                            />

                            {error && <div className="login-error">{error}</div>}

                            <button
                                type="submit"
                                disabled={loading}
                                className="login-submit"
                            >
                                {loading ? 'A autenticar...' : 'Iniciar sessão'}
                            </button>
                        </form>
                    </div>
                </section>
            </section>
        </main>
    );
};

export default Login;
