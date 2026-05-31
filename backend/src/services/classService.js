const classRepo = require('../repositories/classRepository');
const PERMISSOES = require('../config/permissions');
const notificationService = require('./notificationService');

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

const TIPOS_AULA_VALIDOS = ['Regular', 'Particular'];

const normalizeText = (value) => String(value || '').trim().toLowerCase();
const normalizeStudentIds = (dados = {}) => {
    const ids = Array.isArray(dados.IdsAluno)
        ? dados.IdsAluno
        : dados.IdAluno !== undefined && dados.IdAluno !== null && dados.IdAluno !== ''
            ? [dados.IdAluno]
            : [];

    return [...new Set(
        ids
            .map((value) => String(value || '').trim())
            .filter(Boolean)
    )];
};

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

const podeUsarEstudioAlternativo = (dados) => dados?.PermitirEstudioAlternativo === true;
const podeUsarProfessorAlternativo = (dados, tipoAula) => (
    tipoAula === 'Regular' &&
    dados?.PermitirProfessorAlternativo === true
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

    if (!Number.isFinite(Number(dados.Preco)) || Number(dados.Preco) < 0) {
        throw criarErro('O preço da aula tem de ser superior a 0.', 400);
    }

    const tipoAula = dados.TipoAula || 'Regular';
    const shouldCreateDirectorBooking = tipoAula === 'Particular' && dados?.OrigemAula === 'Direcao';
    const studentIds = shouldCreateDirectorBooking ? normalizeStudentIds(dados) : [];

    if (tipoAula === 'Particular' && Number(dados.Preco) <= 0) {
        throw criarErro('O preco do Coaching tem de ser superior a 0.', 400);
    }

    if (!TIPOS_AULA_VALIDOS.includes(tipoAula)) {
        throw criarErro('TipoAula invalido. Use Regular ou Coaching.', 400);
    }

    if (shouldCreateDirectorBooking && studentIds.length === 0) {
        throw criarErro('Escolha pelo menos um aluno antes de criar o Coaching.', 400);
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
        throw criarErro('O estudio selecionado nao existe.', 400);
    }

    if (!estilo) {
        throw criarErro('O estilo de danca selecionado nao existe.', 400);
    }

    if (!estudioTemCapacidade(estudio, dados.CapacidadeMaxima)) {
        throw criarErro('A capacidade da aula excede a capacidade do estudio selecionado.', 400);
    }

    if (shouldCreateDirectorBooking && Number(dados.CapacidadeMaxima) < studentIds.length) {
        throw criarErro('A capacidade do Coaching tem de ser igual ou superior ao numero de alunos selecionados.', 400);
    }

    const novaHoraInicio = toMinutes(dados.HoraInicio);
    const novaHoraFim = toMinutes(dados.HoraFim);

    if (!Number.isFinite(novaHoraInicio) || !Number.isFinite(novaHoraFim)) {
        throw criarErro('Horario da aula invalido.', 400);
    }

    if (novaHoraFim <= novaHoraInicio) {
        throw criarErro('A hora de fim tem de ser posterior a hora de inicio.', 400);
    }

    if (!estudioSuportaEstilo(estudio, estilo) && !podeUsarEstudioAlternativo(dados)) {
        throw criarErro('O estudio selecionado nao suporta o estilo escolhido.', 400);
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
        throw criarErro('O professor nao tem disponibilidade registada para este horario.', 400);
    }

    const aulaSobrepostaNoEstudio = aulasNoEstudio.find((aulaExistente) => {
        const existenteInicio = toMinutes(aulaExistente.HoraInicio);
        const existenteFim = toMinutes(aulaExistente.HoraFim);
        return novaHoraInicio < existenteFim && novaHoraFim > existenteInicio;
    });

    if (aulaSobrepostaNoEstudio) {
        throw criarErro('Conflito de horario: estudio ocupado.', 400);
    }

    const aulaSobrepostaDoProfessor = aulasDoProfessorNoDia.find((aulaExistente) => {
        const existenteInicio = toMinutes(aulaExistente.HoraInicio);
        const existenteFim = toMinutes(aulaExistente.HoraFim);
        return novaHoraInicio < existenteFim && novaHoraFim > existenteInicio;
    });

    if (aulaSobrepostaDoProfessor) {
        throw criarErro('Conflito de horario: professor ocupado.', 400);
    }

    const novaAula = await classRepo.create({
        ...dados,
        TipoAula: tipoAula,
        OrigemAula: dados.OrigemAula || 'Direcao'
    });

    let marcacoes = [];

    if (shouldCreateDirectorBooking) {
        const bookingService = require('./bookingService');
        const bookingRepo = require('../repositories/bookingRepository');

        try {
            const alunosValidos = await Promise.all(
                studentIds.map((studentId) => bookingRepo.findAlunoById(studentId))
            );

            const alunoEmFaltaIndex = alunosValidos.findIndex((aluno) => !aluno);
            if (alunoEmFaltaIndex >= 0) {
                throw criarErro('Um dos alunos selecionados nao foi encontrado.', 404);
            }

            for (const studentId of studentIds) {
                const resultadoMarcacao = await bookingService.FazerMarcacao(novaAula.IdAula, studentId);
                marcacoes.push(resultadoMarcacao.marcacao);
            }
        } catch (erro) {
            await classRepo.cancelarAula(novaAula.IdAula);
            throw erro;
        }
    }

    if (shouldCreateDirectorBooking && marcacoes.length > 0) {
        const guardianIds = await notificationService.getGuardianIdsByStudentIds(studentIds);
        const when = new Intl.DateTimeFormat('pt-PT').format(new Date(novaAula.Data));
        const time = String(novaAula.HoraInicio || '').match(/(\d{2}):(\d{2})/);
        const whenLabel = `${when}${time ? ` às ${time[1]}:${time[2]}` : ''}`;
        const styleLabel = estilo?.Nome || 'Coaching';

        await notificationService.createForUsers(
            [dados.IdProfessor, ...guardianIds],
            {
                title: 'Novo Coaching agendado',
                message: `${styleLabel} agendado para ${whenLabel}.`,
                tone: 'info',
                entityType: 'Aula',
                entityId: novaAula.IdAula
            }
        );
    }

    return {
        mensagem: 'Aula agendada!',
        aula: novaAula,
        marcacao: marcacoes[0] || null,
        marcacoes
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
    const aula = await classRepo.findByIdComAlunos(idAula);
    if (!aula) {
        throw criarErro('Aula nao encontrada.', 404);
    }

    if (aula.EstaAtivo === false) {
        throw criarErro('Nao e possivel confirmar uma aula cancelada.', 400);
    }

    if (!aulaTerminou(aula)) {
        throw criarErro('So e possivel confirmar a conclusao depois de a aula terminar.', 400);
    }

    const marcacoesAtivas = aula.Marcacao || [];
    if (marcacoesAtivas.length === 0) {
        throw criarErro('Nao e possivel confirmar uma aula sem alunos inscritos.', 400);
    }

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

    if (aulaTerminou(aula)) {
        throw criarErro('Nao e possivel cancelar uma aula que ja terminou.', 400);
    }

    if (utilizador?.Permissoes === PERMISSOES.PROFESSOR && aula.IdProfessor !== utilizador.IdUtilizador) {
        throw criarErro('Apenas o professor responsavel pode cancelar esta aula.', 403);
    }

    const aulaCancelada = await classRepo.cancelarAula(idAula);

    const guardianIds = await notificationService.getGuardianIdsByStudentIds(
        (aulaCancelada.Marcacao || []).map((booking) => booking.IdAluno)
    );
    const styleLabel = aulaCancelada.EstiloDanca?.Nome || 'Aula';
    const when = new Intl.DateTimeFormat('pt-PT').format(new Date(aulaCancelada.Data));
    const time = String(aulaCancelada.HoraInicio || '').match(/(\d{2}):(\d{2})/);
    const whenLabel = `${when}${time ? ` às ${time[1]}:${time[2]}` : ''}`;
    const isCoaching = (aulaCancelada.TipoAula || 'Regular') === 'Particular';

    await notificationService.createForUsers(
        [aulaCancelada.IdProfessor, ...guardianIds],
        {
            title: isCoaching ? 'Coaching cancelado' : 'Aula cancelada',
            message: `${styleLabel} de ${whenLabel} foi cancelada.`,
            tone: 'warning',
            entityType: 'Aula',
            entityId: aulaCancelada.IdAula
        }
    );

    return {
        mensagem: 'Aula cancelada com sucesso.',
        aula: aulaCancelada
    };
};

const validarAula = async (idAula, opcoes = {}) => {
    const aula = await classRepo.findByIdComAlunos(idAula);
    if (!aula) {
        throw criarErro('Aula nao encontrada.', 404);
    }

    if (aula.EstaAtivo === false) {
        throw criarErro('Nao e possivel validar uma aula cancelada.', 400);
    }

    const concluirPorExcecao = opcoes?.ConcluirPorExcecao === true;

    if (!aula.ConfirmacaoProfessor && !concluirPorExcecao) {
        throw criarErro('A aula tem de ser confirmada pelo professor antes da validacao da Direcao.', 400);
    }

    if (!aula.ConfirmacaoProfessor && concluirPorExcecao && !aulaTerminou(aula)) {
        throw criarErro('A Direcao so pode concluir por excecao depois de a aula terminar.', 400);
    }

    const marcacoesAtivas = aula.Marcacao;
    if (marcacoesAtivas.length === 0) {
        throw criarErro('Nao e possivel validar uma aula sem alunos inscritos.', 400);
    }

    await classRepo.atualizarValidacaoDirecao(idAula);

    const paymentService = require('./paymentService');
    const resultadoPagamentos = await paymentService.GerarPagamento(marcacoesAtivas, aula.Preco);
    const resumoPagamentos = descreverQuantidadePagamentos(resultadoPagamentos.pagamentos.length);

    const mensagem = concluirPorExcecao && !aula.ConfirmacaoProfessor
        ? `Aula concluida por excecao pela Direcao e ${resumoPagamentos}.`
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
