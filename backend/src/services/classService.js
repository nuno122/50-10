const classRepo = require('../repositories/classRepository');
const PERMISSOES = require('../config/permissions');

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

const TIPOS_AULA_VALIDOS = ['Regular', 'Particular'];

const intervaloCabeNaDisponibilidade = (horaInicio, horaFim, disponibilidades = []) => {
    const inicioAula = new Date(horaInicio).getTime();
    const fimAula = new Date(horaFim).getTime();

    return disponibilidades.some((disponibilidade) => {
        const inicioDisponivel = new Date(disponibilidade.HoraInicio).getTime();
        const fimDisponivel = new Date(disponibilidade.HoraFim).getTime();
        return inicioAula >= inicioDisponivel && fimAula <= fimDisponivel;
    });
};

const professorSuportaEstilo = (professor, idEstiloDanca) => (
    Array.isArray(professor?.EstiloProfessor) &&
    professor.EstiloProfessor.some((item) => item.IdEstiloDanca === idEstiloDanca)
);

const estudioSuportaEstilo = (estudio, idEstiloDanca) => (
    Array.isArray(estudio?.EstudioEstilo) &&
    estudio.EstudioEstilo.some((item) => item.IdEstiloDanca === idEstiloDanca)
);

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

    const tipoAula = dados.TipoAula || 'Regular';

    if (!TIPOS_AULA_VALIDOS.includes(tipoAula)) {
        throw criarErro('TipoAula invalido. Usa Regular ou Particular.', 400);
    }

    const [professor, estudio, estilo] = await Promise.all([
        classRepo.findProfessorById(dados.IdProfessor),
        classRepo.findEstudioById(dados.IdEstudio),
        classRepo.findEstiloById(dados.IdEstiloDanca)
    ]);

    if (!professor) {
        throw criarErro('O professor selecionado nao existe na tabela Professor.', 400);
    }

    if (!professorSuportaEstilo(professor, dados.IdEstiloDanca)) {
        throw criarErro('O professor selecionado nao esta associado ao estilo escolhido.', 400);
    }

    if (!estudio) {
        throw criarErro('O estudio selecionado nao existe.', 400);
    }

    if (!estudioSuportaEstilo(estudio, dados.IdEstiloDanca)) {
        throw criarErro('O estudio selecionado nao suporta o estilo escolhido.', 400);
    }

    if (!estilo) {
        throw criarErro('O estilo de danca selecionado nao existe.', 400);
    }

    const novaHoraInicio = new Date(dados.HoraInicio).getTime();
    const novaHoraFim = new Date(dados.HoraFim).getTime();

    if (novaHoraFim <= novaHoraInicio) {
        throw criarErro('A hora de fim tem de ser posterior a hora de inicio.', 400);
    }

    const [aulasNoDia, disponibilidadesProfessor] = await Promise.all([
        classRepo.findOverlapping(dados.IdEstudio, dados.Data),
        classRepo.findProfessorAvailabilityByDate(dados.IdProfessor, dados.Data)
    ]);

    if (!intervaloCabeNaDisponibilidade(dados.HoraInicio, dados.HoraFim, disponibilidadesProfessor)) {
        throw criarErro('O professor nao tem disponibilidade registada para este horario.', 400);
    }

    const aulaSobreposta = aulasNoDia.find((aulaExistente) => {
        const existenteInicio = new Date(aulaExistente.HoraInicio).getTime();
        const existenteFim = new Date(aulaExistente.HoraFim).getTime();
        return novaHoraInicio < existenteFim && novaHoraFim > existenteInicio;
    });

    if (aulaSobreposta) {
        throw criarErro('Conflito de horario! Estudio ocupado.', 400);
    }

    const novaAula = await classRepo.create({
        ...dados,
        TipoAula: tipoAula
    });

    return {
        mensagem: 'Aula agendada!',
        aula: novaAula
    };
};

const criarAulasEmLote = async (dados = {}) => {
    const aulas = Array.isArray(dados.Aulas) ? dados.Aulas : [];

    if (aulas.length === 0) {
        throw criarErro('Envia pelo menos uma aula para criar.', 400);
    }

    const criadas = [];
    const erros = [];

    for (let index = 0; index < aulas.length; index += 1) {
        const aula = aulas[index];

        try {
            const resultado = await criarAula(aula);
            criadas.push(resultado.aula);
        } catch (erro) {
            erros.push({
                indice: index + 1,
                referencia: aula?.Referencia || `${aula?.Data || 'sem-data'} ${aula?.HoraInicio || ''}`.trim(),
                mensagem: erro.message || 'Nao foi possivel criar a aula.'
            });
        }
    }

    const totalCriadas = criadas.length;
    const totalFalhas = erros.length;

    let mensagem = `${totalCriadas} aula(s) criada(s) com sucesso.`;

    if (totalFalhas > 0 && totalCriadas > 0) {
        mensagem = `${totalCriadas} aula(s) criada(s) e ${totalFalhas} com erro.`;
    } else if (totalFalhas > 0) {
        mensagem = 'Nao foi possivel criar as aulas enviadas.';
    }

    return {
        mensagem,
        totalRecebidas: aulas.length,
        totalCriadas,
        totalFalhas,
        aulas: criadas,
        erros
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

    if (utilizador?.Permissoes === PERMISSOES.PROFESSOR && aula.IdProfessor !== utilizador.IdUtilizador) {
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
    criarAulasEmLote,
    ConfirmarPresenca,
    confirmarPresencaProfessor: ConfirmarPresenca,
    cancelarAula,
    validarAula,
    validarAulaDirecao: validarAula
};
