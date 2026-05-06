const bookingService = require('./bookingService');
const classRepo = require('../repositories/classRepository');
const classService = require('./classService');
const privateLessonRequestRepo = require('../repositories/privateLessonRequestRepository');

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
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    date.setHours(0, 0, 0, 0);
    return date;
};

const construirDataHora = (dataValue, horaValue) => {
    const data = construirData(dataValue);
    if (!data) return null;

    const { hours, minutes } = extrairHorasEMinutos(horaValue);
    data.setHours(hours, minutes, 0, 0);
    return data;
};

const construirFim = (inicio, duracaoMinutos) => {
    const fim = new Date(inicio);
    fim.setMinutes(fim.getMinutes() + Number(duracaoMinutos || 0));
    return fim;
};

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
        throw criarErro('A capacidade da aula particular tem de estar entre 1 e 4 participantes.', 400);
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

const criarPedido = async (dados, idEncarregado) => {
    if (!idEncarregado) {
        throw criarErro('IdEncarregado e obrigatorio.', 400);
    }

    const {
        IdAluno,
        IdEstiloDanca,
        DataPretendida,
        HoraPretendida,
        DuracaoMinutos,
        CapacidadePretendida,
        Observacoes
    } = dados || {};

    if (!IdAluno || !IdEstiloDanca || !DataPretendida || !HoraPretendida) {
        throw criarErro('IdAluno, IdEstiloDanca, DataPretendida e HoraPretendida sao obrigatorios.', 400);
    }

    await garantirAlunoDoEncarregado(idEncarregado, IdAluno);

    const estilo = await classRepo.findEstiloById(IdEstiloDanca);
    if (!estilo) {
        throw criarErro('O estilo de danca selecionado nao existe.', 400);
    }

    const duracao = validarDuracao(DuracaoMinutos);
    const capacidade = validarCapacidade(CapacidadePretendida);

    const dataHoraPretendida = construirDataHora(DataPretendida, HoraPretendida);
    if (!dataHoraPretendida) {
        throw criarErro('A data ou hora pretendida e invalida.', 400);
    }

    if (dataHoraPretendida <= new Date()) {
        throw criarErro('O pedido tem de ser para um horario futuro.', 400);
    }

    return await privateLessonRequestRepo.create({
        IdEncarregado: idEncarregado,
        IdAluno,
        IdEstiloDanca,
        DataPretendida: construirData(DataPretendida),
        HoraPretendida: dataHoraPretendida,
        DuracaoMinutos: duracao,
        CapacidadePretendida: capacidade,
        Observacoes: Observacoes ? String(Observacoes).trim() : null,
        EstadoPedido: 'Pendente'
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

const aprovarPedido = async (idPedidoAulaPrivada, dados, idDiretor) => {
    if (!idPedidoAulaPrivada || !idDiretor) {
        throw criarErro('IdPedidoAulaPrivada e IdDiretor sao obrigatorios.', 400);
    }

    const pedido = await privateLessonRequestRepo.findById(idPedidoAulaPrivada);
    if (!pedido) {
        throw criarErro('Pedido de aula privada nao encontrado.', 404);
    }

    if (pedido.EstadoPedido !== 'Pendente') {
        throw criarErro('Apenas pedidos pendentes podem ser aprovados.', 400);
    }

    const IdProfessor = dados?.IdProfessor;
    const IdEstudio = dados?.IdEstudio;
    const preco = Number(dados?.Preco);
    const dataPretendida = dados?.DataPretendida || pedido.DataPretendida;
    const horaPretendida = dados?.HoraPretendida || pedido.HoraPretendida;
    const duracao = dados?.DuracaoMinutos ? validarDuracao(dados.DuracaoMinutos) : pedido.DuracaoMinutos;
    const capacidade = dados?.CapacidadeMaxima ? validarCapacidade(dados.CapacidadeMaxima) : pedido.CapacidadePretendida;

    if (!IdProfessor || !IdEstudio) {
        throw criarErro('IdProfessor e IdEstudio sao obrigatorios para aprovar o pedido.', 400);
    }

    if (!Number.isFinite(preco) || preco < 0) {
        throw criarErro('Preco invalido.', 400);
    }

    const inicio = construirDataHora(dataPretendida, horaPretendida);
    if (!inicio) {
        throw criarErro('Data ou hora da aula aprovada invalida.', 400);
    }

    if (inicio <= new Date()) {
        throw criarErro('A aula aprovada tem de ficar num horario futuro.', 400);
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
        EstadoPedido: 'Aprovado',
        ObservacaoDirecao: dados?.ObservacaoDirecao ? String(dados.ObservacaoDirecao).trim() : null,
        DataDecisao: new Date(),
        IdDiretorDecisao: idDiretor,
        IdAulaCriada: resultadoAula.aula.IdAula
    });

    return {
        mensagem: 'Pedido aprovado com sucesso e convertido em aula particular.',
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
        throw criarErro('Pedido de aula privada nao encontrado.', 404);
    }

    if (pedido.EstadoPedido !== 'Pendente') {
        throw criarErro('Apenas pedidos pendentes podem ser rejeitados.', 400);
    }

    const pedidoAtualizado = await privateLessonRequestRepo.update(idPedidoAulaPrivada, {
        EstadoPedido: 'Rejeitado',
        ObservacaoDirecao: observacaoDirecao ? String(observacaoDirecao).trim() : null,
        DataDecisao: new Date(),
        IdDiretorDecisao: idDiretor
    });

    return {
        mensagem: 'Pedido de aula privada rejeitado.',
        pedido: pedidoAtualizado
    };
};

module.exports = {
    criarPedido,
    listarPedidos,
    listarPedidosDoEncarregado,
    aprovarPedido,
    rejeitarPedido
};
