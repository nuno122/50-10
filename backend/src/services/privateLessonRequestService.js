const bookingService = require('./bookingService');
const classRepo = require('../repositories/classRepository');
const classService = require('./classService');
const privateLessonRequestRepo = require('../repositories/privateLessonRequestRepository');

const ESTADOS_PEDIDO = {
    PENDENTE_PROFESSOR: 'PendenteProfessor',
    PENDENTE_DIRECAO: 'PendenteDirecao',
    APROVADO: 'Aprovado',
    REJEITADO_PROFESSOR: 'RejeitadoProfessor',
    REJEITADO_DIRECAO: 'RejeitadoDirecao'
};

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

const extrairHorasEMinutos = (value) => {
    const text = String(value || '');
    const match = text.match(/(\d{2}):(\d{2})/);
    if (!match) {
        return { hours: 0, minutes: 0 };
    }

    return {
        hours: Number(match[1]),
        minutes: Number(match[2])
    };
};

const construirData = (value) => {
    const dateOnlyMatch = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
        const [, year, month, day] = dateOnlyMatch;
        return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0));
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    date.setUTCHours(0, 0, 0, 0);
    return date;
};

const construirDataHora = (dataValue, horaValue) => {
    const data = construirData(dataValue);
    if (!data) return null;

    const { hours, minutes } = extrairHorasEMinutos(horaValue);
    data.setUTCHours(hours, minutes, 0, 0);
    return data;
};

const construirFim = (inicio, duracaoMinutos) => {
    const fim = new Date(inicio);
    fim.setMinutes(fim.getMinutes() + Number(duracaoMinutos || 0));
    return fim;
};

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

const horariosSobrepostos = (inicioA, fimA, inicioB, fimB) => {
    const aInicio = toMinutes(inicioA);
    const aFim = toMinutes(fimA);
    const bInicio = toMinutes(inicioB);
    const bFim = toMinutes(fimB);

    if (![aInicio, aFim, bInicio, bFim].every(Number.isFinite)) {
        return false;
    }

    return aInicio < bFim && aFim > bInicio;
};

const intervaloCabeNaDisponibilidade = (horaInicio, horaFim, disponibilidades = []) => (
    disponibilidades.some((disponibilidade) => {
        const inicioDisponivel = toMinutes(disponibilidade.HoraInicio);
        const fimDisponivel = toMinutes(disponibilidade.HoraFim);
        const inicio = toMinutes(horaInicio);
        const fim = toMinutes(horaFim);

        if (![inicioDisponivel, fimDisponivel, inicio, fim].every(Number.isFinite)) {
            return false;
        }

        return inicio >= inicioDisponivel && fim <= fimDisponivel;
    })
);

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const relationMatchesStyle = (relation, estilo) => (
    relation.IdEstiloDanca === estilo?.IdEstiloDanca ||
    (
        Boolean(normalizeText(relation.EstiloDanca?.Nome)) &&
        Boolean(normalizeText(estilo?.Nome)) &&
        normalizeText(relation.EstiloDanca?.Nome) === normalizeText(estilo?.Nome)
    )
);

const professorSuportaEstilo = (professor, estilo) => (
    Array.isArray(professor?.EstiloProfessor) &&
    professor.EstiloProfessor.some((item) => relationMatchesStyle(item, estilo))
);

const garantirAlunoDoEncarregado = async (idEncarregado, idAluno) => {
    const alunos = await bookingService.listarAlunosDoEncarregado(idEncarregado);
    const aluno = alunos.find((item) => item.IdAluno === idAluno);

    if (!aluno) {
        throw criarErro('O aluno selecionado nao esta associado a este encarregado.', 403);
    }

    return aluno;
};

const validarCapacidade = (capacidade) => {
    const valor = Number(capacidade || 1);
    if (!Number.isInteger(valor) || valor < 1 || valor > 4) {
        throw criarErro('A capacidade do Coaching tem de estar entre 1 e 4 participantes.', 400);
    }
    return valor;
};

const validarDuracao = (duracao) => {
    const valor = Number(duracao || 0);
    if (!Number.isInteger(valor) || valor < 30 || valor > 240) {
        throw criarErro('A duracao tem de estar entre 30 e 240 minutos.', 400);
    }
    return valor;
};

const validarProfessorDoPedido = async (idProfessor, estilo) => {
    const professor = await classRepo.findProfessorById(idProfessor);
    if (!professor) {
        throw criarErro('O professor selecionado nao existe.', 400);
    }

    if (!professorSuportaEstilo(professor, estilo)) {
        throw criarErro('O professor selecionado nao esta associado ao estilo escolhido.', 400);
    }

    return professor;
};

const validarDisponibilidadeProfessor = async (pedido, idProfessor) => {
    const inicio = construirDataHora(pedido.DataPretendida, pedido.HoraPretendida);
    if (!inicio) {
        throw criarErro('A data ou hora pretendida é inválida.', 400);
    }

    if (inicio <= new Date()) {
        throw criarErro('Não é possível confirmar um pedido para um horário passado.', 400);
    }

    const fim = construirFim(inicio, pedido.DuracaoMinutos);

    const [aulasDoProfessor, disponibilidades, pedidosConfirmados] = await Promise.all([
        classRepo.findProfessorClassesByDate(idProfessor, pedido.DataPretendida),
        classRepo.findProfessorAvailabilityByDate(idProfessor, pedido.DataPretendida),
        privateLessonRequestRepo.findProfessorPendingApprovalByDate(
            idProfessor,
            construirData(pedido.DataPretendida),
            pedido.IdPedidoAulaPrivada
        )
    ]);

    if (!intervaloCabeNaDisponibilidade(inicio, fim, disponibilidades)) {
        throw criarErro('O professor não tem disponibilidade registada para este horário.', 400);
    }

    const aulaSobreposta = aulasDoProfessor.find((aula) => (
        horariosSobrepostos(inicio, fim, aula.HoraInicio, aula.HoraFim)
    ));

    if (aulaSobreposta) {
        throw criarErro('O professor já tem uma aula marcada neste horário.', 400);
    }

    const pedidoSobreposto = pedidosConfirmados.find((pedidoConfirmado) => {
        const inicioPedido = construirDataHora(pedidoConfirmado.DataPretendida, pedidoConfirmado.HoraPretendida);
        const fimPedido = construirFim(inicioPedido, pedidoConfirmado.DuracaoMinutos);
        return horariosSobrepostos(inicio, fim, inicioPedido, fimPedido);
    });

    if (pedidoSobreposto) {
        throw criarErro('O professor já confirmou outro pedido de Coaching neste horário.', 400);
    }

    return { inicio, fim };
};

const criarPedido = async (dados, idEncarregado) => {
    if (!idEncarregado) {
        throw criarErro('IdEncarregado e obrigatorio.', 400);
    }

    const {
        IdAluno,
        IdEstiloDanca,
        IdProfessorSolicitado,
        DataPretendida,
        HoraPretendida,
        DuracaoMinutos,
        CapacidadePretendida,
        Observacoes
    } = dados || {};

    if (!IdAluno || !IdEstiloDanca || !IdProfessorSolicitado || !DataPretendida || !HoraPretendida) {
        throw criarErro('IdAluno, IdEstiloDanca, IdProfessorSolicitado, DataPretendida e HoraPretendida sao obrigatorios.', 400);
    }

    await garantirAlunoDoEncarregado(idEncarregado, IdAluno);

    const estilo = await classRepo.findEstiloById(IdEstiloDanca);
    if (!estilo) {
        throw criarErro('O estilo de danca selecionado nao existe.', 400);
    }

    await validarProfessorDoPedido(IdProfessorSolicitado, estilo);

    const duracao = validarDuracao(DuracaoMinutos);
    const capacidade = validarCapacidade(CapacidadePretendida);

    const dataHoraPretendida = construirDataHora(DataPretendida, HoraPretendida);
    if (!dataHoraPretendida) {
        throw criarErro('A data ou hora pretendida é inválida.', 400);
    }

    if (dataHoraPretendida <= new Date()) {
        throw criarErro('O pedido tem de ser para um horário futuro.', 400);
    }

    await validarDisponibilidadeProfessor({
        DataPretendida: construirData(DataPretendida),
        HoraPretendida: dataHoraPretendida,
        DuracaoMinutos: duracao
    }, IdProfessorSolicitado);

    return await privateLessonRequestRepo.create({
        IdEncarregado: idEncarregado,
        IdAluno,
        IdEstiloDanca,
        IdProfessorSolicitado,
        DataPretendida: construirData(DataPretendida),
        HoraPretendida: dataHoraPretendida,
        DuracaoMinutos: duracao,
        CapacidadePretendida: capacidade,
        Observacoes: Observacoes ? String(Observacoes).trim() : null,
        EstadoPedido: ESTADOS_PEDIDO.PENDENTE_PROFESSOR
    });
};

const listarPedidos = async () => {
    return await privateLessonRequestRepo.findAll();
};

const listarPedidosDoEncarregado = async (idEncarregado) => {
    if (!idEncarregado) {
        throw criarErro('IdEncarregado e obrigatorio.', 400);
    }

    return await privateLessonRequestRepo.findByGuardian(idEncarregado);
};

const listarPedidosDoProfessor = async (idProfessor) => {
    if (!idProfessor) {
        throw criarErro('IdProfessor e obrigatorio.', 400);
    }

    return await privateLessonRequestRepo.findByTeacher(idProfessor);
};

const confirmarPedidoProfessor = async (idPedidoAulaPrivada, dados, idProfessor) => {
    if (!idPedidoAulaPrivada || !idProfessor) {
        throw criarErro('IdPedidoAulaPrivada e IdProfessor sao obrigatorios.', 400);
    }

    const pedido = await privateLessonRequestRepo.findById(idPedidoAulaPrivada);
    if (!pedido) {
        throw criarErro('Pedido de Coaching nao encontrado.', 404);
    }

    if (pedido.IdProfessorSolicitado !== idProfessor) {
        throw criarErro('Apenas o professor solicitado pode confirmar este pedido.', 403);
    }

    if (pedido.EstadoPedido !== ESTADOS_PEDIDO.PENDENTE_PROFESSOR) {
        throw criarErro('Apenas pedidos pendentes do professor podem ser confirmados.', 400);
    }

    await validarProfessorDoPedido(idProfessor, pedido.EstiloDanca);
    await validarDisponibilidadeProfessor(pedido, idProfessor);

    const pedidoAtualizado = await privateLessonRequestRepo.update(idPedidoAulaPrivada, {
        EstadoPedido: ESTADOS_PEDIDO.PENDENTE_DIRECAO,
        IdProfessorConfirmado: idProfessor,
        ObservacaoProfessor: dados?.ObservacaoProfessor ? String(dados.ObservacaoProfessor).trim() : null,
        DataRespostaProfessor: new Date()
    });

    return {
        mensagem: 'Disponibilidade confirmada pelo professor. O pedido segue para validação da Direção.',
        pedido: pedidoAtualizado
    };
};

const rejeitarPedidoProfessor = async (idPedidoAulaPrivada, observacaoProfessor, idProfessor) => {
    if (!idPedidoAulaPrivada || !idProfessor) {
        throw criarErro('IdPedidoAulaPrivada e IdProfessor sao obrigatorios.', 400);
    }

    const pedido = await privateLessonRequestRepo.findById(idPedidoAulaPrivada);
    if (!pedido) {
        throw criarErro('Pedido de Coaching nao encontrado.', 404);
    }

    if (pedido.IdProfessorSolicitado !== idProfessor) {
        throw criarErro('Apenas o professor solicitado pode rejeitar este pedido.', 403);
    }

    if (pedido.EstadoPedido !== ESTADOS_PEDIDO.PENDENTE_PROFESSOR) {
        throw criarErro('Apenas pedidos pendentes do professor podem ser rejeitados pelo professor.', 400);
    }

    const pedidoAtualizado = await privateLessonRequestRepo.update(idPedidoAulaPrivada, {
        EstadoPedido: ESTADOS_PEDIDO.REJEITADO_PROFESSOR,
        ObservacaoProfessor: observacaoProfessor ? String(observacaoProfessor).trim() : null,
        DataRespostaProfessor: new Date()
    });

    return {
        mensagem: 'Pedido rejeitado pelo professor.',
        pedido: pedidoAtualizado
    };
};

const aprovarPedido = async (idPedidoAulaPrivada, dados, idDiretor) => {
    if (!idPedidoAulaPrivada || !idDiretor) {
        throw criarErro('IdPedidoAulaPrivada e IdDiretor sao obrigatorios.', 400);
    }

    const pedido = await privateLessonRequestRepo.findById(idPedidoAulaPrivada);
    if (!pedido) {
        throw criarErro('Pedido de Coaching nao encontrado.', 404);
    }

    if (pedido.EstadoPedido !== ESTADOS_PEDIDO.PENDENTE_DIRECAO) {
        throw criarErro('Apenas pedidos confirmados pelo professor podem ser aprovados pela Direção.', 400);
    }

    const IdProfessor = pedido.IdProfessorConfirmado;
    const IdEstudio = dados?.IdEstudio;
    const preco = Number(dados?.Preco);
    const dataPretendida = pedido.DataPretendida;
    const horaPretendida = pedido.HoraPretendida;
    const duracao = pedido.DuracaoMinutos;
    const capacidade = dados?.CapacidadeMaxima ? validarCapacidade(dados.CapacidadeMaxima) : pedido.CapacidadePretendida;

    if (!IdProfessor || !IdEstudio) {
        throw criarErro('O pedido precisa de professor confirmado e IdEstudio para ser aprovado.', 400);
    }

    if (!Number.isFinite(preco) || preco < 0) {
        throw criarErro('Preço inválido.', 400);
    }

    const inicio = construirDataHora(dataPretendida, horaPretendida);
    if (!inicio) {
        throw criarErro('Data ou hora da aula aprovada inválida.', 400);
    }

    if (inicio <= new Date()) {
        throw criarErro('A aula aprovada tem de ficar num horário futuro.', 400);
    }

    const fim = construirFim(inicio, duracao);

    const payloadAula = {
        Data: construirData(dataPretendida),
        HoraInicio: inicio,
        HoraFim: fim,
        CapacidadeMaxima: capacidade,
        Preco: preco,
        TipoAula: 'Particular',
        OrigemAula: 'PedidoEncarregado',
        IdProfessor,
        IdEstudio,
        IdEstiloDanca: pedido.IdEstiloDanca
    };

    const resultadoAula = await classService.criarAula(payloadAula);

    let resultadoMarcacao;

    try {
        resultadoMarcacao = await bookingService.FazerMarcacao(resultadoAula.aula.IdAula, pedido.IdAluno);
    } catch (erro) {
        await classRepo.cancelarAula(resultadoAula.aula.IdAula);
        throw erro;
    }

    const pedidoAtualizado = await privateLessonRequestRepo.update(idPedidoAulaPrivada, {
        EstadoPedido: ESTADOS_PEDIDO.APROVADO,
        ObservacaoDirecao: dados?.ObservacaoDirecao ? String(dados.ObservacaoDirecao).trim() : null,
        DataDecisao: new Date(),
        IdDiretorDecisao: idDiretor,
        IdAulaCriada: resultadoAula.aula.IdAula
    });

    return {
        mensagem: 'Pedido aprovado com sucesso e convertido em sessao de Coaching.',
        pedido: pedidoAtualizado,
        aula: resultadoAula.aula,
        marcacao: resultadoMarcacao.marcacao
    };
};

const rejeitarPedido = async (idPedidoAulaPrivada, observacaoDirecao, idDiretor) => {
    if (!idPedidoAulaPrivada || !idDiretor) {
        throw criarErro('IdPedidoAulaPrivada e IdDiretor sao obrigatorios.', 400);
    }

    const pedido = await privateLessonRequestRepo.findById(idPedidoAulaPrivada);
    if (!pedido) {
        throw criarErro('Pedido de Coaching nao encontrado.', 404);
    }

    if (![ESTADOS_PEDIDO.PENDENTE_PROFESSOR, ESTADOS_PEDIDO.PENDENTE_DIRECAO].includes(pedido.EstadoPedido)) {
        throw criarErro('Apenas pedidos pendentes podem ser rejeitados.', 400);
    }

    const pedidoAtualizado = await privateLessonRequestRepo.update(idPedidoAulaPrivada, {
        EstadoPedido: ESTADOS_PEDIDO.REJEITADO_DIRECAO,
        ObservacaoDirecao: observacaoDirecao ? String(observacaoDirecao).trim() : null,
        DataDecisao: new Date(),
        IdDiretorDecisao: idDiretor
    });

    return {
        mensagem: 'Pedido de Coaching rejeitado.',
        pedido: pedidoAtualizado
    };
};

module.exports = {
    criarPedido,
    listarPedidos,
    listarPedidosDoEncarregado,
    listarPedidosDoProfessor,
    confirmarPedidoProfessor,
    rejeitarPedidoProfessor,
    aprovarPedido,
    rejeitarPedido
};
