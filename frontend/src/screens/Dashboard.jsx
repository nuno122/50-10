import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const PERMISSOES = {
    ALUNO: 1,
    PROFESSOR: 2,
    DIRECAO: 3,
    ENCARREGADO: 4
};

const getRoleKey = (permission) => {
    switch (permission) {
        case PERMISSOES.DIRECAO:
            return 'director';
        case PERMISSOES.PROFESSOR:
            return 'teacher';
        case PERMISSOES.ENCARREGADO:
            return 'guardian';
        case PERMISSOES.ALUNO:
            return 'student';
        default:
            return 'guest';
    }
};

const STATS_BY_ROLE = {
    director: [
        { title: 'Professores Ativos', value: '24', icon: 'US', tone: 'blue' },
        { title: 'Aulas Esta Semana', value: '156', icon: 'CA', tone: 'green' },
        { title: 'Validacoes Pendentes', value: '12', icon: 'EU', tone: 'amber' },
        { title: 'Artigos Inventario', value: '342', icon: 'PK', tone: 'purple' }
    ],
    teacher: [
        { title: 'Aulas Esta Semana', value: '18', icon: 'CA', tone: 'blue' },
        { title: 'Alunos Totais', value: '45', icon: 'US', tone: 'green' },
        { title: 'Horas Disponiveis', value: '32', icon: 'CL', tone: 'purple' },
        { title: 'Requisicoes Ativas', value: '3', icon: 'RQ', tone: 'amber' }
    ],
    guardian: [
        { title: 'Aulas Inscritas', value: '8', icon: 'CA', tone: 'blue' },
        { title: 'Proxima Aula', value: 'Hoje', icon: 'CL', tone: 'green' },
        { title: 'Pagamentos Pendentes', value: '2', icon: 'EU', tone: 'amber' },
        { title: 'Artigos Alugados', value: '3', icon: 'PK', tone: 'purple' }
    ],
    student: [
        { title: 'Aulas Esta Semana', value: '6', icon: 'CA', tone: 'blue' },
        { title: 'Proxima Aula', value: 'Amanha', icon: 'CL', tone: 'green' },
        { title: 'Total de Aulas', value: '24', icon: 'LB', tone: 'purple' },
        { title: 'Professores', value: '4', icon: 'US', tone: 'amber' }
    ]
};

const INFO_BY_ROLE = {
    director: {
        welcome: "Bem-vindo ao painel de gestao da Ent'Artes",
        quick: [
            ['Estudios Disponiveis', '8'],
            ['Professores Convidados', '3'],
            ['Prazo Validacao (horas)', '48'],
            ['Figurinos Alugados', '28']
        ],
        activity: [
            ['Nova aula agendada', '5 minutos atras', 'booking'],
            ['Validacao concluida pelo Diretor', '1 hora atras', 'validation'],
            ['Pedido de aluguer de figurino', '2 horas atras', 'inventory'],
            ['Notificacao enviada a professor', '3 horas atras', 'notification']
        ]
    },
    teacher: {
        welcome: 'Gerencie as suas aulas e disponibilidade',
        quick: [
            ['Aulas Hoje', '4'],
            ['Proxima Aula', '14:00'],
            ['Turmas Ativas', '6'],
            ['Taxa de Presenca', '94%']
        ],
        activity: [
            ['Aula de Ballet as 09:00 concluida', '2 horas atras', 'booking'],
            ['Disponibilidade atualizada', '5 horas atras', 'validation'],
            ['Material requisitado aprovado', '1 dia atras', 'inventory'],
            ['Nova turma atribuida', '2 dias atras', 'notification']
        ]
    },
    guardian: {
        welcome: 'Acompanhe as atividades do seu educando',
        quick: [
            ['Proxima Aula', 'Amanha as 14:00'],
            ['Aulas Este Mes', '16'],
            ['Valor Pendente', 'EUR 45'],
            ['Taxa de Presenca', '96%']
        ],
        activity: [
            ['Inscricao em aula de Jazz confirmada', '1 hora atras', 'booking'],
            ['Pagamento processado', '2 dias atras', 'validation'],
            ['Pedido de aluguer aprovado', '3 dias atras', 'inventory'],
            ['Nova aula particular agendada', '4 dias atras', 'notification']
        ]
    },
    student: {
        welcome: 'A sua agenda de danca',
        quick: [
            ['Proxima Aula', 'Amanha as 14:00'],
            ['Aulas Este Mes', '16'],
            ['Estilos de Danca', '3'],
            ['Taxa de Presenca', '96%']
        ],
        activity: [
            ['Aula de Ballet Classico amanha', 'Lembrete', 'booking'],
            ['Aula de Hip Hop concluida', '2 dias atras', 'validation'],
            ['Nova aula agendada', '3 dias atras', 'notification'],
            ['Presenca confirmada', '5 dias atras', 'booking']
        ]
    },
    guest: {
        welcome: "Bem-vindo a Ent'Artes",
        quick: [],
        activity: []
    }
};

const Dashboard = () => {
    const { user } = useAuth();
    const roleKey = getRoleKey(user?.Permissoes);
    const stats = STATS_BY_ROLE[roleKey] || [];
    const info = INFO_BY_ROLE[roleKey] || INFO_BY_ROLE.guest;

    return (
        <div className="dashboard-page">
            <div className="dashboard-header">
                <div>
                    <p className="dashboard-eyebrow">Dashboard</p>
                    <h1>Painel Principal</h1>
                    <p className="dashboard-subtitle">{info.welcome}</p>
                </div>
            </div>

            <div className="dashboard-stats">
                {stats.map((stat) => (
                    <article key={stat.title} className="dashboard-card dashboard-stat-card">
                        <div>
                            <p className="dashboard-stat-title">{stat.title}</p>
                            <p className="dashboard-stat-value">{stat.value}</p>
                        </div>
                        <div className={`dashboard-stat-icon dashboard-stat-icon--${stat.tone}`}>{stat.icon}</div>
                    </article>
                ))}
            </div>

            <div className="dashboard-grid">
                <section className="dashboard-card">
                    <div className="dashboard-card-header">
                        <h2>Informacao Rapida</h2>
                    </div>
                    <div className="dashboard-list">
                        {info.quick.map(([label, value]) => (
                            <div key={label} className="dashboard-list-row">
                                <span>{label}</span>
                                <strong>{value}</strong>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="dashboard-card">
                    <div className="dashboard-card-header">
                        <h2>Atividade Recente</h2>
                    </div>
                    <div className="dashboard-activity">
                        {info.activity.map(([action, time, type]) => (
                            <div key={`${action}-${time}`} className="dashboard-activity-row">
                                <span className={`dashboard-dot dashboard-dot--${type}`} />
                                <div>
                                    <p>{action}</p>
                                    <small>{time}</small>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Dashboard;
