const bookingRepo = require('../repositories/bookingRepository');

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

// ─── Criar ───────────────────────────────────────────────────────────────────

const criarMarcacao = async (idAluno, idAula) => {
    if (!idAluno || !idAula) {
        throw criarErro('IdAluno e IdAula sao obrigatorios.', 400);
    }

    const aluno = await bookingRepo.findAlunoById(idAluno);
    if (!aluno) throw criarErro('Aluno nao encontrado.', 404);

    const aula = await bookingRepo.findAulaWithMarcacoes(idAula);
    if (!aula) throw criarErro('Aula nao encontrada.', 404);

    if (!aula.EstaAtivo) throw criarErro('Esta aula foi cancelada.', 400);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (new Date(aula.Data) < hoje) {
        throw criarErro('Nao podes marcar aulas passadas.', 400);
    }

    const inscritosAtivos = aula.Marcacao.filter(m => m.EstaAtivo).length;
    if (inscritosAtivos >= aula.CapacidadeMaxima) {
        throw criarErro('Aula lotada.', 400);
    }

    const jaInscrito = await bookingRepo.findExisting(idAluno, idAula);
    if (jaInscrito) throw criarErro('Ja estas inscrito nesta aula.', 400);

    const novaMarcacao = await bookingRepo.create(idAluno, idAula);

    const prazoPagamento = new Date(aula.Data);
    prazoPagamento.setDate(prazoPagamento.getDate() - 2);

    await bookingRepo.criarPagamento(novaMarcacao.IdMarcacao, aula.Preco, prazoPagamento);

    return {
        mensagem: 'Lugar reservado!',
        marcacao: novaMarcacao
    };
};

// ─── Cancelar (Unificado com regra de 24h) ───────────────────────────────────

const cancelarMarcacao = async (idMarcacao, idAluno, motivo) => {
    if (!idMarcacao || !idAluno) {
        throw criarErro('IdMarcacao e IdAluno sao obrigatorios.', 400);
    }

    // Busca com Aula incluida para verificar o horario
    const marcacao = await bookingRepo.findByIdComAula(idMarcacao);

    if (!marcacao) throw criarErro('Marcacao nao encontrada.', 404);
    if (marcacao.IdAluno !== idAluno) throw criarErro('Nao tens permissao para cancelar esta marcacao.', 403);
    if (!marcacao.EstaAtivo) throw criarErro('Esta marcacao ja esta cancelada.', 400);

    // Logica das 24 horas
    const agora = new Date();
    const dataAulaCompleta = new Date(marcacao.Aula.Data);

    dataAulaCompleta.setHours(
        marcacao.Aula.HoraInicio.getHours(),
        marcacao.Aula.HoraInicio.getMinutes(),
        0, 0
    );

    const diferencaMs = dataAulaCompleta - agora;
    const diferencaHoras = diferencaMs / (1000 * 60 * 60);

    if (diferencaHoras >= 24) {
        // Aprovado automaticamente
        await bookingRepo.cancelar(idMarcacao, motivo || 'Cancelamento antecipado (>= 24h)');
        return { sucesso: true, mensagem: 'Cancelamento aprovado automaticamente.' };
    } else {
        // Pendente aprovacao da direcao devido ao prazo curto
        await bookingRepo.RegistarPedidoCancelamento(idMarcacao, false);
        return {
            sucesso: false,
            mensagem: 'Prazo de 24h expirou. O pedido foi enviado para aprovacao da Direcao.'
        };
    }
};

// ─── Listar ──────────────────────────────────────────────────────────────────

const listarMarcacoes = async () => {
    return await bookingRepo.findAll();
};

const listarMarcacoesDoAluno = async (idAluno) => {
    if (!idAluno) throw criarErro('IdAluno e obrigatorio.', 400);
    return await bookingRepo.findByAluno(idAluno);
};

module.exports = {
    criarMarcacao,
    cancelarMarcacao,
    listarMarcacoes,
    listarMarcacoesDoAluno
};