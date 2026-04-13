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

module.exports = { criarMarcacao, listarMarcacoes };
