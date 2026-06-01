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
import RoleRental from './RoleRental';
import RequestValidation from './RequestValidation';
import ScheduleManagement from './ScheduleManagement';
import TeacherSchedule from './TeacherSchedule';
import UserManagement from './UserManagement';

const SIDEBAR_STORAGE_KEY = 'entartes-portal-sidebar-width';
const SIDEBAR_DEFAULT_WIDTH = 280;
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 380;

const clampSidebarWidth = (value) => Math.min(
    SIDEBAR_MAX_WIDTH,
    Math.max(SIDEBAR_MIN_WIDTH, Number(value) || SIDEBAR_DEFAULT_WIDTH)
);

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
            return 'Crítico';
        default:
            return 'Info';
    }
};

const Portal = () => {
    const { user, logout } = useAuth();
    const {
        notifications,
        unreadCount,
        markAllAsRead,
        markAsRead,
        removeNotification,
        clearNotifications
    } = useNotifications();
    const userIsDirecao = isDirecao(user);
    const userIsProfessor = isProfessor(user);
    const userIsEncarregado = isEncarregado(user);
    const [activeView, setActiveView] = useState('dashboard');
    const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        if (typeof window === 'undefined') return SIDEBAR_DEFAULT_WIDTH;
        return clampSidebarWidth(localStorage.getItem(SIDEBAR_STORAGE_KEY));
    });
    const notificationButtonRef = useRef(null);
    const notificationPanelRef = useRef(null);

    const menuItems = useMemo(() => (
        userIsDirecao
            ? [
                { id: 'dashboard', label: 'Resumo' },
                { id: 'events', label: 'Eventos' },
                { id: 'schedule', label: 'Horários e Aulas' },
                { id: 'users', label: 'Utilizadores' },
                { id: 'rental-catalog', label: 'Catálogo de Aluguer' },
                { id: 'rental-requests', label: 'Alugueres' },
                { id: 'lesson-validations', label: 'Validações' },
                { id: 'finance', label: 'Financeiro' },
                { id: 'inventory', label: 'Inventário' }
            ]
            : userIsProfessor
                ? [
                    { id: 'dashboard', label: 'Resumo' },
                    { id: 'events', label: 'Eventos' },
                    { id: 'teacher-schedule', label: 'Agenda e Disponibilidade' },
                    { id: 'teacher-private-requests', label: 'Pedidos de Coaching' },
                    { id: 'inventory', label: 'Inventário' },
                    { id: 'rentals', label: 'Alugueres' }
                ]
                : userIsEncarregado
                    ? [
                        { id: 'dashboard', label: 'Resumo' },
                        { id: 'events', label: 'Eventos' },
                        { id: 'lesson-request', label: 'Pedido de Coaching' },
                        { id: 'guardian-lessons', label: 'Aulas e cancelamentos' },
                        { id: 'finance', label: 'Pagamentos' },
                        { id: 'inventory', label: 'Inventário' },
                        { id: 'rentals', label: 'Alugueres' }
                    ]
                    : [
                        { id: 'dashboard', label: 'Resumo' },
                        { id: 'inventory', label: 'Inventário' },
                        { id: 'rentals', label: 'Alugueres' }
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

    const handleSidebarResizeStart = (event) => {
        if (event.button !== undefined && event.button !== 0) return;

        event.preventDefault();

        const startX = event.clientX;
        const startWidth = sidebarWidth;
        let nextWidth = sidebarWidth;

        document.body.classList.add('portal-sidebar-is-resizing');

        const handlePointerMove = (moveEvent) => {
            nextWidth = clampSidebarWidth(startWidth + moveEvent.clientX - startX);
            setSidebarWidth(nextWidth);
        };

        const handlePointerUp = () => {
            document.body.classList.remove('portal-sidebar-is-resizing');
            localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextWidth));
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
    };

    const renderContent = () => {
        if (activeView === 'rental-catalog' && userIsDirecao) {
            return <InventoryManagement inventoryType="rental" />;
        }

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
            return <InventoryManagement inventoryType="marketplace" />;
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

        if (activeView === 'rentals' && !userIsDirecao) {
            return <RoleRental />;
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
        <main className="portal-shell" style={{ '--portal-sidebar-width': `${sidebarWidth}px` }}>
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
                                <strong>Notificações</strong>
                                {unreadCount > 0 && <small>{`${unreadCount} por ler`}</small>}
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
                    Terminar sessão
                </button>
            </aside>

            <button
                type="button"
                className="portal-sidebar-resizer"
                aria-label="Ajustar largura do menu"
                title="Arrastar para ajustar a largura do menu"
                onPointerDown={handleSidebarResizeStart}
            />

            <section className="portal-content">
                {renderContent()}

                {isNotificationPanelOpen && (
                    <div className="portal-notification-overlay">
                        <section ref={notificationPanelRef} className="portal-notification-panel portal-notification-panel--overlay">
                            <div className="portal-notification-panel-header">
                                <div>
                                    <h2>Centro de notificações</h2>
                                    <p>Alertas recentes da tua atividade na aplicação.</p>
                                </div>
                                <div className="portal-notification-panel-actions">
                                    <button type="button" className="portal-notification-action" onClick={markAllAsRead}>
                                        Marcar como lidas
                                    </button>
                                    <button type="button" className="portal-notification-action portal-notification-action--danger" onClick={clearNotifications}>
                                        Limpar tudo
                                    </button>
                                </div>
                            </div>

                            {visibleNotifications.length === 0 ? (
                                <div className="portal-notification-empty">
                                    <p>Sem notificações recentes.</p>
                                </div>
                            ) : (
                                <div className="portal-notification-list">
                                    {visibleNotifications.map((notification) => (
                                        <article
                                            key={notification.id}
                                            className={`portal-notification-item ${notification.read ? '' : 'portal-notification-item--unread'}`}
                                            onClick={() => markAsRead(notification.id)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    markAsRead(notification.id);
                                                }
                                            }}
                                            role="button"
                                            tabIndex={0}
                                        >
                                            <div className="portal-notification-meta">
                                                <strong>{notification.title}</strong>
                                                <span className={`portal-notification-tag portal-notification-tag--${notification.tone || 'info'}`}>
                                                    {getNotificationToneLabel(notification.tone)}
                                                </span>
                                            </div>
                                            {notification.message && <p>{notification.message}</p>}
                                            <div className="portal-notification-item-actions">
                                                <span className="portal-notification-time">{formatNotificationTime(notification.createdAt)}</span>
                                                <button
                                                    type="button"
                                                    className="portal-notification-remove"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        removeNotification(notification.id);
                                                    }}
                                                >
                                                    Eliminar
                                                </button>
                                            </div>
                                        </article>
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




