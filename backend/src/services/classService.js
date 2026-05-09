const classRepo = require('../repositories/classRepository');
const PERMISSOES = require('../config/permissions');

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

const TIPOS_AULA_VALIDOS = ['Regular', 'Particular'];

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const relationMatchesStyle = (relation, estilo) => (
    relation.IdEstiloDanca === estilo?.IdEstiloDanca ||
    (
        Boolean(normalizeText(relation.EstiloDanca?.Nome)) &&
        Boolean(normalizeText(estilo?.Nome)) &&
        normalizeText(relation.EstiloDanca?.Nome) === normalizeText(estilo?.Nome)
    )
);

const toMinutes = (value) => {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
        return (date.getUTCHours() * 60) + date.getUTCMinutes();
    }

    const match = String(value || '').match(/(\d{2}):(\d{2})/);
    if (!match) {
        return null;
    }

    return (Number(match[1]) * 60) + Number(match[2]);
};

const construirDataHoraAula = (aula, campoHora = 'HoraFim') => {
    const data = new Date(aula?.Data);
    if (Number.isNaN(data.getTime())) {
        return new Date(0);
    }

    const hora = new Date(aula?.[campoHora]);
    if (Number.isNaN(hora.getTime())) {
        return new Date(0);
    }

    data.setHours(hora.getUTCHours(), hora.getUTCMinutes(), 0, 0);
    return data;
};

const aulaTerminou = (aula) => construirDataHoraAula(aula, 'HoraFim') <= new Date();
const descreverQuantidadePagamentos = (quantidade) => (
    `${quantidade} ${quantidade === 1 ? 'pagamento gerado' : 'pagamentos gerados'}`
);

const intervaloCabeNaDisponibilidade = (horaInicio, horaFim, disponibilidades = []) => {
    const inicioAula = toMinutes(horaInicio);
    const fimAula = toMinutes(horaFim);

    if (!Number.isFinite(inicioAula) || !Number.isFinite(fimAula)) {
        return false;
    }

    return disponibilidades.some((disponibilidade) => {
        const inicioDisponivel = toMinutes(disponibilidade.HoraInicio);
        const fimDisponivel = toMinutes(disponibilidade.HoraFim);
        if (!Number.isFinite(inicioDisponivel) || !Number.isFinite(fimDisponivel)) {
            return false;
        }

        return inicioAula >= inicioDisponivel && fimAula <= fimDisponivel;
    });
};

const professorSuportaEstilo = (professor, estilo) => (
    Array.isArray(professor?.EstiloProfessor) &&
    professor.EstiloProfessor.some((item) => relationMatchesStyle(item, estilo))
);

const estudioSuportaEstilo = (estudio, estilo) => (
    Array.isArray(estudio?.EstudioEstilo) &&
    estudio.EstudioEstilo.some((item) => relationMatchesStyle(item, estilo))
);

const estudioTemCapacidade = (estudio, capacidade) => (
    Number(estudio?.Capacidade || 0) >= Number(capacidade || 0)
);

const estudioTemConflito = (estudio, aulas = [], horaInicio, horaFim) => {
    const novaHoraInicio = toMinutes(horaInicio);
    const novaHoraFim = toMinutes(horaFim);

    return aulas.some((aulaExistente) => {
        const existenteInicio = toMinutes(aulaExistente.HoraInicio);
        const existenteFim = toMinutes(aulaExistente.HoraFim);

        return aulaExistente.IdEstudio === estudio.IdEstudio &&
            novaHoraInicio < existenteFim &&
            novaHoraFim > existenteInicio;
    });
};

const podeUsarEstudioAlternativo = (dados) => dados?.PermitirEstudioAlternativo === true;
const podeUsarProfessorAlternativo = (dados, tipoAula) => (
    tipoAula === 'Regular' &&
    dados?.PermitirProfessorAlternativo === true
);

const existemEstudiosCompativeisDisponiveis = async ({ data, horaInicio, horaFim, capacidade, estilo }) => {
    const [estudios, aulasNoDia] = await Promise.all([
        classRepo.findAllStudios(),
        classRepo.findClassesByDate(data)
    ]);

    return estudios.some((estudio) => (
        estudioSuportaEstilo(estudio, estilo) &&
        estudioTemCapacidade(estudio, capacidade) &&
        !estudioTemConflito(estudio, aulasNoDia, horaInicio, horaFim)
    ));
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

    const tipoAula = dados.TipoAula || 'Regular';

    if (!TIPOS_AULA_VALIDOS.includes(tipoAula)) {
        throw criarErro('TipoAula inválido. Use Regular ou Coaching.', 400);
    }

    const [professor, estudio, estilo] = await Promise.all([
        classRepo.findProfessorById(dados.IdProfessor),
        classRepo.findEstudioById(dados.IdEstudio),
        classRepo.findEstiloById(dados.IdEstiloDanca)
    ]);

    if (!professor) {
        throw criarErro('O professor selecionado nao existe na tabela Professor.', 400);
    }

    if (!professorSuportaEstilo(professor, estilo) && !podeUsarProfessorAlternativo(dados, tipoAula)) {
        throw criarErro('O professor selecionado nao esta associado ao estilo escolhido.', 400);
    }

    if (!estudio) {
        throw criarErro('O estúdio selecionado não existe.', 400);
    }

    if (!estilo) {
        throw criarErro('O estilo de danca selecionado nao existe.', 400);
    }

    if (!estudioTemCapacidade(estudio, dados.CapacidadeMaxima)) {
        throw criarErro('A capacidade da aula excede a capacidade do estúdio selecionado.', 400);
    }

    const novaHoraInicio = toMinutes(dados.HoraInicio);
    const novaHoraFim = toMinutes(dados.HoraFim);

    if (!Number.isFinite(novaHoraInicio) || !Number.isFinite(novaHoraFim)) {
        throw criarErro('Horário da aula inválido.', 400);
    }

    if (novaHoraFim <= novaHoraInicio) {
        throw criarErro('A hora de fim tem de ser posterior a hora de inicio.', 400);
    }

    if (!estudioSuportaEstilo(estudio, estilo)) {
        if (!podeUsarEstudioAlternativo(dados)) {
            throw criarErro('O estúdio selecionado não suporta o estilo escolhido.', 400);
        }

        const existeEstudioCompativelDisponivel = await existemEstudiosCompativeisDisponiveis({
            data: dados.Data,
            horaInicio: dados.HoraInicio,
            horaFim: dados.HoraFim,
            capacidade: dados.CapacidadeMaxima,
            estilo
        });

        if (existeEstudioCompativelDisponivel) {
            throw criarErro(
                'Existem estúdios compatíveis disponíveis para este horário. Escolha primeiro um estúdio associado ao estilo.',
                400
            );
        }
    }

    const shouldValidateProfessorAvailability = tipoAula === 'Particular';

    const [aulasNoEstudio, aulasDoProfessorNoDia, disponibilidadesProfessor] = await Promise.all([
        classRepo.findOverlapping(dados.IdEstudio, dados.Data),
        classRepo.findProfessorClassesByDate(dados.IdProfessor, dados.Data),
        shouldValidateProfessorAvailability
            ? classRepo.findProfessorAvailabilityByDate(dados.IdProfessor, dados.Data)
            : Promise.resolve([])
    ]);

    if (shouldValidateProfessorAvailability && !intervaloCabeNaDisponibilidade(dados.HoraInicio, dados.HoraFim, disponibilidadesProfessor)) {
        throw criarErro('O professor não tem disponibilidade registada para este horário.', 400);
    }

    const aulaSobrepostaNoEstudio = aulasNoEstudio.find((aulaExistente) => {
        const existenteInicio = toMinutes(aulaExistente.HoraInicio);
        const existenteFim = toMinutes(aulaExistente.HoraFim);
        return novaHoraInicio < existenteFim && novaHoraFim > existenteInicio;
    });

    if (aulaSobrepostaNoEstudio) {
        throw criarErro('Conflito de horário: estúdio ocupado.', 400);
    }

    const aulaSobrepostaDoProfessor = aulasDoProfessorNoDia.find((aulaExistente) => {
        const existenteInicio = toMinutes(aulaExistente.HoraInicio);
        const existenteFim = toMinutes(aulaExistente.HoraFim);
        return novaHoraInicio < existenteFim && novaHoraFim > existenteInicio;
    });

    if (aulaSobrepostaDoProfessor) {
        throw criarErro('Conflito de horário: professor ocupado.', 400);
    }

    const novaAula = await classRepo.create({
        ...dados,
        TipoAula: tipoAula,
        OrigemAula: dados.OrigemAula || 'Direcao'
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
                mensagem: erro.message || 'Não foi possível criar a aula.'
            });
        }
    }

    const totalCriadas = criadas.length;
    const totalFalhas = erros.length;

    let mensagem = `${totalCriadas} aula(s) criada(s) com sucesso.`;

    if (totalFalhas > 0 && totalCriadas > 0) {
        mensagem = `${totalCriadas} aula(s) criada(s) e ${totalFalhas} com erro.`;
    } else if (totalFalhas > 0) {
        mensagem = 'Não foi possível criar as aulas enviadas.';
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
    const aula = await classRepo.findByIdComAlunos(idAula);
    if (!aula) {
        throw criarErro('Aula não encontrada.', 404);
    }

    if (aula.EstaAtivo === false) {
        throw criarErro('Não é possível confirmar uma aula cancelada.', 400);
    }

    if (!aulaTerminou(aula)) {
        throw criarErro('Só é possível confirmar a conclusão depois de a aula terminar.', 400);
    }

    const marcacoesAtivas = aula.Marcacao || [];
    if (marcacoesAtivas.length === 0) {
        throw criarErro('Não é possível confirmar uma aula sem alunos inscritos.', 400);
    }

    return await classRepo.ValidarConclusaoAula(idAula, true);
};

const cancelarAula = async (idAula, utilizador) => {
    const aula = await classRepo.findById(idAula);
    if (!aula) {
        throw criarErro('Aula não encontrada.', 404);
    }

    if (aula.EstaAtivo === false) {
        throw criarErro('A aula ja se encontra cancelada.', 400);
    }

    if (aulaTerminou(aula)) {
        throw criarErro('Não é possível cancelar uma aula que já terminou.', 400);
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

const validarAula = async (idAula, opcoes = {}) => {
    const aula = await classRepo.findByIdComAlunos(idAula);
    if (!aula) {
        throw criarErro('Aula não encontrada.', 404);
    }

    if (aula.EstaAtivo === false) {
        throw criarErro('Não é possível validar uma aula cancelada.', 400);
    }

    const concluirPorExcecao = opcoes?.ConcluirPorExcecao === true;

    if (!aula.ConfirmacaoProfessor && !concluirPorExcecao) {
        throw criarErro('A aula tem de ser confirmada pelo professor antes da validação da Direção.', 400);
    }

    if (!aula.ConfirmacaoProfessor && concluirPorExcecao && !aulaTerminou(aula)) {
        throw criarErro('A Direção só pode concluir por exceção depois de a aula terminar.', 400);
    }

    const marcacoesAtivas = aula.Marcacao;
    if (marcacoesAtivas.length === 0) {
        throw criarErro('Não é possível validar uma aula sem alunos inscritos.', 400);
    }

    await classRepo.atualizarValidacaoDirecao(idAula);

    const paymentService = require('./paymentService');
    const resultadoPagamentos = await paymentService.GerarPagamento(marcacoesAtivas, aula.Preco);
    const resumoPagamentos = descreverQuantidadePagamentos(resultadoPagamentos.pagamentos.length);

    const mensagem = concluirPorExcecao && !aula.ConfirmacaoProfessor
        ? `Aula concluída por exceção pela Direção e ${resumoPagamentos}.`
        : `Aula validada e ${resumoPagamentos}.`;

    return {
        mensagem,
        aula,
        pagamentos: resultadoPagamentos.pagamentos,
        concluidaPorExcecao: concluirPorExcecao && !aula.ConfirmacaoProfessor
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
