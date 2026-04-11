const marcacaoRepo = require('../repositories/marcacaoRepository');

const criarMarcacao = async (idAluno, idAula) => {
    if (!idAluno || !idAula) {
        const erro = new Error('IdAluno e IdAula sao obrigatorios.');
        erro.statusCode = 400;
        throw erro;
    }

    const aluno = await marcacaoRepo.findAlunoById(idAluno);
    if (!aluno) {
        const erro = new Error('Aluno nao encontrado.');
        erro.statusCode = 404;
        throw erro;
    }

    const aula = await marcacaoRepo.findAulaWithMarcacoes(idAula);
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

    const jaInscrito = await marcacaoRepo.findExisting(idAluno, idAula);
    if (jaInscrito) {
        const erro = new Error('Ja estas inscrito nesta aula.');
        erro.statusCode = 400;
        throw erro;
    }

    const novaMarcacao = await marcacaoRepo.create(idAluno, idAula);

    return {
        mensagem: 'Lugar reservado!',
        marcacao: novaMarcacao
    };
};

const listarMarcacoes = async () => {
    return await marcacaoRepo.findAll();
};

module.exports = { criarMarcacao, listarMarcacoes };
