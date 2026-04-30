import PERMISSOES from '../../../shared/permissions.json';

export { PERMISSOES };

export const ROLE_LABELS = {
    [PERMISSOES.ALUNO]: 'Aluno',
    [PERMISSOES.PROFESSOR]: 'Professor',
    [PERMISSOES.DIRECAO]: 'Direcao',
    [PERMISSOES.ENCARREGADO]: 'Encarregado'
};

export const getRoleLabel = (permission) => ROLE_LABELS[permission] || 'Utilizador';

export const isAluno = (user) => user?.Permissoes === PERMISSOES.ALUNO;

export const isProfessor = (user) => user?.Permissoes === PERMISSOES.PROFESSOR;

export const isDirecao = (user) => user?.Permissoes === PERMISSOES.DIRECAO;

export const isEncarregado = (user) => user?.Permissoes === PERMISSOES.ENCARREGADO;
