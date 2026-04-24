import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Dashboard from './Dashboard';
import FinanceManagement from './FinanceManagement';
import InventoryManagement from './InventoryManagement';
import RoleInventory from './RoleInventory';
import RequestValidation from './RequestValidation';
import ScheduleManagement from './ScheduleManagement';
import TeacherSchedule from './TeacherSchedule';
import TestsBackend from './TestsBackend';

const PERMISSOES = {
    ALUNO: 1,
    PROFESSOR: 2,
    DIRECAO: 3,
    ENCARREGADO: 4
};

const getRoleLabel = (permission) => {
    switch (permission) {
        case PERMISSOES.DIRECAO:
            return 'Direcao';
        case PERMISSOES.PROFESSOR:
            return 'Professor';
        case PERMISSOES.ENCARREGADO:
            return 'Encarregado';
        case PERMISSOES.ALUNO:
            return 'Aluno';
        default:
            return 'Utilizador';
    }
};

const Portal = () => {
    const { user, logout } = useAuth();
    const isDirecao = user?.Permissoes === PERMISSOES.DIRECAO;
    const isProfessor = user?.Permissoes === PERMISSOES.PROFESSOR;
    const [activeView, setActiveView] = useState('dashboard');

    const menuItems = useMemo(() => (
        isDirecao
            ? [
                { id: 'dashboard', label: 'Dashboard' },
                { id: 'schedule', label: 'Gestao de Horarios' },
                { id: 'requests', label: 'Request Validation' },
                { id: 'finance', label: 'Financeiro' },
                { id: 'inventory', label: 'Gestao de Inventario' }
            ]
            : isProfessor
                ? [
                    { id: 'dashboard', label: 'Dashboard' },
                    { id: 'teacher-schedule', label: 'Aulas e Disponibilidade' },
                    { id: 'inventory', label: 'Inventario e Aluguer' },
                    { id: 'tests', label: 'Tests Backend' }
                ]
            : [
                { id: 'dashboard', label: 'Dashboard' },
                { id: 'inventory', label: 'Inventario e Aluguer' },
                { id: 'tests', label: 'Tests Backend' }
            ]
    ), [isDirecao, isProfessor]);

    const renderContent = () => {
        if (activeView === 'requests' && isDirecao) {
            return <RequestValidation embedded />;
        }

        if (activeView === 'schedule' && isDirecao) {
            return <ScheduleManagement />;
        }

        if (activeView === 'inventory' && isDirecao) {
            return <InventoryManagement />;
        }

        if (activeView === 'finance' && isDirecao) {
            return <FinanceManagement />;
        }

        if (activeView === 'inventory' && !isDirecao) {
            return <RoleInventory />;
        }

        if (activeView === 'teacher-schedule' && isProfessor) {
            return <TeacherSchedule />;
        }

        if (activeView === 'tests' && !isDirecao) {
            return <TestsBackend embedded />;
        }

        return <Dashboard />;
    };

    return (
        <main className="portal-shell">
            <aside className="portal-sidebar">
                <div>
                    <p className="portal-eyebrow">Ent'Artes</p>
                    <h1>Portal</h1>
                    <p className="portal-user">{user?.Nome || 'Utilizador'} · {getRoleLabel(user?.Permissoes)}</p>
                </div>

                <nav className="portal-nav">
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className={`portal-nav-item ${activeView === item.id ? 'portal-nav-item--active' : ''}`}
                            onClick={() => setActiveView(item.id)}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>

                <button type="button" className="portal-logout" onClick={logout}>
                    Logout
                </button>
            </aside>

            <section className="portal-content">
                {renderContent()}
            </section>
        </main>
    );
};

export default Portal;
