const PERMISSOES = require('../config/permissions');
const eventRepo = require('../repositories/eventRepository');
const notificationService = require('./notificationService');
const userRepository = require('../repositories/userRepository');

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

const normalizeRequiredText = (value) => String(value || '').trim();
const normalizeOptionalText = (value) => String(value || '').trim();

const buildDateTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date;
};

const buildDateOnly = (value) => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
        const [, year, month, day] = match;
        return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0));
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    date.setUTCHours(0, 0, 0, 0);
    return date;
};

const validarEvento = (dados) => {
    const Titulo = normalizeRequiredText(dados?.Titulo);
    const Descricao = normalizeRequiredText(dados?.Descricao);
    const DataPublicacaoInicio = buildDateTime(dados?.DataPublicacaoInicio);
    const DataPublicacaoFim = buildDateTime(dados?.DataPublicacaoFim);
    const DataEvento = buildDateOnly(dados?.DataEvento);
    const Local = normalizeOptionalText(dados?.Local);
    const TipoEvento = normalizeOptionalText(dados?.TipoEvento) || 'Geral';
    const Link = normalizeOptionalText(dados?.Link);

    if (!Titulo || !Descricao || !DataPublicacaoInicio || !DataPublicacaoFim || !DataEvento) {
        throw criarErro('Titulo, Descricao, DataPublicacaoInicio, DataPublicacaoFim e DataEvento sao obrigatorios.', 400);
    }

    if (DataPublicacaoFim < DataPublicacaoInicio) {
        throw criarErro('A data de fim de publicacao nao pode ser anterior ao inicio de publicacao.', 400);
    }

    if (DataEvento < buildDateOnly(DataPublicacaoInicio)) {
        throw criarErro('A data do evento nao pode ser anterior ao inicio da publicacao.', 400);
    }

    return {
        Titulo,
        Descricao,
        DataPublicacaoInicio,
        DataPublicacaoFim,
        DataEvento,
        Local,
        TipoEvento,
        Link,
        EstadoEvento: true
    };
};

const criarEvento = async (dados, utilizador) => {
    if (!utilizador?.IdUtilizador) {
        throw criarErro('Utilizador autenticado inválido.', 401);
    }

    if (utilizador.Permissoes !== PERMISSOES.DIRECAO) {
        throw criarErro('Apenas a Direção pode criar eventos.', 403);
    }

    const payload = validarEvento(dados);

    const evento = await eventRepo.create({
        ...payload,
        IdUtilizadorCriador: utilizador.IdUtilizador
    });

    try {
        const agora = new Date();

        if (payload.DataPublicacaoInicio <= agora && payload.DataPublicacaoFim >= agora) {
            const destinatarios = await userRepository.findIdsByPermissions([
                PERMISSOES.PROFESSOR,
                PERMISSOES.ENCARREGADO
            ]);

            if (destinatarios.length > 0) {
                await notificationService.createEventPublishedForUsers(destinatarios, evento);
            }
        }
    } catch (erroNotificacao) {
        console.error('Erro ao enviar notificacoes de evento:', erroNotificacao);
    }

    return evento;
};

const editarEvento = async (idEvento, dados, utilizador) => {
    if (!idEvento || !utilizador?.IdUtilizador) {
        throw criarErro('IdEvento e utilizador autenticado são obrigatórios.', 400);
    }

    if (utilizador.Permissoes !== PERMISSOES.DIRECAO) {
        throw criarErro('Apenas a Direção pode editar eventos.', 403);
    }

    const evento = await eventRepo.findById(idEvento);
    if (!evento) {
        throw criarErro('Evento nao encontrado.', 404);
    }

    const payload = validarEvento(dados);

    return await eventRepo.update(idEvento, payload);
};

const listarEventos = async (utilizador) => {
    if (!utilizador?.Permissoes) {
        throw criarErro('Utilizador autenticado inválido.', 401);
    }

    if (utilizador.Permissoes === PERMISSOES.DIRECAO) {
        return await eventRepo.findAll();
    }

    return await eventRepo.findPublished(new Date());
};

const removerEvento = async (idEvento, utilizador) => {
    if (!idEvento || !utilizador?.IdUtilizador) {
        throw criarErro('IdEvento e utilizador autenticado são obrigatórios.', 400);
    }

    if (utilizador.Permissoes !== PERMISSOES.DIRECAO) {
        throw criarErro('Apenas a Direção pode remover eventos.', 403);
    }

    const evento = await eventRepo.findById(idEvento);
    if (!evento) {
        throw criarErro('Evento nao encontrado.', 404);
    }

    await eventRepo.delete(idEvento);

    return {
        mensagem: 'Evento removido com sucesso.'
    };
};

const adicionarComentario = async (idEvento, comentario, utilizador) => {
    if (!idEvento || !utilizador?.IdUtilizador) {
        throw criarErro('IdEvento e utilizador autenticado são obrigatórios.', 400);
    }

    if (utilizador.Permissoes !== PERMISSOES.PROFESSOR) {
        throw criarErro('Apenas professores podem comentar eventos.', 403);
    }

    const Comentario = normalizeRequiredText(comentario);
    if (!Comentario) {
        throw criarErro('O comentario do professor e obrigatorio.', 400);
    }

    const evento = await eventRepo.findById(idEvento);
    if (!evento) {
        throw criarErro('Evento nao encontrado.', 404);
    }

    const agora = new Date();
    if (!evento.EstadoEvento) {
        throw criarErro('Não é possível comentar um evento inativo.', 400);
    }

    if (evento.DataPublicacaoInicio && new Date(evento.DataPublicacaoInicio) > agora) {
        throw criarErro('Não é possível comentar um evento antes do início da publicação.', 400);
    }

    if (evento.DataPublicacaoFim && new Date(evento.DataPublicacaoFim) < agora) {
        throw criarErro('Não é possível comentar um evento cuja publicação já terminou.', 400);
    }

    const comentarioCriado = await eventRepo.createComment({
        IdEvento: idEvento,
        IdProfessor: utilizador.IdUtilizador,
        Comentario
    });

    return {
        mensagem: 'Comentario adicionado com sucesso.',
        comentario: comentarioCriado
    };
};

const editarComentario = async (idEventoComentario, comentario, utilizador) => {
    if (!idEventoComentario || !utilizador?.IdUtilizador) {
        throw criarErro('IdEventoComentario e utilizador autenticado são obrigatórios.', 400);
    }

    if (utilizador.Permissoes !== PERMISSOES.PROFESSOR) {
        throw criarErro('Apenas professores podem editar comentarios de eventos.', 403);
    }

    const Comentario = normalizeRequiredText(comentario);
    if (!Comentario) {
        throw criarErro('O comentario do professor e obrigatorio.', 400);
    }

    const comentarioAtual = await eventRepo.findCommentById(idEventoComentario);
    if (!comentarioAtual) {
        throw criarErro('Comentario nao encontrado.', 404);
    }

    if (comentarioAtual.IdProfessor !== utilizador.IdUtilizador) {
        throw criarErro('So pode editar comentarios da sua autoria.', 403);
    }

    const comentarioAtualizado = await eventRepo.updateComment(idEventoComentario, {
        Comentario,
        DataComentario: new Date()
    });

    return {
        mensagem: 'Comentario atualizado com sucesso.',
        comentario: comentarioAtualizado
    };
};

module.exports = {
    criarEvento,
    editarEvento,
    listarEventos,
    removerEvento,
    adicionarComentario,
    editarComentario
};
