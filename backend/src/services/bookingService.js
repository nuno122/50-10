const bookingRepo = require('../repositories/bookingRepository');

const criarMarcacao = async (idAluno, idAula) => {
    if (!idAluno || !idAula) {
        const erro = new Error('IdAluno e IdAula sao obrigatorios.');
        erro.statusCode = 400;
        throw erro;
    }

    const aluno = await bookingRepo.findAlunoById(idAluno);
    if (!aluno) {
        const erro = new Error('Aluno nao encontrado.');
        erro.statusCode = 404;
        throw erro;
    }

    const aula = await bookingRepo.findAulaWithMarcacoes(idAula);
    if (!aula) {
        const erro = new Error('Aula nao encontrada.');
        erro.statusCode = 404;
        throw erro;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (new Date(aula.Data) < hoje) {
        const erro = new Error('Nao podes marcar aulas passadas.');
        erro.statusCode = 400;
        throw erro;
    }

    if (aula.Marcacao.length >= aula.CapacidadeMaxima) {
        const erro = new Error('Aula lotada.');
        erro.statusCode = 400;
        throw erro;
    }

    const jaInscrito = await bookingRepo.findExisting(idAluno, idAula);
    if (jaInscrito) {
        const erro = new Error('Ja estas inscrito nesta aula.');
        erro.statusCode = 400;
        throw erro;
    }

    const novaMarcacao = await bookingRepo.create(idAluno, idAula);

    return {
        mensagem: 'Lugar reservado!',
        marcacao: novaMarcacao
    };
};

const listarMarcacoes = async () => {
    return await bookingRepo.findAll();
};

// NOVA: Processar cancelamento com regras 24h
const processarCancelamento = async (idMarcacao) => {
    const marcacao = await bookingRepo.findByIdComAula(idMarcacao);
    if (!marcacao) {
        const erro = new Error('Marcação não encontrada.');
        erro.statusCode = 404;
        throw erro;
    }

    const agora = new Date();
    const dataAulaCompleta = new Date(marcacao.Aula.Data);
    dataAulaCompleta.setHours(
        marcacao.Aula.HoraInicio.getHours(),
        marcacao.Aula.HoraInicio.getMinutes(),
        0, 0
    );
    const diferencaMs = dataAulaCompleta - agora;
    const diferencaHoras = diferencaMs / (1000 * 60 * 60);

    console.log('Debug cancel:', { agora: agora.toISOString(), dataAulaCompleta: dataAulaCompleta.toISOString(), diferencaHoras });

    let novoEstado, mensagem;
    if (diferencaHoras >= 24) {
        // Aprovado automaticamente
        novoEstado = 'Cancelada';
        mensagem = 'Cancelamento aprovado automaticamente (>= 24h)';
        await bookingRepo.atualizarEstadoCancelamento(idMarcacao, novoEstado);
        return { sucesso: true, mensagem };
    } else {
        // Pendente aprovação direção
        novoEstado = 'Pendente_Cancelamento';
        mensagem = 'Prazo expirou (< 24h). Pedido aguarda aprovação da Direção.';
        await bookingRepo.atualizarEstadoCancelamento(idMarcacao, novoEstado);
        return { sucesso: false, mensagem };
    }
};

module.exports = { criarMarcacao, listarMarcacoes, processarCancelamento };
