const classRepo = require('../repositories/classRepository');

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

const listarAulas = async () => {
    return await classRepo.findAll();
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

    const aulasNoDia = await classRepo.findOverlapping(dados.IdEstudio, dados.Data);

    const novaHoraInicio = new Date(dados.HoraInicio).getTime();
    const novaHoraFim = new Date(dados.HoraFim).getTime();

    const aulaSobreposta = aulasNoDia.find((aulaExistente) => {
        const existenteInicio = new Date(aulaExistente.HoraInicio).getTime();
        const existenteFim = new Date(aulaExistente.HoraFim).getTime();
        return novaHoraInicio < existenteFim && novaHoraFim > existenteInicio;
    });

    if (aulaSobreposta) {
        throw criarErro('Conflito de horario! Estudio ocupado.', 400);
    }

    const novaAula = await classRepo.create(dados);

    return {
        mensagem: 'Aula agendada!',
        aula: novaAula
    };
};

const confirmarPresencaProfessor = async (idAula) => {
    return await classRepo.atualizarConfirmacaoProfessor(idAula);
};

const validarAulaDirecao = async (idAula) => {
    // 1. Validar direção
    await classRepo.atualizarValidacaoDirecao(idAula);
    
    // 2. Buscar aula com alunos ativos
    const aula = await classRepo.findByIdComAlunos(idAula);
    if (!aula) {
        throw new Error('Aula não encontrada.');
    }

    const paymentService = require('./paymentService');
    const alunosAtivos = aula.Marcacao.map(m => m.Utilizador);
    const resultadoPagamentos = await paymentService.gerarPagamentosParaAula(alunosAtivos, aula.Preco, idAula);

    return {
        mensagem: `Aula validada e ${resultadoPagamentos.pagamentos.length} pagamentos gerados.`,
        aula,
        pagamentos: resultadoPagamentos.pagamentos
    };
};

module.exports = {
    listarAulas,
    criarAula,
    confirmarPresencaProfessor,
    validarAulaDirecao
};
