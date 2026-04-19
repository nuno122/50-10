const bookingRepo = require('../repositories/bookingRepository');

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

// ─── Criar ────────────────────────────────────────────────────────────────────

const criarMarcacao = async (idAluno, idAula) => {
    if (!idAluno || !idAula) {
        throw criarErro('IdAluno e IdAula são obrigatórios.', 400);
    }

    const aluno = await bookingRepo.findAlunoById(idAluno);
    if (!aluno) throw criarErro('Aluno não encontrado.', 404);

    const aula = await bookingRepo.findAulaWithMarcacoes(idAula);
    if (!aula) throw criarErro('Aula não encontrada.', 404);

    if (!aula.EstaAtivo) throw criarErro('Esta aula foi cancelada.', 400);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (new Date(aula.Data) < hoje) {
        throw criarErro('Não podes marcar aulas passadas.', 400);
    }

    const inscritosAtivos = aula.Marcacao.filter(m => m.EstaAtivo).length;
    if (inscritosAtivos >= aula.CapacidadeMaxima) {
        throw criarErro('Aula lotada.', 400);
    }

    const jaInscrito = await bookingRepo.findExisting(idAluno, idAula);
    if (jaInscrito) throw criarErro('Já estás inscrito nesta aula.', 400);

    const novaMarcacao = await bookingRepo.create(idAluno, idAula);

    const prazoPagamento = new Date(aula.Data);
    prazoPagamento.setDate(prazoPagamento.getDate() - 2);

    await bookingRepo.criarPagamento(novaMarcacao.IdMarcacao, aula.Preco, prazoPagamento);

    return {
        mensagem: 'Lugar reservado!',
        marcacao: novaMarcacao
    };
};

// ─── Cancelar (Unificado com regra de 24h) ────────────────────────────────────

const cancelarMarcacao = async (idMarcacao, idAluno, motivo) => {
    if (!idMarcacao || !idAluno) {
        throw criarErro('IdMarcacao e IdAluno são obrigatórios.', 400);
    }

    // Busca com Aula incluída para verificar o horário
    const marcacao = await bookingRepo.findByIdComAula(idMarcacao);
    
    if (!marcacao) throw criarErro('Marcação não encontrada.', 404);
    if (marcacao.IdAluno !== idAluno) throw criarErro('Não tens permissão para cancelar esta marcação.', 403);
    if (!marcacao.EstaAtivo) throw criarErro('Esta marcação já está cancelada.', 400);

    // Lógica das 24 horas
    const agora = new Date();
    const dataAulaCompleta = new Date(marcacao.Aula.Data);
    
    // Ajusta a hora da aula (assumindo que HoraInicio é um objeto Date ou similar)
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
        // Pendente aprovação da direção devido ao prazo curto
        await bookingRepo.cancelar(idMarcacao, 'Pendente_Cancelamento');
        return { 
            sucesso: false, 
            mensagem: 'Prazo de 24h expirou. O pedido foi enviado para aprovação da Direção.' 
        };
    }
};

// ─── Listar ───────────────────────────────────────────────────────────────────

const listarMarcacoes = async () => {
    return await bookingRepo.findAll();
};

const listarMarcacoesDoAluno = async (idAluno) => {
    if (!idAluno) throw criarErro('IdAluno é obrigatório.', 400);
    return await bookingRepo.findByAluno(idAluno);
};

module.exports = {
    criarMarcacao,
    cancelarMarcacao,
    listarMarcacoes,
    listarMarcacoesDoAluno
};