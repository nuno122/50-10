const availabilityRepo = require('../repositories/availabilityRepository');

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

const normalizeDateKey = (value) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const extractTime = (value) => {
    const match = String(value || '').match(/(\d{2}):(\d{2})/);

    if (!match) {
        return '';
    }

    return `${match[1]}:${match[2]}`;
};

const buildIsoTime = (dateKey, timeValue) => `${dateKey}T${timeValue}:00.000Z`;

const toMinutes = (timeValue) => {
    const [hours, minutes] = String(timeValue || '00:00').split(':').map(Number);
    return (hours * 60) + minutes;
};

const assertProfessor = async (idProfessor) => {
    if (!idProfessor) {
        throw criarErro('Utilizador nao autenticado.', 401);
    }

    const professor = await availabilityRepo.findProfessorById(idProfessor);

    if (!professor) {
        throw criarErro('Professor nao encontrado.', 404);
    }

    return professor;
};

const getDisponibilidadesPayload = (dados = {}) => {
    if (Array.isArray(dados.disponibilidades)) {
        return dados.disponibilidades;
    }

    if (Array.isArray(dados.entries)) {
        return dados.entries;
    }

    return [];
};

const validarEscopoSubstituicao = (dados = {}) => {
    const replaceDates = Array.isArray(dados.replaceDates)
        ? [...new Set(dados.replaceDates.map(normalizeDateKey).filter(Boolean))].sort((left, right) => left.localeCompare(right))
        : [];

    if (replaceDates.length > 0) {
        return {
            type: 'dates',
            dates: replaceDates
        };
    }

    const rangePayload = dados.replaceRange || dados.range || {
        from: dados.from,
        to: dados.to
    };
    const from = normalizeDateKey(rangePayload?.from || rangePayload?.start);
    const to = normalizeDateKey(rangePayload?.to || rangePayload?.end);

    if (!from || !to) {
        const datasDasDisponibilidades = getDisponibilidadesPayload(dados)
            .map((item) => normalizeDateKey(item?.Data))
            .filter(Boolean)
            .filter((value, index, array) => array.indexOf(value) === index);

        if (datasDasDisponibilidades.length > 0) {
            return {
                type: 'range',
                from: datasDasDisponibilidades[0],
                to: datasDasDisponibilidades[datasDasDisponibilidades.length - 1]
            };
        }

        throw criarErro('Indica o intervalo a substituir em replaceRange.from e replaceRange.to.', 400);
    }

    if (from > to) {
        throw criarErro('O intervalo de disponibilidade e invalido.', 400);
    }

    return {
        type: 'range',
        from,
        to
    };
};

const normalizarDisponibilidades = (disponibilidades = [], scope) => {
    const uniqueMap = new Map();

    disponibilidades.forEach((item, index) => {
        const dateKey = normalizeDateKey(item?.Data);
        const startTime = extractTime(item?.HoraInicio);
        const endTime = extractTime(item?.HoraFim);

        if (!dateKey) {
            throw criarErro(`A disponibilidade ${index + 1} tem uma data invalida.`, 400);
        }

        if (!startTime || !endTime) {
            throw criarErro(`A disponibilidade ${index + 1} tem um horario invalido.`, 400);
        }

        const withinRange = scope.type === 'range'
            ? dateKey >= scope.from && dateKey <= scope.to
            : scope.dates.includes(dateKey);

        if (!withinRange) {
            throw criarErro(`A disponibilidade ${index + 1} esta fora do intervalo selecionado.`, 400);
        }

        if (toMinutes(startTime) >= toMinutes(endTime)) {
            throw criarErro(`A disponibilidade ${index + 1} tem HoraFim anterior ou igual a HoraInicio.`, 400);
        }

        const key = `${dateKey}|${startTime}|${endTime}`;

        uniqueMap.set(key, {
            Data: dateKey,
            HoraInicio: buildIsoTime(dateKey, startTime),
            HoraFim: buildIsoTime(dateKey, endTime)
        });
    });

    const normalized = [...uniqueMap.values()].sort((left, right) => {
        if (left.Data !== right.Data) {
            return left.Data.localeCompare(right.Data);
        }

        return toMinutes(extractTime(left.HoraInicio)) - toMinutes(extractTime(right.HoraInicio));
    });

    for (let index = 1; index < normalized.length; index += 1) {
        const previous = normalized[index - 1];
        const current = normalized[index];

        if (previous.Data !== current.Data) {
            continue;
        }

        if (toMinutes(extractTime(current.HoraInicio)) < toMinutes(extractTime(previous.HoraFim))) {
            throw criarErro(`Existem disponibilidades sobrepostas em ${current.Data}.`, 400);
        }
    }

    return normalized;
};

const listarMinhasDisponibilidades = async (utilizador) => {
    const idProfessor = utilizador?.IdUtilizador;
    await assertProfessor(idProfessor);
    return await availabilityRepo.findByProfessor(idProfessor);
};

const listarDisponibilidades = async (range = {}) => {
    return await availabilityRepo.findAll(range);
};

const guardarMinhasDisponibilidades = async (utilizador, dados = {}) => {
    const idProfessor = utilizador?.IdUtilizador;
    await assertProfessor(idProfessor);

    const disponibilidades = getDisponibilidadesPayload(dados);
    const scope = validarEscopoSubstituicao(dados);
    const normalized = normalizarDisponibilidades(disponibilidades, scope);

    const guardadas = await availabilityRepo.replaceByProfessorInScope(idProfessor, {
        scope,
        disponibilidades: normalized
    });

    const mensagem = normalized.length === 0
        ? 'Disponibilidades atualizadas com sucesso.'
        : `${guardadas.length} disponibilidade(s) guardada(s) com sucesso.`;

    return {
        mensagem,
        totalGuardadas: guardadas.length,
        disponibilidades: guardadas
    };
};

module.exports = {
    listarDisponibilidades,
    listarMinhasDisponibilidades,
    guardarMinhasDisponibilidades
};
