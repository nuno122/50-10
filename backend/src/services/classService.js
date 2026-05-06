const classRepo = require('../repositories/classRepository');
const PERMISSOES = require('../config/permissions');

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

const TIPOS_AULA_VALIDOS = ['Regular', 'Particular'];

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const relationMatchesStyle = (relation, estilo) => (
    relation.IdEstiloDanca === estilo?.IdEstiloDanca ||
    (
        Boolean(normalizeText(relation.EstiloDanca?.Nome)) &&
        Boolean(normalizeText(estilo?.Nome)) &&
        normalizeText(relation.EstiloDanca?.Nome) === normalizeText(estilo?.Nome)
    )
);

const toMinutes = (value) => {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
        return (date.getUTCHours() * 60) + date.getUTCMinutes();
    }

    const match = String(value || '').match(/(\d{2}):(\d{2})/);
    if (!match) {
        return null;
    }

    return (Number(match[1]) * 60) + Number(match[2]);
};

const construirDataHoraAula = (aula, campoHora = 'HoraFim') => {
    const data = new Date(aula?.Data);
    if (Number.isNaN(data.getTime())) {
        return new Date(0);
    }

    const hora = new Date(aula?.[campoHora]);
    if (Number.isNaN(hora.getTime())) {
        return new Date(0);
    }

    data.setHours(hora.getUTCHours(), hora.getUTCMinutes(), 0, 0);
    return data;
};

const aulaTerminou = (aula) => construirDataHoraAula(aula, 'HoraFim') <= new Date();

const intervaloCabeNaDisponibilidade = (horaInicio, horaFim, disponibilidades = []) => {
    const inicioAula = toMinutes(horaInicio);
    const fimAula = toMinutes(horaFim);

    if (!Number.isFinite(inicioAula) || !Number.isFinite(fimAula)) {
        return false;
    }

    return disponibilidades.some((disponibilidade) => {
        const inicioDisponivel = toMinutes(disponibilidade.HoraInicio);
        const fimDisponivel = toMinutes(disponibilidade.HoraFim);
        if (!Number.isFinite(inicioDisponivel) || !Number.isFinite(fimDisponivel)) {
            return false;
        }

        return inicioAula >= inicioDisponivel && fimAula <= fimDisponivel;
    });
};

const professorSuportaEstilo = (professor, estilo) => (
    Array.isArray(professor?.EstiloProfessor) &&
    professor.EstiloProfessor.some((item) => relationMatchesStyle(item, estilo))
);

const estudioSuportaEstilo = (estudio, estilo) => (
    Array.isArray(estudio?.EstudioEstilo) &&
    estudio.EstudioEstilo.some((item) => relationMatchesStyle(item, estilo))
);

const ConsultarVagas = async () => {
    return await classRepo.GetAulasDisponiveis();
};

const criarAula = async (dados) => {
    const obrigatorios = [
        'Data',
        'HoraInicio',
        'HoraFim',
        'CapacidadeMaxima',
        'Preco',
        'IdProfessor',
        'IdEstudio',
        'IdEstiloDanca'
    ];

    const emFalta = obrigatorios.filter((campo) => {
        const valor = dados[campo];
        return valor === undefined || valor === null || valor === '';
    });

    if (emFalta.length > 0) {
        throw criarErro(`Campos obrigatorios em falta: ${emFalta.join(', ')}`, 400);
    }

    const tipoAula = dados.TipoAula || 'Regular';

    if (!TIPOS_AULA_VALIDOS.includes(tipoAula)) {
        throw criarErro('TipoAula invalido. Usa Regular ou Particular.', 400);
    }

    const [professor, estudio, estilo] = await Promise.all([
        classRepo.findProfessorById(dados.IdProfessor),
        classRepo.findEstudioById(dados.IdEstudio),
        classRepo.findEstiloById(dados.IdEstiloDanca)
    ]);

    if (!professor) {
        throw criarErro('O professor selecionado nao existe na tabela Professor.', 400);
    }

    if (!professorSuportaEstilo(professor, estilo)) {
        throw criarErro('O professor selecionado nao esta associado ao estilo escolhido.', 400);
    }

    if (!estudio) {
        throw criarErro('O estudio selecionado nao existe.', 400);
    }

    if (!estudioSuportaEstilo(estudio, estilo)) {
        throw criarErro('O estudio selecionado nao suporta o estilo escolhido.', 400);
    }

    if (!estilo) {
        throw criarErro('O estilo de danca selecionado nao existe.', 400);
    }

    if (Number(dados.CapacidadeMaxima) > Number(estudio.Capacidade || 0)) {
        throw criarErro('A capacidade da aula excede a capacidade do estudio selecionado.', 400);
    }

    const novaHoraInicio = toMinutes(dados.HoraInicio);
    const novaHoraFim = toMinutes(dados.HoraFim);

    if (!Number.isFinite(novaHoraInicio) || !Number.isFinite(novaHoraFim)) {
        throw criarErro('Horario da aula invalido.', 400);
    }

    if (novaHoraFim <= novaHoraInicio) {
        throw criarErro('A hora de fim tem de ser posterior a hora de inicio.', 400);
    }

    const [aulasNoEstudio, aulasDoProfessorNoDia, disponibilidadesProfessor] = await Promise.all([
        classRepo.findOverlapping(dados.IdEstudio, dados.Data),
        classRepo.findProfessorClassesByDate(dados.IdProfessor, dados.Data),
        classRepo.findProfessorAvailabilityByDate(dados.IdProfessor, dados.Data)
    ]);

    if (!intervaloCabeNaDisponibilidade(dados.HoraInicio, dados.HoraFim, disponibilidadesProfessor)) {
        throw criarErro('O professor nao tem disponibilidade registada para este horario.', 400);
    }

    const aulaSobrepostaNoEstudio = aulasNoEstudio.find((aulaExistente) => {
        const existenteInicio = toMinutes(aulaExistente.HoraInicio);
        const existenteFim = toMinutes(aulaExistente.HoraFim);
        return novaHoraInicio < existenteFim && novaHoraFim > existenteInicio;
    });

    if (aulaSobrepostaNoEstudio) {
        throw criarErro('Conflito de horario! Estudio ocupado.', 400);
    }

    const aulaSobrepostaDoProfessor = aulasDoProfessorNoDia.find((aulaExistente) => {
        const existenteInicio = toMinutes(aulaExistente.HoraInicio);
        const existenteFim = toMinutes(aulaExistente.HoraFim);
        return novaHoraInicio < existenteFim && novaHoraFim > existenteInicio;
    });

    if (aulaSobrepostaDoProfessor) {
        throw criarErro('Conflito de horario! Professor ocupado.', 400);
    }

    const novaAula = await classRepo.create({
        ...dados,
        TipoAula: tipoAula,
        OrigemAula: dados.OrigemAula || 'Direcao'
    });

    return {
        mensagem: 'Aula agendada!',
        aula: novaAula
    };
};

const criarAulasEmLote = async (dados = {}) => {
    const aulas = Array.isArray(dados.Aulas) ? dados.Aulas : [];

    if (aulas.length === 0) {
        throw criarErro('Envia pelo menos uma aula para criar.', 400);
    }

    const criadas = [];
    const erros = [];

    for (let index = 0; index < aulas.length; index += 1) {
        const aula = aulas[index];

        try {
            const resultado = await criarAula(aula);
            criadas.push(resultado.aula);
        } catch (erro) {
            erros.push({
                indice: index + 1,
                referencia: aula?.Referencia || `${aula?.Data || 'sem-data'} ${aula?.HoraInicio || ''}`.trim(),
                mensagem: erro.message || 'Nao foi possivel criar a aula.'
            });
        }
    }

    const totalCriadas = criadas.length;
    const totalFalhas = erros.length;

    let mensagem = `${totalCriadas} aula(s) criada(s) com sucesso.`;

    if (totalFalhas > 0 && totalCriadas > 0) {
        mensagem = `${totalCriadas} aula(s) criada(s) e ${totalFalhas} com erro.`;
    } else if (totalFalhas > 0) {
        mensagem = 'Nao foi possivel criar as aulas enviadas.';
    }

    return {
        mensagem,
        totalRecebidas: aulas.length,
        totalCriadas,
        totalFalhas,
        aulas: criadas,
        erros
    };
};

const ConfirmarPresenca = async (idAula) => {
    const aula = await classRepo.findByIdComAlunos(idAula);
    if (!aula) {
        throw criarErro('Aula nao encontrada.', 404);
    }

    if (aula.EstaAtivo === false) {
        throw criarErro('Nao e possivel confirmar uma aula cancelada.', 400);
    }

    if (!aulaTerminou(aula)) {
        throw criarErro('So e possivel confirmar a conclusao depois da aula terminar.', 400);
    }

    const marcacoesAtivas = aula.Marcacao || [];
    if (marcacoesAtivas.length === 0) {
        throw criarErro('Nao e possivel confirmar uma aula sem alunos inscritos.', 400);
    }

    return await classRepo.ValidarConclusaoAula(idAula, true);
};

const cancelarAula = async (idAula, utilizador) => {
    const aula = await classRepo.findById(idAula);
    if (!aula) {
        throw criarErro('Aula nao encontrada.', 404);
    }

    if (aula.EstaAtivo === false) {
        throw criarErro('A aula ja se encontra cancelada.', 400);
    }

    if (aulaTerminou(aula)) {
        throw criarErro('Nao e possivel cancelar uma aula que ja terminou.', 400);
    }

    if (utilizador?.Permissoes === PERMISSOES.PROFESSOR && aula.IdProfessor !== utilizador.IdUtilizador) {
        throw criarErro('Apenas o professor responsavel pode cancelar esta aula.', 403);
    }

    const aulaCancelada = await classRepo.cancelarAula(idAula);

    return {
        mensagem: 'Aula cancelada com sucesso.',
        aula: aulaCancelada
    };
};

const validarAula = async (idAula) => {
    const aula = await classRepo.findByIdComAlunos(idAula);
    if (!aula) {
        throw criarErro('Aula nao encontrada.', 404);
    }

    if (aula.EstaAtivo === false) {
        throw criarErro('Nao e possivel validar uma aula cancelada.', 400);
    }

    if (!aula.ConfirmacaoProfessor) {
        throw criarErro('A aula tem de ser confirmada pelo professor antes da validacao da Direcao.', 400);
    }

    const marcacoesAtivas = aula.Marcacao;
    if (marcacoesAtivas.length === 0) {
        throw criarErro('Nao e possivel validar uma aula sem alunos inscritos.', 400);
    }

    await classRepo.atualizarValidacaoDirecao(idAula);

    const paymentService = require('./paymentService');
    const resultadoPagamentos = await paymentService.GerarPagamento(marcacoesAtivas, aula.Preco);

    return {
        mensagem: `Aula validada e ${resultadoPagamentos.pagamentos.length} pagamentos gerados.`,
        aula,
        pagamentos: resultadoPagamentos.pagamentos
    };
};

module.exports = {
    ConsultarVagas,
    listarAulas: ConsultarVagas,
    criarAula,
    criarAulasEmLote,
    ConfirmarPresenca,
    confirmarPresencaProfessor: ConfirmarPresenca,
    cancelarAula,
    validarAula,
    validarAulaDirecao: validarAula
};
