import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { getRoleLabel, isDirecao, isEncarregado, isProfessor } from '../utils/permissions';
import Dashboard from './Dashboard';
import EventManagement from './EventManagement';
import FinanceManagement from './FinanceManagement';
import GuardianLessons from './GuardianLessons';
import GuardianLessonRequest from './GuardianLessonRequest';
import InventoryManagement from './InventoryManagement';
import LessonValidation from './LessonValidation';
import RoleInventory from './RoleInventory';
import RequestValidation from './RequestValidation';
import ScheduleManagement from './ScheduleManagement';
import TeacherSchedule from './TeacherSchedule';
import UserManagement from './UserManagement';

const formatNotificationTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

const getNotificationToneLabel = (tone) => {
    switch (tone) {
        case 'success':
            return 'Sucesso';
        case 'warning':
            return 'Alerta';
        case 'danger':
            return 'Critico';
        default:
            return 'Info';
    }
};

const Portal = () => {
    const { user, logout } = useAuth();
    const { notifications, unreadCount, markAllAsRead, markAsRead } = useNotifications();
    const userIsDirecao = isDirecao(user);
    const userIsProfessor = isProfessor(user);
    const userIsEncarregado = isEncarregado(user);
    const [activeView, setActiveView] = useState('dashboard');
    const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
    const notificationButtonRef = useRef(null);
    const notificationPanelRef = useRef(null);

    const menuItems = useMemo(() => (
        userIsDirecao
            ? [
                { id: 'dashboard', label: 'Resumo' },
                { id: 'events', label: 'Eventos' },
                { id: 'schedule', label: 'Horarios e Aulas' },
                { id: 'users', label: 'Utilizadores' },
                { id: 'rental-requests', label: 'Alugueres' },
                { id: 'lesson-validations', label: 'Validacoes' },
                { id: 'finance', label: 'Financeiro' },
                { id: 'inventory', label: 'Inventario' }
            ]
            : userIsProfessor
                ? [
                    { id: 'dashboard', label: 'Resumo' },
                    { id: 'events', label: 'Eventos' },
                    { id: 'teacher-schedule', label: 'Agenda e Disponibilidade' },
                    { id: 'teacher-private-requests', label: 'Pedidos de Coaching' },
                    { id: 'inventory', label: 'Alugueres e Inventario' }
                ]
                : userIsEncarregado
                ? [
                    { id: 'dashboard', label: 'Resumo' },
                    { id: 'events', label: 'Eventos' },
                    { id: 'lesson-request', label: 'Coaching' },
                    { id: 'guardian-lessons', label: 'Marcacoes' },
                    { id: 'finance', label: 'Pagamentos' },
                    { id: 'inventory', label: 'Alugueres e Inventario' }
                ]
                        : [
                            { id: 'dashboard', label: 'Resumo' },
                            { id: 'inventory', label: 'Alugueres e Inventario' }
                        ]
    ), [userIsDirecao, userIsEncarregado, userIsProfessor]);

    const visibleNotifications = useMemo(() => notifications.slice(0, 12), [notifications]);

    const toggleNotifications = () => {
        setIsNotificationPanelOpen((current) => {
            const next = !current;
            if (next && unreadCount > 0) {
                markAllAsRead();
            }
            return next;
        });
    };

    useEffect(() => {
        if (!isNotificationPanelOpen) {
            return undefined;
        }

        const handlePointerDown = (event) => {
            if (notificationButtonRef.current?.contains(event.target) || notificationPanelRef.current?.contains(event.target)) {
                return;
            }

            setIsNotificationPanelOpen(false);
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setIsNotificationPanelOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isNotificationPanelOpen]);

    const handleNavigation = (viewId) => {
        setActiveView(viewId);
        setIsNotificationPanelOpen(false);
    };

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

        if (activeView === 'events' && (userIsDirecao || userIsProfessor || userIsEncarregado)) {
            return <EventManagement />;
        }

        if (activeView === 'lesson-request' && userIsEncarregado) {
            return <GuardianLessonRequest />;
        }

        if (activeView === 'guardian-lessons' && userIsEncarregado) {
            return <GuardianLessons />;
        }

        if (activeView === 'inventory' && !userIsDirecao) {
            return <RoleInventory />;
        }

        if (activeView === 'teacher-schedule' && userIsProfessor) {
            return <TeacherSchedule initialTab="lessons" />;
        }

        if (activeView === 'teacher-private-requests' && userIsProfessor) {
            return <TeacherSchedule initialTab="privateRequests" />;
        }

        return <Dashboard />;
    };

    return (
        <main className="portal-shell">
            <aside className="portal-sidebar">
                <div className="portal-sidebar-top">
                    <div>
                        <p className="portal-eyebrow">Ent'Artes</p>
                        <h1>Portal</h1>
                        <p className="portal-user">{user?.Nome || 'Utilizador'} - {getRoleLabel(user?.Permissoes)}</p>
                    </div>

                    <div className="portal-utility-row">
                        <button
                            ref={notificationButtonRef}
                            type="button"
                            className={`portal-notification-button ${isNotificationPanelOpen ? 'portal-notification-button--active' : ''}`}
                            onClick={toggleNotifications}
                        >
                            <span className="portal-notification-button-copy">
                                <strong>Notificacoes</strong>
                                <small>{unreadCount > 0 ? `${unreadCount} por ler` : 'Tudo em dia'}</small>
                            </span>
                            <span className="portal-notification-icon-wrap" aria-hidden="true">
                                <svg className="portal-notification-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                    <path d="M12 4a4 4 0 0 0-4 4v2.2c0 .7-.2 1.4-.6 2l-1.1 1.8A1 1 0 0 0 7.2 16h9.6a1 1 0 0 0 .9-1.5l-1.1-1.8a3.8 3.8 0 0 1-.6-2V8a4 4 0 0 0-4-4Z" />
                                    <path d="M10 18a2 2 0 0 0 4 0" />
                                </svg>
                                {unreadCount > 0 && (
                                    <span className="portal-notification-count">
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </span>
                        </button>
                    </div>

                    <nav className="portal-nav">
                        {menuItems.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                className={`portal-nav-item ${activeView === item.id ? 'portal-nav-item--active' : ''}`}
                                onClick={() => handleNavigation(item.id)}
                            >
                                {item.label}
                            </button>
                        ))}
                    </nav>
                </div>

                <button type="button" className="portal-logout" onClick={logout}>
                    Terminar Sessao
                </button>
            </aside>

            <section className="portal-content">
                {renderContent()}

                {isNotificationPanelOpen && (
                    <div className="portal-notification-overlay">
                        <section ref={notificationPanelRef} className="portal-notification-panel portal-notification-panel--overlay">
                            <div className="portal-notification-panel-header">
                                <div>
                                    <h2>Centro de Notificacoes</h2>
                                    <p>Alertas recentes da tua atividade na aplicacao.</p>
                                </div>
                                <button type="button" className="portal-notification-action" onClick={markAllAsRead}>
                                    Marcar tudo
                                </button>
                            </div>

                            {visibleNotifications.length === 0 ? (
                                <div className="portal-notification-empty">
                                    <p>Sem notificacoes recentes.</p>
                                </div>
                            ) : (
                                <div className="portal-notification-list">
                                    {visibleNotifications.map((notification) => (
                                        <button
                                            key={notification.id}
                                            type="button"
                                            className={`portal-notification-item ${notification.read ? '' : 'portal-notification-item--unread'}`}
                                            onClick={() => markAsRead(notification.id)}
                                        >
                                            <div className="portal-notification-meta">
                                                <strong>{notification.title}</strong>
                                                <span className={`portal-notification-tag portal-notification-tag--${notification.tone || 'info'}`}>
                                                    {getNotificationToneLabel(notification.tone)}
                                                </span>
                                            </div>
                                            {notification.message && <p>{notification.message}</p>}
                                            <span className="portal-notification-time">{formatNotificationTime(notification.createdAt)}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </section>
        </main>
    );
};

export default Portal;
