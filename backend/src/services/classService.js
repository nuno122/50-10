const classRepo = require('../repositories/classRepository');

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

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

    const [professor, estudio, estilo] = await Promise.all([
        classRepo.findProfessorById(dados.IdProfessor),
        classRepo.findEstudioById(dados.IdEstudio),
        classRepo.findEstiloById(dados.IdEstiloDanca)
    ]);

    if (!professor) {
        throw criarErro('O professor selecionado nao existe na tabela Professor.', 400);
    }

    if (!estudio) {
        throw criarErro('O estudio selecionado nao existe.', 400);
    }

    if (!estilo) {
        throw criarErro('O estilo de danca selecionado nao existe.', 400);
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

const ConfirmarPresenca = async (idAula) => {
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

    if (utilizador?.Permissoes === 2 && aula.IdProfessor !== utilizador.IdUtilizador) {
        throw criarErro('Apenas o professor responsavel pode cancelar esta aula.', 403);
    }

    const aulaCancelada = await classRepo.cancelarAula(idAula);

    return {
        mensagem: 'Aula cancelada com sucesso.',
        aula: aulaCancelada
    };
};

const validarAula = async (idAula) => {
    await classRepo.atualizarValidacaoDirecao(idAula);

    const aula = await classRepo.findByIdComAlunos(idAula);
    if (!aula) {
        throw new Error('Aula nao encontrada.');
    }

    const paymentService = require('./paymentService');
    const marcacoesAtivas = aula.Marcacao;
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
    ConfirmarPresenca,
    confirmarPresencaProfessor: ConfirmarPresenca,
    cancelarAula,
    validarAula,
    validarAulaDirecao: validarAula
};
