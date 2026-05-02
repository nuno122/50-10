import React, { useEffect, useMemo, useState } from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { criarAula, criarAulasEmLote, getAulas, getDisponibilidades, getEstilos, getEstudios, getUtilizadores } from '../services/api';
import { PERMISSOES } from '../utils/permissions';

const FIELD_ALIASES = {
    data: ['data', 'dia', 'date'],
    diaSemana: ['diasemana', 'weekday', 'semana'],
    diaMes: ['diames', 'daymonth', 'dayofmonth'],
    mes: ['mes', 'month'],
    horaInicio: ['horainicio', 'inicio', 'start', 'horarioinicio'],
    horaFim: ['horafim', 'fim', 'end', 'horariofim'],
    capacidade: ['capacidade', 'vagas', 'lotacao'],
    professor: ['professor', 'nomeprofessor', 'teacher'],
    professorId: ['idprofessor', 'professorid'],
    estudio: ['estudio', 'studio', 'sala', 'estudionumero'],
    estudioId: ['idestudio', 'studioid'],
    estilo: ['estilo', 'estilodanca', 'modalidade', 'style'],
    estiloId: ['idestilodanca', 'idestilo', 'styleid'],
    tipoAula: ['tipoaula', 'tipo', 'lessontype'],
    preco: ['preco', 'valor', 'price']
};

const initialForm = {
    date: '',
    teacher: '',
    style: '',
    lessonType: 'Regular',
    capacity: '',
    startTime: '',
    endTime: '',
    duration: '',
    studio: '',
    repeatMode: 'none',
    repeatUntil: ''
};

const getInitialImportForm = () => {
    const today = new Date();
    const nextYear = new Date(today);
    nextYear.setFullYear(today.getFullYear() + 1);

    return {
        cadence: 'specific',
        startDate: toDateInputValue(today),
        endDate: toDateInputValue(nextYear),
        defaultTeacher: '',
        defaultStudio: '',
        defaultStyle: '',
        defaultLessonType: 'Regular',
        defaultCapacity: '',
        defaultPrice: '0',
        file: null
    };
};

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function toDateInputValue(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const getStartOfWeek = (date) => {
    const result = new Date(date);
    const day = result.getDay();
    const diff = result.getDate() - day + (day === 0 ? -6 : 1);
    result.setDate(diff);
    result.setHours(0, 0, 0, 0);
    return result;
};

const getDaysOfWeek = (startDate) => {
    const days = [];
    for (let i = 0; i < 7; i += 1) {
        const nextDate = new Date(startDate);
        nextDate.setDate(startDate.getDate() + i);
        days.push(nextDate);
    }
    return days;
};

const getDateKey = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return toDateInputValue(date);
};

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('pt-PT').format(date);
};

const extractTime = (value) => {
    const text = String(value || '');
    const match = text.match(/(\d{2}):(\d{2})/);
    return match ? { hours: Number(match[1]), minutes: Number(match[2]) } : { hours: 0, minutes: 0 };
};

const formatTime = (value) => {
    const parts = extractTime(value);
    return `${String(parts.hours).padStart(2, '0')}:${String(parts.minutes).padStart(2, '0')}`;
};

const formatTimeRange = (startValue, endValue) => `${formatTime(startValue)} - ${formatTime(endValue)}`;

const getRelationStyleIds = (items = []) => items.map((item) => item.IdEstiloDanca);

const normalizeTimeValue = (value) => {
    const text = String(value || '').trim().replace('.', ':');
    const match = text.match(/^(\d{1,2}):(\d{2})$/);

    if (!match) return '';

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return '';
    }

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const toMinutes = (timeValue) => {
    const normalized = normalizeTimeValue(timeValue);
    if (!normalized) return 0;
    const [hours, minutes] = normalized.split(':').map(Number);
    return (hours * 60) + minutes;
};

const buildIsoTime = (date, time) => {
    const dayText = typeof date === 'string' ? date.slice(0, 10) : toDateInputValue(date);
    return `${dayText}T${time}:00.000Z`;
};

const computeEndTime = (startTime, durationMinutes) => {
    if (!startTime || !durationMinutes) return '';
    const [hours, minutes] = startTime.split(':').map(Number);
    const total = (hours * 60) + minutes + Number(durationMinutes);
    const nextHours = Math.floor(total / 60);
    const nextMinutes = total % 60;
    return `${String(nextHours).padStart(2, '0')}:${String(nextMinutes).padStart(2, '0')}`;
};

const createValidDate = (year, monthIndex, day) => {
    const date = new Date(year, monthIndex, day);
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== monthIndex ||
        date.getDate() !== day
    ) {
        return null;
    }

    date.setHours(0, 0, 0, 0);
    return date;
};

const parseDateInput = (value) => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return createValidDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

const buildMonthlyDates = (dayOfMonth, startDate, endDate) => {
    const dates = [];
    let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const limit = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (cursor <= limit) {
        const candidate = createValidDate(cursor.getFullYear(), cursor.getMonth(), dayOfMonth);
        if (candidate && candidate >= startDate && candidate <= endDate) {
            dates.push(toDateInputValue(candidate));
        }
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    return dates;
};

const buildAnnualDates = (month, dayOfMonth, startDate, endDate) => {
    const dates = [];

    for (let year = startDate.getFullYear(); year <= endDate.getFullYear(); year += 1) {
        const candidate = createValidDate(year, month - 1, dayOfMonth);
        if (candidate && candidate >= startDate && candidate <= endDate) {
            dates.push(toDateInputValue(candidate));
        }
    }

    return dates;
};

const buildWeeklyDates = (weekday, startDate, endDate) => {
    const dates = [];
    const current = new Date(startDate);

    while (current.getDay() !== weekday) {
        current.setDate(current.getDate() + 1);
    }

    while (current <= endDate) {
        dates.push(toDateInputValue(current));
        current.setDate(current.getDate() + 7);
    }

    return dates;
};

const buildRecurringDates = (startDateValue, repeatMode, repeatUntilValue) => {
    const startDate = parseDateInput(startDateValue);
    if (!startDate) return [];

    if (repeatMode === 'none') {
        return [startDateValue];
    }

    const repeatUntil = parseDateInput(repeatUntilValue);
    if (!repeatUntil || repeatUntil < startDate) {
        return [startDateValue];
    }

    if (repeatMode === 'weekly') {
        return buildWeeklyDates(startDate.getDay(), startDate, repeatUntil);
    }

    if (repeatMode === 'monthly') {
        return buildMonthlyDates(startDate.getDate(), startDate, repeatUntil);
    }

    return buildAnnualDates(startDate.getMonth() + 1, startDate.getDate(), startDate, repeatUntil);
};

const layoutDayLessons = (lessons) => {
    const sortedLessons = [...lessons].sort((left, right) => {
        if (left.startMinutes !== right.startMinutes) {
            return left.startMinutes - right.startMinutes;
        }

        if (left.endMinutes !== right.endMinutes) {
            return left.endMinutes - right.endMinutes;
        }

        return String(left.id).localeCompare(String(right.id));
    });

    const positionedLessons = [];
    let group = [];
    let active = [];
    let groupMaxLane = -1;
    let groupEnd = -1;

    const flushGroup = () => {
        if (group.length === 0) return;

        const laneCount = Math.max(groupMaxLane + 1, 1);
        group.forEach((lesson) => {
            positionedLessons.push({
                ...lesson,
                lane: lesson._lane,
                laneCount
            });
        });

        group = [];
        active = [];
        groupMaxLane = -1;
        groupEnd = -1;
    };

    sortedLessons.forEach((lesson) => {
        if (group.length > 0 && lesson.startMinutes >= groupEnd) {
            flushGroup();
        }

        active = active.filter((item) => item.endMinutes > lesson.startMinutes);

        const usedLanes = new Set(active.map((item) => item.lane));
        let lane = 0;
        while (usedLanes.has(lane)) {
            lane += 1;
        }

        const lessonWithLane = {
            ...lesson,
            _lane: lane
        };

        active.push({
            lane,
            endMinutes: lesson.endMinutes
        });

        group.push(lessonWithLane);
        groupMaxLane = Math.max(groupMaxLane, lane);
        groupEnd = Math.max(groupEnd, lesson.endMinutes);
    });

    flushGroup();
    return positionedLessons;
};

const splitDelimitedLine = (line, delimiter) => {
    const values = [];
    let currentValue = '';
    let insideQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const character = line[index];

        if (character === '"') {
            if (insideQuotes && line[index + 1] === '"') {
                currentValue += '"';
                index += 1;
            } else {
                insideQuotes = !insideQuotes;
            }
            continue;
        }

        if (character === delimiter && !insideQuotes) {
            values.push(currentValue.trim());
            currentValue = '';
            continue;
        }

        currentValue += character;
    }

    values.push(currentValue.trim());
    return values;
};

const detectDelimiter = (headerLine) => {
    const semicolonCount = (headerLine.match(/;/g) || []).length;
    const commaCount = (headerLine.match(/,/g) || []).length;
    return semicolonCount >= commaCount ? ';' : ',';
};

const parseCsvText = (text) => {
    const lines = String(text || '')
        .replace(/\ufeff/g, '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length < 2) {
        throw new Error('O ficheiro precisa de cabecalho e pelo menos uma linha.');
    }

    const delimiter = detectDelimiter(lines[0]);
    const headers = splitDelimitedLine(lines[0], delimiter).map((header, index) => normalizeText(header) || `coluna${index + 1}`);

    return lines.slice(1).map((line, index) => {
        const values = splitDelimitedLine(line, delimiter);
        const row = { __line: index + 2 };

        headers.forEach((header, valueIndex) => {
            row[header] = String(values[valueIndex] || '').trim();
        });

        return row;
    });
};

const readRowValue = (row, aliases) => {
    for (const alias of aliases) {
        const value = row[alias];
        if (value !== undefined && String(value).trim() !== '') {
            return String(value).trim();
        }
    }
    return '';
};

const resolveWeekday = (value) => {
    const normalized = normalizeText(value);
    const weekdayMap = {
        '0': 0,
        '7': 0,
        domingo: 0,
        sunday: 0,
        dom: 0,
        '1': 1,
        segunda: 1,
        monday: 1,
        seg: 1,
        '2': 2,
        terca: 2,
        tuesday: 2,
        ter: 2,
        '3': 3,
        quarta: 3,
        wednesday: 3,
        qua: 3,
        '4': 4,
        quinta: 4,
        thursday: 4,
        qui: 4,
        '5': 5,
        sexta: 5,
        friday: 5,
        sex: 5,
        '6': 6,
        sabado: 6,
        saturday: 6,
        sab: 6
    };

    return Object.prototype.hasOwnProperty.call(weekdayMap, normalized) ? weekdayMap[normalized] : null;
};

const resolveLessonType = (value, fallback = 'Regular') => {
    const normalized = normalizeText(value || fallback);
    return normalized.startsWith('part') ? 'Particular' : 'Regular';
};

const resolveProfessorId = (value, professores) => {
    const text = String(value || '').trim();
    if (!text) return '';

    const normalized = normalizeText(text);
    const match = professores.find((professor) => (
        professor.IdUtilizador === text ||
        normalizeText(professor.NomeCompleto) === normalized ||
        normalizeText(professor.Nome) === normalized
    ));

    return match?.IdUtilizador || '';
};

const resolveStudioId = (value, estudios) => {
    const text = String(value || '').trim();
    if (!text) return '';

    const normalized = normalizeText(text);
    const digitsOnly = normalized.replace(/[^\d]/g, '');

    const match = estudios.find((studio) => (
        studio.IdEstudio === text ||
        String(studio.Numero) === text ||
        String(studio.Numero) === digitsOnly ||
        normalizeText(`estudio${studio.Numero}`) === normalized ||
        normalizeText(`sala${studio.Numero}`) === normalized
    ));

    return match?.IdEstudio || '';
};

const resolveStyleId = (value, estilos) => {
    const text = String(value || '').trim();
    if (!text) return '';

    const normalized = normalizeText(text);
    const match = estilos.find((style) => (
        style.IdEstiloDanca === text ||
        normalizeText(style.Nome) === normalized
    ));

    return match?.IdEstiloDanca || '';
};

const normalizeBatchResult = (result) => {
    if (result && typeof result.totalRecebidas === 'number') {
        return result;
    }

    return {
        mensagem: result?.mensagem || 'Aula criada com sucesso.',
        totalRecebidas: 1,
        totalCriadas: 1,
        totalFalhas: 0,
        aulas: result?.aula ? [result.aula] : [],
        erros: []
    };
};

const buildImportDates = (cadence, row, rangeStart, rangeEnd) => {
    if (cadence === 'specific') {
        const dateValue = readRowValue(row, FIELD_ALIASES.data);
        const exactDate = parseDateInput(dateValue);

        if (!exactDate) {
            throw new Error('A coluna Data esta em falta ou e invalida.');
        }

        if (exactDate < rangeStart || exactDate > rangeEnd) {
            return [];
        }

        return [toDateInputValue(exactDate)];
    }

    if (cadence === 'weekly') {
        const weekday = resolveWeekday(readRowValue(row, FIELD_ALIASES.diaSemana));

        if (weekday === null) {
            throw new Error('DiaSemana invalido. Usa segunda, terca, quarta... ou 1-7.');
        }

        return buildWeeklyDates(weekday, rangeStart, rangeEnd);
    }

    if (cadence === 'monthly') {
        const dayOfMonth = Number(readRowValue(row, FIELD_ALIASES.diaMes));

        if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
            throw new Error('DiaMes invalido. Usa um valor entre 1 e 31.');
        }

        return buildMonthlyDates(dayOfMonth, rangeStart, rangeEnd);
    }

    const month = Number(readRowValue(row, FIELD_ALIASES.mes));
    const dayOfMonth = Number(readRowValue(row, FIELD_ALIASES.diaMes));

    if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new Error('Mes invalido. Usa um valor entre 1 e 12.');
    }

    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
        throw new Error('DiaMes invalido. Usa um valor entre 1 e 31.');
    }

    return buildAnnualDates(month, dayOfMonth, rangeStart, rangeEnd);
};

const getImportTemplateCopy = (cadence) => {
    if (cadence === 'weekly') {
        return 'Colunas obrigatorias: diaSemana, horaInicio, horaFim, professor/professorId, estudio/estudioId, estilo/estiloId, capacidade, tipoAula, preco';
    }

    if (cadence === 'monthly') {
        return 'Colunas obrigatorias: diaMes, horaInicio, horaFim, professor/professorId, estudio/estudioId, estilo/estiloId, capacidade, tipoAula, preco';
    }

    if (cadence === 'annual') {
        return 'Colunas obrigatorias: mes, diaMes, horaInicio, horaFim, professor/professorId, estudio/estudioId, estilo/estiloId, capacidade, tipoAula, preco';
    }

    return 'Colunas obrigatorias: data, horaInicio, horaFim, professor/professorId, estudio/estudioId, estilo/estiloId, capacidade, tipoAula, preco';
};

const ScheduleManagement = () => {
    const { notify, refreshSnapshot } = useNotifications();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isQuickBookOpen, setIsQuickBookOpen] = useState(false);
    const [activeAction, setActiveAction] = useState('regular');
    const [formData, setFormData] = useState(initialForm);
    const [importForm, setImportForm] = useState(getInitialImportForm);
    const [importInputKey, setImportInputKey] = useState(0);
    const [aulas, setAulas] = useState([]);
    const [estudios, setEstudios] = useState([]);
    const [estilos, setEstilos] = useState([]);
    const [professores, setProfessores] = useState([]);
    const [disponibilidades, setDisponibilidades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');
    const [operationSummary, setOperationSummary] = useState(null);
    const [selectedLesson, setSelectedLesson] = useState(null);

    const loadData = async () => {
        setLoading(true);
        setError('');

        try {
            const [aulasData, disponibilidadesData, estudiosData, estilosData, utilizadoresData] = await Promise.all([
                getAulas(),
                getDisponibilidades(),
                getEstudios(),
                getEstilos(),
                getUtilizadores()
            ]);

            setAulas(aulasData.filter((aula) => aula.EstaAtivo !== false));
            setDisponibilidades(disponibilidadesData);
            setEstudios(estudiosData);
            setEstilos(estilosData);
            setProfessores(
                utilizadoresData.filter((user) => (
                    user.Permissoes === PERMISSOES.PROFESSOR &&
                    user.EstaAtivo !== false &&
                    (user.Professor || user.ProfessorValido === 1)
                ))
            );
        } catch (err) {
            setError(err.message || 'Nao foi possivel carregar os horarios reais.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const startOfWeek = getStartOfWeek(currentDate);
    const weekDays = getDaysOfWeek(startOfWeek);
    const monthName = startOfWeek.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
    const timeRows = useMemo(() => Array.from({ length: 17 }, (_, index) => index + 7), []);

    const recurrencePreviewDates = useMemo(
        () => buildRecurringDates(formData.date, formData.repeatMode, formData.repeatUntil),
        [formData.date, formData.repeatMode, formData.repeatUntil]
    );

    const effectiveEndTime = useMemo(
        () => formData.endTime || (formData.duration ? computeEndTime(formData.startTime, formData.duration) : ''),
        [formData.duration, formData.endTime, formData.startTime]
    );

    const availableTeachers = useMemo(() => professores.filter((teacher) => {
        const styleIds = getRelationStyleIds(teacher.Professor?.EstiloProfessor);

        if (!formData.style) {
            return true;
        }

        if (!styleIds.includes(formData.style)) {
            return false;
        }

        if (!formData.date) {
            return true;
        }

        const disponibilidadesDoDia = disponibilidades.filter((entry) => (
            entry.IdProfessor === teacher.IdUtilizador &&
            getDateKey(entry.Data) === formData.date
        ));

        if (disponibilidadesDoDia.length === 0) {
            return false;
        }

        if (!formData.startTime || !effectiveEndTime) {
            return true;
        }

        const inicioAula = toMinutes(formData.startTime);
        const fimAula = toMinutes(effectiveEndTime);

        return disponibilidadesDoDia.some((entry) => {
            const inicioDisponivel = toMinutes(formatTime(entry.HoraInicio));
            const fimDisponivel = toMinutes(formatTime(entry.HoraFim));
            return inicioAula >= inicioDisponivel && fimAula <= fimDisponivel;
        });
    }), [disponibilidades, effectiveEndTime, formData.date, formData.startTime, formData.style, professores]);

    const availableStudios = useMemo(() => estudios.filter((studio) => {
        if (!formData.style) {
            return true;
        }

        const styleIds = getRelationStyleIds(studio.EstudioEstilo);
        return styleIds.includes(formData.style);
    }), [estudios, formData.style]);

    useEffect(() => {
        if (formData.teacher && !availableTeachers.some((teacher) => teacher.IdUtilizador === formData.teacher)) {
            setFormData((prev) => ({ ...prev, teacher: '' }));
        }

        if (formData.studio && !availableStudios.some((studio) => studio.IdEstudio === formData.studio)) {
            setFormData((prev) => ({ ...prev, studio: '' }));
        }
    }, [availableStudios, availableTeachers, formData.studio, formData.teacher]);

    const scheduleItems = useMemo(() => aulas.map((aula) => {
        const lessonDate = new Date(aula.Data);
        const startMinutes = toMinutes(aula.HoraInicio);
        const endMinutes = toMinutes(aula.HoraFim);
        const studioLabel = aula.Estudio?.Numero ? `Estudio ${aula.Estudio.Numero}` : aula.IdEstudio;
        const duration = Math.max(endMinutes - startMinutes, 30);

        return {
            id: aula.IdAula,
            dateKey: getDateKey(lessonDate),
            time: formatTime(aula.HoraInicio),
            timeRange: formatTimeRange(aula.HoraInicio, aula.HoraFim),
            duration,
            startMinutes,
            endMinutes: Math.max(endMinutes, startMinutes + 30),
            teacher: aula.Professor?.Utilizador?.NomeCompleto || aula.IdProfessor,
            style: aula.EstiloDanca?.Nome || 'Sem estilo',
            lessonType: aula.TipoAula || 'Regular',
            studio: studioLabel,
            capacity: aula.CapacidadeMaxima,
            enrolled: (aula.Marcacao || []).length,
            confirmed: Boolean(aula.ConfirmacaoProfessor),
            validated: Boolean(aula.ValidacaoDirecao),
            dateLabel: formatDate(aula.Data)
        };
    }), [aulas]);

    const clearMessages = () => {
        setError('');
        setFeedback('');
        setOperationSummary(null);
    };

    const resetImportForm = () => {
        setImportForm(getInitialImportForm());
        setImportInputKey((prev) => prev + 1);
    };

    const openLessonModal = (day = new Date(), options = {}) => {
        const dateValue = toDateInputValue(day);

        setFormData({
            ...initialForm,
            date: dateValue,
            lessonType: options.forceRegular ? 'Regular' : initialForm.lessonType,
            repeatMode: options.forceRegular ? 'weekly' : 'none'
        });
        setIsQuickBookOpen(true);
        setActiveAction(options.forceRegular ? 'regular' : activeAction);
        clearMessages();
    };

    const handleQuickBook = (day) => {
        openLessonModal(day);
    };

    const handleOpenLessonDetails = (lesson) => {
        setSelectedLesson(lesson);
    };

    const handleCloseLessonDetails = () => {
        setSelectedLesson(null);
    };

    const handleOpenRegularCreator = () => {
        setActiveAction('regular');
        openLessonModal(new Date(), { forceRegular: true });
    };

    const handleDurationClick = (minutes) => {
        setFormData((prev) => ({
            ...prev,
            duration: String(minutes),
            endTime: prev.startTime ? computeEndTime(prev.startTime, minutes) : ''
        }));
    };

    const handleEndTimeChange = (value) => {
        setFormData((prev) => ({
            ...prev,
            endTime: value,
            duration: ''
        }));
    };

    const prevWeek = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(currentDate.getDate() - 7);
        setCurrentDate(newDate);
    };

    const nextWeek = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(currentDate.getDate() + 7);
        setCurrentDate(newDate);
    };

    const goToToday = () => {
        setCurrentDate(new Date());
    };

    const buildLessonPayloadsFromForm = (effectiveEndTime) => recurrencePreviewDates.map((dateValue) => ({
        Data: dateValue,
        HoraInicio: buildIsoTime(dateValue, formData.startTime),
        HoraFim: buildIsoTime(dateValue, effectiveEndTime),
        CapacidadeMaxima: Number(formData.capacity),
        Preco: 0,
        TipoAula: formData.lessonType || 'Regular',
        IdProfessor: formData.teacher,
        IdEstudio: formData.studio,
        IdEstiloDanca: formData.style,
        Referencia: `${dateValue} ${formData.startTime}`
    }));

    const handleSubmit = async () => {
        if (!formData.date || !formData.teacher || !formData.style || !formData.capacity || !formData.startTime || !formData.studio) {
            setError('Preenche todos os campos obrigatorios.');
            return;
        }

        if (formData.repeatMode !== 'none' && !formData.repeatUntil) {
            setError('Define a data final da recorrencia.');
            return;
        }

        if (formData.repeatMode !== 'none') {
            const repeatUntil = parseDateInput(formData.repeatUntil);
            const firstDate = parseDateInput(formData.date);
            if (!repeatUntil || !firstDate || repeatUntil < firstDate) {
                setError('A data final da recorrencia tem de ser igual ou posterior a data inicial.');
                return;
            }
        }

        const capacity = Number(formData.capacity);
        if (!Number.isInteger(capacity) || capacity < 1) {
            setError('Indica um numero valido de vagas.');
            return;
        }

        if (!effectiveEndTime) {
            setError('Indica a hora de fim ou uma duracao.');
            return;
        }

        if (toMinutes(effectiveEndTime) <= toMinutes(formData.startTime)) {
            setError('A hora de fim tem de ser posterior a hora de inicio.');
            return;
        }

        const payloads = buildLessonPayloadsFromForm(effectiveEndTime);

        if (payloads.length > 500) {
            setError('A serie excede o limite de 500 aulas. Reduz o intervalo.');
            return;
        }

        setSaving(true);
        clearMessages();

        try {
            const result = payloads.length === 1
                ? normalizeBatchResult(await criarAula(payloads[0]))
                : normalizeBatchResult(await criarAulasEmLote({ Aulas: payloads }));

            setOperationSummary(result);

            if (result.totalCriadas > 0) {
                await refreshSnapshot();
                notify({
                    title: result.totalCriadas === 1 ? 'Aula criada' : 'Serie criada',
                    message: result.totalCriadas === 1
                        ? `A aula foi marcada para ${formatDate(formData.date)}.`
                        : `${result.totalCriadas} aulas foram adicionadas ao horario.`,
                    tone: 'success'
                });
                setFeedback(
                    result.totalCriadas === 1
                        ? `Aula agendada com sucesso para ${formatDate(formData.date)}.`
                        : `${result.totalCriadas} aulas criadas com sucesso.`
                );
                await loadData();
            }

            if (result.totalFalhas > 0) {
                setError(`${result.totalFalhas} aula(s) nao foram criadas. Consulta o resumo abaixo.`);
            }

            if (result.totalCriadas > 0) {
                setIsQuickBookOpen(false);
                setFormData(initialForm);
            }
        } catch (err) {
            setError(err.message || 'Nao foi possivel agendar a aula.');
        } finally {
            setSaving(false);
        }
    };

    const prepareImportedLessons = (rows) => {
        const rangeStart = parseDateInput(importForm.startDate);
        const rangeEnd = parseDateInput(importForm.endDate);

        if (!rangeStart || !rangeEnd) {
            throw new Error('Define o intervalo de datas para a importacao.');
        }

        if (rangeEnd < rangeStart) {
            throw new Error('A data final da importacao tem de ser posterior a data inicial.');
        }

        const lessons = [];
        const rowErrors = [];

        rows.forEach((row) => {
            try {
                const startTime = normalizeTimeValue(readRowValue(row, FIELD_ALIASES.horaInicio));
                const endTime = normalizeTimeValue(readRowValue(row, FIELD_ALIASES.horaFim));

                if (!startTime || !endTime) {
                    throw new Error('HoraInicio e HoraFim sao obrigatorias e devem ter formato HH:MM.');
                }

                if (toMinutes(endTime) <= toMinutes(startTime)) {
                    throw new Error('HoraFim tem de ser posterior a HoraInicio.');
                }

                const capacityValue = readRowValue(row, FIELD_ALIASES.capacidade) || importForm.defaultCapacity;
                const priceValue = readRowValue(row, FIELD_ALIASES.preco) || importForm.defaultPrice || '0';
                const lessonTypeValue = readRowValue(row, FIELD_ALIASES.tipoAula) || importForm.defaultLessonType;

                const capacity = Number(capacityValue);
                const price = Number(String(priceValue).replace(',', '.'));

                if (!Number.isInteger(capacity) || capacity < 1) {
                    throw new Error('Capacidade invalida.');
                }

                if (!Number.isFinite(price) || price < 0) {
                    throw new Error('Preco invalido.');
                }

                const teacherValue = readRowValue(row, FIELD_ALIASES.professorId) || readRowValue(row, FIELD_ALIASES.professor) || importForm.defaultTeacher;
                const studioValue = readRowValue(row, FIELD_ALIASES.estudioId) || readRowValue(row, FIELD_ALIASES.estudio) || importForm.defaultStudio;
                const styleValue = readRowValue(row, FIELD_ALIASES.estiloId) || readRowValue(row, FIELD_ALIASES.estilo) || importForm.defaultStyle;

                const teacherId = resolveProfessorId(teacherValue, professores);
                const studioId = resolveStudioId(studioValue, estudios);
                const styleId = resolveStyleId(styleValue, estilos);

                if (!teacherId) {
                    throw new Error('Professor nao encontrado.');
                }

                if (!studioId) {
                    throw new Error('Estudio nao encontrado.');
                }

                if (!styleId) {
                    throw new Error('Estilo nao encontrado.');
                }

                const dates = buildImportDates(importForm.cadence, row, rangeStart, rangeEnd);

                if (dates.length === 0) {
                    throw new Error('A linha nao gera aulas dentro do intervalo selecionado.');
                }

                dates.forEach((dateValue) => {
                    lessons.push({
                        Data: dateValue,
                        HoraInicio: buildIsoTime(dateValue, startTime),
                        HoraFim: buildIsoTime(dateValue, endTime),
                        CapacidadeMaxima: capacity,
                        Preco: price,
                        TipoAula: resolveLessonType(lessonTypeValue, importForm.defaultLessonType),
                        IdProfessor: teacherId,
                        IdEstudio: studioId,
                        IdEstiloDanca: styleId,
                        Referencia: `Linha ${row.__line} - ${dateValue} ${startTime}`
                    });
                });
            } catch (rowError) {
                rowErrors.push({
                    indice: row.__line,
                    referencia: `Linha ${row.__line}`,
                    mensagem: rowError.message || 'Linha invalida.'
                });
            }
        });

        return { lessons, rowErrors };
    };

    const handleImport = async () => {
        if (!importForm.file) {
            setError('Seleciona um ficheiro CSV para importar.');
            return;
        }

        setImporting(true);
        clearMessages();

        try {
            const fileText = await importForm.file.text();
            const rows = parseCsvText(fileText);
            const { lessons, rowErrors } = prepareImportedLessons(rows);

            if (lessons.length === 0) {
                setOperationSummary({
                    mensagem: 'Nenhuma aula valida encontrada no ficheiro.',
                    totalRecebidas: 0,
                    totalCriadas: 0,
                    totalFalhas: rowErrors.length,
                    aulas: [],
                    erros: rowErrors
                });
                setError('Nenhuma aula valida encontrada no ficheiro. Corrige o CSV e tenta novamente.');
                return;
            }

            if (lessons.length > 1000) {
                setError('A importacao excede o limite de 1000 aulas. Divide o ficheiro e tenta novamente.');
                return;
            }

            const result = normalizeBatchResult(await criarAulasEmLote({ Aulas: lessons }));
            const combinedErrors = [...rowErrors, ...(result.erros || [])];
            const summary = {
                ...result,
                erros: combinedErrors,
                totalFalhas: combinedErrors.length
            };

            setOperationSummary(summary);

            if (result.totalCriadas > 0) {
                await refreshSnapshot();
                notify({
                    title: 'Importacao concluida',
                    message: `${result.totalCriadas} aula(s) criadas a partir do ficheiro.`,
                    tone: 'success'
                });
                setFeedback(`Importacao concluida com ${result.totalCriadas} aula(s) criada(s).`);
                await loadData();
                setImportForm((prev) => ({ ...prev, file: null }));
                setImportInputKey((prev) => prev + 1);
            }

            if (combinedErrors.length > 0) {
                setError(`${combinedErrors.length} entrada(s) ficaram por criar. Consulta o resumo abaixo.`);
            }
        } catch (err) {
            setError(err.message || 'Nao foi possivel importar o ficheiro.');
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="schedule-page">
            <div className="schedule-header">
                <div>
                    <p className="schedule-eyebrow">Direcao</p>
                    <h1>Gestao de Horarios</h1>
                    <p className="schedule-subtitle">
                        Cria aulas regulares, importa horarios em CSV e acompanha o calendario semanal.
                    </p>
                </div>
                <button type="button" className="schedule-button schedule-button--primary" onClick={() => openLessonModal(new Date())}>
                    Nova Aula
                </button>
            </div>

            {feedback && <div className="schedule-banner schedule-banner--success">{feedback}</div>}
            {error && <div className="schedule-banner schedule-banner--error">{error}</div>}

            <div className="schedule-actions-grid">
                <article className={`schedule-action-card ${activeAction === 'regular' ? 'schedule-action-card--active' : ''}`}>
                    <p className="schedule-eyebrow">Menu</p>
                    <h2>Criar aulas regulares</h2>
                    <p className="schedule-action-copy">
                        Agenda uma aula unica ou cria series semanais, mensais e anuais para a Direcao.
                    </p>
                    <button type="button" className="schedule-button schedule-button--primary" onClick={handleOpenRegularCreator}>
                        Abrir criador
                    </button>
                </article>

                <article className={`schedule-action-card ${activeAction === 'import' ? 'schedule-action-card--active' : ''}`}>
                    <p className="schedule-eyebrow">Menu</p>
                    <h2>Importar horario</h2>
                    <p className="schedule-action-copy">
                        Carrega um ficheiro CSV com datas especificas ou com regras semanais, mensais ou anuais.
                    </p>
                    <button type="button" className="schedule-button schedule-button--ghost" onClick={() => setActiveAction('import')}>
                        Configurar importacao
                    </button>
                </article>
            </div>

            {activeAction === 'import' && (
                <section className="schedule-import-panel">
                    <div className="schedule-import-header">
                        <div>
                            <p className="schedule-eyebrow">Importacao</p>
                            <h2>Carregar ficheiro de horario</h2>
                            <p className="schedule-subtitle">
                                Usa CSV com `;` ou `,`. Podes indicar professor, estudio e estilo por nome/numero ou por id.
                            </p>
                        </div>
                        <button type="button" className="schedule-button schedule-button--ghost" onClick={() => setActiveAction('regular')}>
                            Fechar
                        </button>
                    </div>

                    <div className="schedule-segmented">
                        {[
                            { id: 'specific', label: 'Datas especificas' },
                            { id: 'weekly', label: 'Semanal' },
                            { id: 'monthly', label: 'Mensal' },
                            { id: 'annual', label: 'Anual' }
                        ].map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                className={`schedule-segment ${importForm.cadence === option.id ? 'schedule-segment--active' : ''}`}
                                onClick={() => setImportForm((prev) => ({ ...prev, cadence: option.id }))}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    <p className="schedule-helper">
                        {getImportTemplateCopy(importForm.cadence)}
                    </p>

                    <div className="schedule-form">
                        <div className="schedule-form-grid">
                            <label>
                                <span>Data inicial *</span>
                                <input
                                    type="date"
                                    value={importForm.startDate}
                                    onChange={(event) => setImportForm((prev) => ({ ...prev, startDate: event.target.value }))}
                                />
                            </label>

                            <label>
                                <span>Data final *</span>
                                <input
                                    type="date"
                                    value={importForm.endDate}
                                    onChange={(event) => setImportForm((prev) => ({ ...prev, endDate: event.target.value }))}
                                />
                            </label>
                        </div>

                        <div className="schedule-form-grid">
                            <label>
                                <span>Professor por defeito</span>
                                <select value={importForm.defaultTeacher} onChange={(event) => setImportForm((prev) => ({ ...prev, defaultTeacher: event.target.value }))}>
                                    <option value="">Usar o ficheiro</option>
                                    {professores.map((teacher) => (
                                        <option key={teacher.IdUtilizador} value={teacher.IdUtilizador}>
                                            {teacher.NomeCompleto}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label>
                                <span>Estudio por defeito</span>
                                <select value={importForm.defaultStudio} onChange={(event) => setImportForm((prev) => ({ ...prev, defaultStudio: event.target.value }))}>
                                    <option value="">Usar o ficheiro</option>
                                    {estudios.map((studio) => (
                                        <option key={studio.IdEstudio} value={studio.IdEstudio}>
                                            Estudio {studio.Numero}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <div className="schedule-form-grid">
                            <label>
                                <span>Estilo por defeito</span>
                                <select value={importForm.defaultStyle} onChange={(event) => setImportForm((prev) => ({ ...prev, defaultStyle: event.target.value }))}>
                                    <option value="">Usar o ficheiro</option>
                                    {estilos.map((style) => (
                                        <option key={style.IdEstiloDanca} value={style.IdEstiloDanca}>
                                            {style.Nome}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label>
                                <span>Tipo de aula por defeito</span>
                                <select value={importForm.defaultLessonType} onChange={(event) => setImportForm((prev) => ({ ...prev, defaultLessonType: event.target.value }))}>
                                    <option value="Regular">Regular</option>
                                    <option value="Particular">Particular</option>
                                </select>
                            </label>
                        </div>

                        <div className="schedule-form-grid">
                            <label>
                                <span>Capacidade por defeito</span>
                                <input
                                    type="number"
                                    min="1"
                                    value={importForm.defaultCapacity}
                                    onChange={(event) => setImportForm((prev) => ({ ...prev, defaultCapacity: event.target.value }))}
                                    placeholder="Ex: 12"
                                />
                            </label>

                            <label>
                                <span>Preco por defeito</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={importForm.defaultPrice}
                                    onChange={(event) => setImportForm((prev) => ({ ...prev, defaultPrice: event.target.value }))}
                                    placeholder="0"
                                />
                            </label>
                        </div>

                        <label>
                            <span>Ficheiro CSV *</span>
                            <input
                                key={importInputKey}
                                type="file"
                                accept=".csv,text/csv"
                                onChange={(event) => setImportForm((prev) => ({ ...prev, file: event.target.files?.[0] || null }))}
                            />
                        </label>
                    </div>

                    <div className="schedule-modal-actions">
                        <button type="button" className="schedule-button schedule-button--ghost" onClick={resetImportForm}>
                            Limpar
                        </button>
                        <button type="button" className="schedule-button schedule-button--primary" onClick={handleImport} disabled={importing}>
                            {importing ? 'A importar...' : 'Importar horario'}
                        </button>
                    </div>
                </section>
            )}

            {operationSummary && (
                <section className="schedule-summary">
                    <div className="schedule-summary-head">
                        <div>
                            <p className="schedule-eyebrow">Resumo</p>
                            <h2>{operationSummary.mensagem}</h2>
                        </div>
                        <div className="schedule-summary-metrics">
                            <span>{operationSummary.totalCriadas} criada(s)</span>
                            <span>{operationSummary.totalFalhas} falha(s)</span>
                        </div>
                    </div>

                    {operationSummary.erros?.length > 0 && (
                        <ul className="schedule-summary-list">
                            {operationSummary.erros.slice(0, 8).map((item, index) => (
                                <li key={`${item.referencia || 'erro'}-${index}`}>
                                    <strong>{item.referencia || `Entrada ${index + 1}`}</strong>
                                    <span>{item.mensagem}</span>
                                </li>
                            ))}
                            {operationSummary.erros.length > 8 && (
                                <li>
                                    <strong>Mais erros</strong>
                                    <span>{operationSummary.erros.length - 8} entrada(s) adicionais nao foram mostradas.</span>
                                </li>
                            )}
                        </ul>
                    )}
                </section>
            )}

            <div className="schedule-shell">
                <div className="schedule-toolbar">
                    <div className="schedule-toolbar-left">
                        <h2 className="capitalize">{monthName}</h2>
                        <div className="schedule-nav">
                            <button type="button" className="schedule-button schedule-button--ghost schedule-button--icon" onClick={prevWeek}>
                                &lt;
                            </button>
                            <button type="button" className="schedule-button schedule-button--ghost" onClick={goToToday}>
                                Semanal
                            </button>
                            <button type="button" className="schedule-button schedule-button--ghost schedule-button--icon" onClick={nextWeek}>
                                &gt;
                            </button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="schedule-empty">
                        <p className="schedule-empty-title">A carregar horarios...</p>
                        <p className="schedule-empty-copy">A preparar aulas, estudios, estilos e professores.</p>
                    </div>
                ) : (
                    <div className="schedule-calendar">
                        <div className="schedule-week-header">
                            <div className="schedule-time-corner" />
                            <div className="schedule-days-row">
                                {weekDays.map((day, index) => {
                                    const isToday = new Date().toDateString() === day.toDateString();
                                    const dayName = day.toLocaleDateString('pt-PT', { weekday: 'short' });

                                    return (
                                        <div key={index} className={`schedule-day-header ${isToday ? 'schedule-day-header--today' : ''}`}>
                                            <span>{dayName}</span>
                                            <strong>{day.getDate()}</strong>
                                            <button type="button" className="schedule-day-add" onClick={() => handleQuickBook(day)}>
                                                +
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="schedule-grid">
                            <div className="schedule-time-column">
                                {timeRows.map((hour) => (
                                    <div key={hour} className="schedule-time-label">
                                        {String(hour).padStart(2, '0')}:00
                                    </div>
                                ))}
                            </div>

                            <div className="schedule-columns">
                                {weekDays.map((day, index) => {
                                    const dayClasses = layoutDayLessons(
                                        scheduleItems.filter((lesson) => lesson.dateKey === getDateKey(day))
                                    );

                                    return (
                                        <div key={index} className="schedule-day-column">
                                            <div className="schedule-hour-lines">
                                                {timeRows.map((hour) => (
                                                    <div key={hour} className="schedule-hour-line" />
                                                ))}
                                            </div>

                                            {dayClasses.map((lesson) => {
                                                const [hours, minutes] = lesson.time.split(':').map(Number);
                                                const topPercentage = Math.max(0, ((hours - 7 + (minutes / 60)) / 17) * 100);
                                                const heightPercentage = ((lesson.duration / 60) / 17) * 100;
                                                const widthPercentage = 100 / lesson.laneCount;
                                                const leftPercentage = lesson.lane * widthPercentage;

                                                return (
                                                    <div
                                                        key={lesson.id}
                                                        className="schedule-lesson-wrap"
                                                        style={{
                                                            top: `${topPercentage}%`,
                                                            height: `${Math.max(heightPercentage, 7)}%`,
                                                            left: `calc(${leftPercentage}% + 4px)`,
                                                            width: `calc(${widthPercentage}% - 8px)`,
                                                            right: 'auto',
                                                            zIndex: lesson.lane + 1
                                                        }}
                                                    >
                                                        <button
                                                            type="button"
                                                            className="schedule-lesson-marker"
                                                            onClick={() => handleOpenLessonDetails(lesson)}
                                                            title={`${lesson.style} | ${lesson.timeRange}`}
                                                        >
                                                            <span className="schedule-lesson-marker-icon" aria-hidden="true" />
                                                            <span className="schedule-lesson-marker-time">{lesson.time}</span>
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {isQuickBookOpen && (
                <div className="schedule-modal-backdrop" onClick={() => setIsQuickBookOpen(false)}>
                    <section className="schedule-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="schedule-modal-header">
                            <div>
                                <p className="schedule-eyebrow">Agendar aula</p>
                                <h2>{formData.date ? formatDate(formData.date) : ''}</h2>
                            </div>
                            <button type="button" className="schedule-button schedule-button--ghost" onClick={() => setIsQuickBookOpen(false)}>
                                Fechar
                            </button>
                        </div>

                        <div className="schedule-form">
                            {error && <div className="schedule-banner schedule-banner--error">{error}</div>}

                            <label>
                                <span>Data da aula *</span>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, date: event.target.value }))}
                                />
                            </label>

                            <label>
                                <span>Estilo de danca *</span>
                                <select value={formData.style} onChange={(event) => setFormData((prev) => ({ ...prev, style: event.target.value }))}>
                                    <option value="">Selecione o estilo</option>
                                    {estilos.map((style) => (
                                        <option key={style.IdEstiloDanca} value={style.IdEstiloDanca}>
                                            {style.Nome}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <div className="schedule-form-grid">
                                <label>
                                    <span>Estudio *</span>
                                    <select
                                        value={formData.studio}
                                        onChange={(event) => setFormData((prev) => ({ ...prev, studio: event.target.value }))}
                                        disabled={!formData.style}
                                    >
                                        <option value="">{formData.style ? 'Selecione o estudio compativel' : 'Escolha primeiro o estilo'}</option>
                                        {availableStudios.map((studio) => (
                                            <option key={studio.IdEstudio} value={studio.IdEstudio}>
                                                Estudio {studio.Numero}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    <span>Professor *</span>
                                    <select
                                        value={formData.teacher}
                                        onChange={(event) => setFormData((prev) => ({ ...prev, teacher: event.target.value }))}
                                        disabled={!formData.style || !formData.date}
                                    >
                                        <option value="">
                                            {formData.style
                                                ? formData.date
                                                    ? 'Selecione o professor disponivel'
                                                    : 'Selecione a data para filtrar a disponibilidade'
                                                : 'Escolha primeiro o estilo'}
                                        </option>
                                        {availableTeachers.map((teacher) => (
                                            <option key={teacher.IdUtilizador} value={teacher.IdUtilizador}>
                                                {teacher.NomeCompleto}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <div className="schedule-form-grid">
                                <label>
                                    <span>Tipo de aula *</span>
                                    <select
                                        value={formData.lessonType}
                                        onChange={(event) => setFormData((prev) => ({ ...prev, lessonType: event.target.value }))}
                                    >
                                        <option value="Regular">Regular</option>
                                        <option value="Particular">Particular</option>
                                    </select>
                                </label>

                                <label>
                                    <span>Recorrencia</span>
                                    <select
                                        value={formData.repeatMode}
                                        onChange={(event) => setFormData((prev) => ({
                                            ...prev,
                                            repeatMode: event.target.value,
                                            repeatUntil: event.target.value === 'none' ? '' : prev.repeatUntil
                                        }))}
                                    >
                                        <option value="none">Nao repetir</option>
                                        <option value="weekly">Semanal</option>
                                        <option value="monthly">Mensal</option>
                                        <option value="annual">Anual</option>
                                    </select>
                                </label>
                            </div>

                            {formData.repeatMode !== 'none' && (
                                <label>
                                    <span>Repetir ate *</span>
                                    <input
                                        type="date"
                                        value={formData.repeatUntil}
                                        onChange={(event) => setFormData((prev) => ({ ...prev, repeatUntil: event.target.value }))}
                                    />
                                </label>
                            )}

                            {formData.repeatMode !== 'none' && (
                                <p className="schedule-helper">
                                    {formData.repeatUntil
                                        ? `Previstas ${recurrencePreviewDates.length} aula(s) nesta serie.`
                                        : 'Escolhe a data final para calcular a serie.'}
                                </p>
                            )}

                            <div className="schedule-form-grid">
                                <label>
                                    <span>Limite de vagas *</span>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.capacity}
                                        onChange={(event) => setFormData((prev) => ({ ...prev, capacity: event.target.value }))}
                                        placeholder="Ex: 12"
                                    />
                                </label>
                                <div />
                            </div>

                            <div className="schedule-form-grid">
                                <label>
                                    <span>Hora de inicio *</span>
                                    <input
                                        type="time"
                                        value={formData.startTime}
                                        onChange={(event) => setFormData((prev) => ({
                                            ...prev,
                                            startTime: event.target.value,
                                            endTime: prev.duration ? computeEndTime(event.target.value, prev.duration) : prev.endTime
                                        }))}
                                    />
                                </label>

                                <label>
                                    <span>Hora de fim</span>
                                    <input
                                        type="time"
                                        value={formData.endTime}
                                        onChange={(event) => handleEndTimeChange(event.target.value)}
                                        disabled={Boolean(formData.duration)}
                                    />
                                </label>
                            </div>

                            <div>
                                <span className="schedule-form-label">Duracao (atalhos)</span>
                                <div className="schedule-duration-list">
                                    {[30, 45, 60, 90].map((duration) => (
                                        <button
                                            key={duration}
                                            type="button"
                                            className={`schedule-button ${formData.duration === String(duration) ? 'schedule-button--primary' : 'schedule-button--ghost'}`}
                                            onClick={() => handleDurationClick(duration)}
                                        >
                                            {duration} min
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {formData.style && availableStudios.length === 0 && (
                                <p className="schedule-helper">
                                    Nao existem estudios associados ao estilo escolhido.
                                </p>
                            )}

                            {formData.style && formData.date && availableTeachers.length === 0 && (
                                <p className="schedule-helper">
                                    Nao existem professores disponiveis para este estilo na data e horario selecionados.
                                </p>
                            )}
                        </div>

                        <div className="schedule-modal-actions">
                            <button type="button" className="schedule-button schedule-button--ghost" onClick={() => setIsQuickBookOpen(false)}>
                                Cancelar
                            </button>
                            <button type="button" className="schedule-button schedule-button--primary" onClick={handleSubmit} disabled={saving}>
                                {saving
                                    ? 'A guardar...'
                                    : formData.repeatMode === 'none'
                                        ? 'Confirmar agendamento'
                                        : 'Criar serie'}
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {selectedLesson && (
                <div className="schedule-modal-backdrop" onClick={handleCloseLessonDetails}>
                    <section className="schedule-modal schedule-modal--detail" onClick={(event) => event.stopPropagation()}>
                        <div className="schedule-modal-header">
                            <div>
                                <p className="schedule-eyebrow">Detalhes da aula</p>
                                <h2>{selectedLesson.style}</h2>
                            </div>
                            <button type="button" className="schedule-button schedule-button--ghost" onClick={handleCloseLessonDetails}>
                                Fechar
                            </button>
                        </div>

                        <div className="schedule-lesson-detail-grid">
                            <div className="schedule-lesson-detail-card">
                                <span>Data</span>
                                <strong>{selectedLesson.dateLabel}</strong>
                            </div>
                            <div className="schedule-lesson-detail-card">
                                <span>Horario</span>
                                <strong>{selectedLesson.timeRange}</strong>
                            </div>
                            <div className="schedule-lesson-detail-card">
                                <span>Professor</span>
                                <strong>{selectedLesson.teacher}</strong>
                            </div>
                            <div className="schedule-lesson-detail-card">
                                <span>Estudio</span>
                                <strong>{selectedLesson.studio}</strong>
                            </div>
                            <div className="schedule-lesson-detail-card">
                                <span>Tipo</span>
                                <strong>{selectedLesson.lessonType}</strong>
                            </div>
                            <div className="schedule-lesson-detail-card">
                                <span>Inscritos</span>
                                <strong>{selectedLesson.enrolled}/{selectedLesson.capacity}</strong>
                            </div>
                            <div className="schedule-lesson-detail-card">
                                <span>Professor confirmou</span>
                                <strong>{selectedLesson.confirmed ? 'Sim' : 'Nao'}</strong>
                            </div>
                            <div className="schedule-lesson-detail-card">
                                <span>Validacao da direcao</span>
                                <strong>{selectedLesson.validated ? 'Concluida' : 'Pendente'}</strong>
                            </div>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default ScheduleManagement;
