import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getRoleLabel, isAluno, isDirecao, isEncarregado, isProfessor } from '../utils/permissions';
import Dashboard from './Dashboard';
import FinanceManagement from './FinanceManagement';
import GuardianLessons from './GuardianLessons';
import GuardianLessonRequest from './GuardianLessonRequest';
import InventoryManagement from './InventoryManagement';
import LessonValidation from './LessonValidation';
import RoleInventory from './RoleInventory';
import RequestValidation from './RequestValidation';
import ScheduleManagement from './ScheduleManagement';
import StudentAgenda from './StudentAgenda';
import TeacherSchedule from './TeacherSchedule';
import UserManagement from './UserManagement';

const Portal = () => {
    const { user, logout } = useAuth();
    const userIsDirecao = isDirecao(user);
    const userIsProfessor = isProfessor(user);
    const userIsAluno = isAluno(user);
    const userIsEncarregado = isEncarregado(user);
    const [activeView, setActiveView] = useState('dashboard');

    const menuItems = useMemo(() => (
        userIsDirecao
            ? [
                { id: 'dashboard', label: 'Dashboard' },
                { id: 'schedule', label: 'Gestao de Horarios' },
                { id: 'users', label: 'Gestao de Utilizadores' },
                { id: 'rental-requests', label: 'Alugueres e Extensoes' },
                { id: 'lesson-validations', label: 'Aulas e Cancelamentos' },
                { id: 'finance', label: 'Financeiro' },
                { id: 'inventory', label: 'Gestao de Inventario' }
            ]
            : userIsProfessor
                ? [
                    { id: 'dashboard', label: 'Dashboard' },
                    { id: 'teacher-schedule', label: 'Aulas e Disponibilidade' },
                    { id: 'inventory', label: 'Inventario e Aluguer' }
                ]
                : userIsEncarregado
                    ? [
                        { id: 'dashboard', label: 'Dashboard' },
                        { id: 'lesson-request', label: 'Pedido de Aula Privada' },
                        { id: 'guardian-lessons', label: 'Aulas e Cancelamentos' },
                        { id: 'finance', label: 'Pagamentos' },
                        { id: 'inventory', label: 'Inventario e Aluguer' }
                    ]
                    : userIsAluno
                        ? [
                            { id: 'dashboard', label: 'Dashboard' },
                            { id: 'agenda', label: 'A Minha Agenda' }
                        ]
                        : [
                            { id: 'dashboard', label: 'Dashboard' },
                            { id: 'inventory', label: 'Inventario e Aluguer' }
                        ]
    ), [userIsAluno, userIsDirecao, userIsEncarregado, userIsProfessor]);

    const renderContent = () => {
        if (activeView === 'rental-requests' && userIsDirecao) {
            return <RequestValidation embedded />;
        }

        if (activeView === 'lesson-validations' && userIsDirecao) {
            return <LessonValidation embedded />;
        }

        if (activeView === 'schedule' && userIsDirecao) {
            return <ScheduleManagement />;
        }

        if (activeView === 'inventory' && userIsDirecao) {
            return <InventoryManagement />;
        }

        if (activeView === 'users' && userIsDirecao) {
            return <UserManagement />;
        }

        if (activeView === 'finance' && (userIsDirecao || userIsEncarregado)) {
            return <FinanceManagement />;
        }

        if (activeView === 'agenda' && userIsAluno) {
            return <StudentAgenda />;
        }

        if (activeView === 'lesson-request' && userIsEncarregado) {
            return <GuardianLessonRequest />;
        }

        if (activeView === 'guardian-lessons' && userIsEncarregado) {
            return <GuardianLessons />;
        }

        if (activeView === 'inventory' && !userIsDirecao && !userIsAluno) {
            return <RoleInventory />;
        }

        if (activeView === 'teacher-schedule' && userIsProfessor) {
            return <TeacherSchedule />;
        }

        return <Dashboard />;
    };

    return (
        <main className="portal-shell">
            <aside className="portal-sidebar">
                <div>
                    <p className="portal-eyebrow">Ent'Artes</p>
                    <h1>Portal</h1>
                    <p className="portal-user">{user?.Nome || 'Utilizador'} - {getRoleLabel(user?.Permissoes)}</p>
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
