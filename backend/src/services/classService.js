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
    const alunosAtivos = aula.Marcacao.map(m => m.Aluno);
    const resultadoPagamentos = await paymentService.gerarPagamentosParaAula(alunosAtivos, aula.Preco, idAula);

    return {
        mensagem: `Aula validada e ${resultadoPagamentos.pagamentos.length} pagamentos gerados.`,
        aula,
        pagamentos: resultadoPagamentos.pagamentos
    };
};

//---------------------  ---------------------// 
const consultarVagas = async (idAula) => {
    if (!idAula) throw criarErro('IdAula é obrigatório.', 400);

    const aula = await classRepo.findAulaWithMarcacoes(idAula);
    if (!aula) throw criarErro('Aula não encontrada.', 404);

    const inscritosAtivos = aula.Marcacao.filter(m => m.EstaAtivo).length;
    const vagasDisponiveis = aula.CapacidadeMaxima - inscritosAtivos;

    return {
        idAula: aula.IdAula,
        capacidadeMaxima: aula.CapacidadeMaxima,
        inscritos: inscritosAtivos,
        vagas: vagasDisponiveis,
        lotada: vagasDisponiveis <= 0
    };
};

const getAulasDisponiveis = async () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const aulas = await classRepo.findAulasComMarcacoes(hoje);

    return aulas
        .filter(aula => {
            const inscritosAtivos = aula.Marcacao.filter(m => m.EstaAtivo).length;
            return inscritosAtivos < aula.CapacidadeMaxima;
        })
        .map(aula => {
            const inscritosAtivos = aula.Marcacao.filter(m => m.EstaAtivo).length;
            return {
                ...aula,
                vagasDisponiveis: aula.CapacidadeMaxima - inscritosAtivos
            };
        });
};

const validarConclusaoAula = async (idAula) => {
    if (!idAula) throw criarErro('IdAula é obrigatório.', 400);

    const aula = await classRepo.findById(idAula);
    if (!aula) throw criarErro('Aula não encontrada.', 404);

    const agora = new Date();
    const dataAula = new Date(aula.Data);
    dataAula.setHours(aula.HoraFim.getHours(), aula.HoraFim.getMinutes(), 0, 0);

    if (agora < dataAula) {
        throw criarErro('A aula ainda não terminou.', 400);
    }

    if (!aula.ConfirmacaoProfessor) {
        throw criarErro('O professor ainda não confirmou a aula.', 400);
    }

    if (!aula.ValidacaoDirecao) {
        throw criarErro('A direção ainda não validou a aula.', 400);
    }

    return { mensagem: 'Aula concluída e validada com sucesso.', aula };
};

// Atualiza o module.exports
module.exports = {
    listarAulas,
    criarAula,
    confirmarPresencaProfessor,
    validarAulaDirecao,
    consultarVagas,
    getAulasDisponiveis,
    validarConclusaoAula
};

