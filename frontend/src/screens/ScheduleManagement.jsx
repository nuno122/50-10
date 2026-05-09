import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import {
    atualizarEstadoEstilo,
    atualizarEstadoEstudio,
    atualizarEstilo,
    atualizarEstudio,
    criarAula,
    criarAulasEmLote,
    criarEstilo,
    criarEstudio,
    getAulas,
    getDisponibilidades,
    getEstilos,
    getEstudios,
    getUtilizadores,
    removerEstilo,
    removerEstudio
} from '../services/api';
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
    anchorDate: '',
    dayOfWeek: '1',
    teacher: '',
    teacherSelectionMode: 'compatible',
    style: '',
    lessonType: 'Regular',
    capacity: '',
    startTime: '',
    endTime: '',
    duration: '',
    studio: '',
    studioSelectionMode: 'compatible',
    repeatMode: 'weekly',
    repeatUntil: ''
};

const emptyStyleForm = {
    Nome: ''
};

const emptyStudioForm = {
    Numero: '',
    Capacidade: '',
    IdsEstiloDanca: []
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

const formatLessonTypeLabel = (value) => {
    const normalized = normalizeText(value);
    return normalized.startsWith('part') ? 'Coaching' : 'Regular';
};

const formatTimeRange = (startValue, endValue) => `${formatTime(startValue)} - ${formatTime(endValue)}`;

const WEEKDAY_OPTIONS = [
    { value: '1', label: 'Segunda-feira' },
    { value: '2', label: 'Terca-feira' },
    { value: '3', label: 'Quarta-feira' },
    { value: '4', label: 'Quinta-feira' },
    { value: '5', label: 'Sexta-feira' },
    { value: '6', label: 'Sabado' },
    { value: '0', label: 'Domingo' }
];

const getWeekdayLabel = (value) => (
    WEEKDAY_OPTIONS.find((option) => option.value === String(value))?.label || 'Dia da semana'
);

const getRelationStyleIds = (items = []) => items.map((item) => item.IdEstiloDanca);

const getStudioLinkedStyleIds = (studio) => getRelationStyleIds(studio?.EstudioEstilo || []);

const sortCatalogEntries = (items, secondaryResolver) => (
    [...items].sort((left, right) => {
        const leftActive = left?.EstaAtivo !== false;
        const rightActive = right?.EstaAtivo !== false;

        if (leftActive !== rightActive) {
            return leftActive ? -1 : 1;
        }

        return String(secondaryResolver(left) || '').localeCompare(
            String(secondaryResolver(right) || ''),
            'pt-PT',
            { numeric: true, sensitivity: 'base' }
        );
    })
);

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

const overlaps = (startA, endA, startB, endB) => startA < endB && endA > startB;

const minutesToTime = (value) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

const buildIsoTime = (date, time) => {
    const dayText = typeof date === 'string' ? date.slice(0, 10) : toDateInputValue(date);
    return `${dayText}T${time}:00.000Z`;
};

const buildLessonDateTime = (dateValue, timeValue) => {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return new Date(0);

    const time = formatTime(timeValue);
    const [hours, minutes] = time.split(':').map(Number);
    date.setHours(Number(hours || 0), Number(minutes || 0), 0, 0);
    return date;
};

const getDirectorLessonStatus = (lesson) => {
    if (lesson.validated) return 'Concluida';
    if (lesson.enrolled === 0 && lesson.endDateTime <= new Date()) return 'Expirada sem inscritos';
    if (!lesson.confirmed && lesson.endDateTime <= new Date()) return 'Aguarda conclusão do professor';
    if (!lesson.confirmed) return 'Agendada';
    return 'Aguarda validação da direção';
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

const getNextOccurrenceDateKey = (anchorDateValue, weekdayValue) => {
    const anchorDate = parseDateInput(anchorDateValue) || parseDateInput(toDateInputValue(new Date()));
    const weekday = Number(weekdayValue);

    if (!anchorDate || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
        return '';
    }

    const candidate = new Date(anchorDate);

    while (candidate.getDay() !== weekday) {
        candidate.setDate(candidate.getDate() + 1);
    }

    return toDateInputValue(candidate);
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

const buildAvailableTimeSlots = (availabilityEntries = [], scheduledLessons = [], durationMinutes = 0) => {
    const requiredDuration = Number(durationMinutes || 0);
    const busyIntervals = scheduledLessons
        .map((lesson) => ({
            start: toMinutes(formatTime(lesson.HoraInicio)),
            end: toMinutes(formatTime(lesson.HoraFim))
        }))
        .filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start)
        .sort((left, right) => left.start - right.start);

    const freeIntervals = [];

    availabilityEntries.forEach((entry) => {
        const entryStart = toMinutes(formatTime(entry.HoraInicio));
        const entryEnd = toMinutes(formatTime(entry.HoraFim));

        if (!Number.isFinite(entryStart) || !Number.isFinite(entryEnd) || entryEnd <= entryStart) {
            return;
        }

        let segments = [{ start: entryStart, end: entryEnd }];

        busyIntervals.forEach((busyInterval) => {
            segments = segments.flatMap((segment) => {
                if (busyInterval.end <= segment.start || busyInterval.start >= segment.end) {
                    return [segment];
                }

                const nextSegments = [];

                if (busyInterval.start > segment.start) {
                    nextSegments.push({
                        start: segment.start,
                        end: Math.min(busyInterval.start, segment.end)
                    });
                }

                if (busyInterval.end < segment.end) {
                    nextSegments.push({
                        start: Math.max(busyInterval.end, segment.start),
                        end: segment.end
                    });
                }

                return nextSegments;
            });
        });

        segments
            .filter((segment) => (segment.end - segment.start) >= requiredDuration)
            .forEach((segment) => {
                freeIntervals.push({
                    key: `${getDateKey(entry.Data)}-${segment.start}-${segment.end}`,
                    startTime: minutesToTime(segment.start),
                    endTime: minutesToTime(segment.end)
                });
            });
    });

    return freeIntervals.sort((left, right) => left.startTime.localeCompare(right.startTime));
};

const getStudioOptions = ({ estudios, aulas, formData, scheduleDates, effectiveEndTime }) => {
    const capacity = Number(formData.capacity || 0);
    const startMinutes = toMinutes(formData.startTime);
    const endMinutes = toMinutes(effectiveEndTime);
    const hasValidWindow = Boolean(formData.startTime && effectiveEndTime && endMinutes > startMinutes);
    const datesToCheck = scheduleDates.length > 0 ? scheduleDates : (formData.date ? [formData.date] : []);

    const allAvailableOptions = (estudios || []).filter((studio) => {
        if (capacity > 0 && Number(studio.Capacidade || 0) < capacity) {
            return false;
        }

        if (!hasValidWindow || datesToCheck.length === 0) {
            return true;
        }

        return datesToCheck.every((dateKey) => !(aulas || []).some((aula) => (
            aula.EstaAtivo !== false &&
            aula.IdEstudio === studio.IdEstudio &&
            getDateKey(aula.Data) === dateKey &&
            overlaps(
                startMinutes,
                endMinutes,
                toMinutes(formatTime(aula.HoraInicio)),
                toMinutes(formatTime(aula.HoraFim))
            )
        )));
    });

    const compatibleOptions = allAvailableOptions.filter((studio) => (
        getRelationStyleIds(studio.EstudioEstilo).includes(formData.style)
    ));

    return {
        compatibleOptions,
        allAvailableOptions,
        alternativeOptions: allAvailableOptions.filter((studio) => (
            !compatibleOptions.some((compatibleStudio) => compatibleStudio.IdEstudio === studio.IdEstudio)
        ))
    };
};

const getDirectorLessonStatusTone = (lesson) => {
    if (lesson.validated) return 'success';
    if (!lesson.confirmed && lesson.endDateTime <= new Date()) return 'warning';
    if (!lesson.confirmed) return 'neutral';
    return 'info';
};

const groupDayLessonsBySlot = (lessons) => {
    const sortedLessons = [...lessons].sort((left, right) => {
        if (left.startMinutes !== right.startMinutes) {
            return left.startMinutes - right.startMinutes;
        }

        if (left.endMinutes !== right.endMinutes) {
            return left.endMinutes - right.endMinutes;
        }

        return String(left.id).localeCompare(String(right.id));
    });

    return sortedLessons.reduce((groups, lesson) => {
        const key = `${lesson.startMinutes}-${lesson.endMinutes}`;
        const currentGroup = groups[groups.length - 1];

        if (!currentGroup || currentGroup.key !== key) {
            groups.push({
                key,
                timeRange: lesson.timeRange,
                lessons: [lesson]
            });
            return groups;
        }

        currentGroup.lessons.push(lesson);
        return groups;
    }, []);
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
    return normalized.startsWith('part') || normalized.startsWith('coach') ? 'Particular' : 'Regular';
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

const buildFailureSummaryMessage = (count, errors = []) => {
    const fallback = `${count} aula(s) nao foram criadas. Consulta o resumo abaixo.`;
    const firstError = errors[0];

    if (!firstError) {
        return fallback;
    }

    const reference = firstError.referencia ? `${firstError.referencia}: ` : '';
    const message = String(firstError.mensagem || 'Falha na criacao.').replace(/[.]+$/, '');
    const suffix = errors.length > 1 ? ` Mais ${errors.length - 1} falha(s) no resumo.` : '';

    return `${count} aula(s) nao foram criadas. ${reference}${message}.${suffix}`;
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
        return 'Colunas obrigatórias: diaSemana, horaInicio, horaFim, professor/professorId, estudio/estudioId, estilo/estiloId, capacidade, tipoAula, preco';
    }

    if (cadence === 'monthly') {
        return 'Colunas obrigatórias: diaMes, horaInicio, horaFim, professor/professorId, estudio/estudioId, estilo/estiloId, capacidade, tipoAula, preco';
    }

    if (cadence === 'annual') {
        return 'Colunas obrigatórias: mes, diaMes, horaInicio, horaFim, professor/professorId, estudio/estudioId, estilo/estiloId, capacidade, tipoAula, preco';
    }

    return 'Colunas obrigatórias: data, horaInicio, horaFim, professor/professorId, estudio/estudioId, estilo/estiloId, capacidade, tipoAula, preco';
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
    const [catalogSaving, setCatalogSaving] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');
    const [operationSummary, setOperationSummary] = useState(null);
    const [selectedLesson, setSelectedLesson] = useState(null);
    const [styleForm, setStyleForm] = useState(emptyStyleForm);
    const [studioForm, setStudioForm] = useState(emptyStudioForm);
    const [editingStyleId, setEditingStyleId] = useState('');
    const [editingStudioId, setEditingStudioId] = useState('');
    const operationSummaryRef = useRef(null);

    const fetchCatalogData = async () => {
        const [estudiosData, estilosData] = await Promise.all([
            getEstudios({ incluirInativos: true }),
            getEstilos({ incluirInativos: true })
        ]);

        return {
            estudiosData,
            estilosData
        };
    };

    const applyCatalogData = ({ estudiosData, estilosData }) => {
        setEstudios(estudiosData || []);
        setEstilos(estilosData || []);
    };

    const reloadCatalog = async () => {
        const catalogData = await fetchCatalogData();
        applyCatalogData(catalogData);
    };

    const loadData = async () => {
        setLoading(true);
        setError('');

        try {
            const [aulasData, disponibilidadesData, catalogData, utilizadoresData] = await Promise.all([
                getAulas(),
                getDisponibilidades(),
                fetchCatalogData(),
                getUtilizadores()
            ]);

            setAulas(aulasData.filter((aula) => aula.EstaAtivo !== false));
            setDisponibilidades(disponibilidadesData);
            applyCatalogData(catalogData);
            setProfessores(
                utilizadoresData.filter((user) => (
                    user.Permissoes === PERMISSOES.PROFESSOR &&
                    user.EstaAtivo !== false &&
                    (user.Professor || user.ProfessorValido === 1)
                ))
            );
        } catch (err) {
            setError(err.message || 'Não foi possível carregar os horários reais.');
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
    const isCoaching = formData.lessonType === 'Particular';
    const activeEstudios = useMemo(
        () => estudios.filter((studio) => studio.EstaAtivo !== false),
        [estudios]
    );
    const activeEstilos = useMemo(
        () => estilos.filter((style) => style.EstaAtivo !== false),
        [estilos]
    );
    const configStyles = useMemo(
        () => sortCatalogEntries(estilos, (style) => style.Nome),
        [estilos]
    );
    const configStudios = useMemo(
        () => sortCatalogEntries(estudios, (studio) => studio.Numero),
        [estudios]
    );
    const regularFirstOccurrence = useMemo(
        () => getNextOccurrenceDateKey(formData.anchorDate || toDateInputValue(new Date()), formData.dayOfWeek),
        [formData.anchorDate, formData.dayOfWeek]
    );
    const scheduleReferenceDate = isCoaching ? formData.date : regularFirstOccurrence;

    const recurrencePreviewDates = useMemo(() => {
        if (isCoaching) {
            return formData.date ? [formData.date] : [];
        }

        if (!regularFirstOccurrence) {
            return [];
        }

        if (!formData.repeatUntil) {
            return [regularFirstOccurrence];
        }

        return buildRecurringDates(regularFirstOccurrence, 'weekly', formData.repeatUntil);
    }, [formData.date, formData.repeatUntil, isCoaching, regularFirstOccurrence]);

    const effectiveEndTime = useMemo(
        () => formData.endTime || (formData.duration ? computeEndTime(formData.startTime, formData.duration) : ''),
        [formData.duration, formData.endTime, formData.startTime]
    );

    const teacherState = useMemo(() => {
        const compatibleOptions = professores.filter((teacher) => {
            const styleIds = getRelationStyleIds(teacher.Professor?.EstiloProfessor);

            if (!formData.style) {
                return true;
            }

            if (!styleIds.includes(formData.style)) {
                return false;
            }

            if (!isCoaching || !formData.date) {
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
            const aulasDoProfessor = aulas.filter((aula) => (
                aula.EstaAtivo !== false &&
                aula.IdProfessor === teacher.IdUtilizador &&
                getDateKey(aula.Data) === formData.date
            ));

            const temConflito = aulasDoProfessor.some((aula) => overlaps(
                inicioAula,
                fimAula,
                toMinutes(formatTime(aula.HoraInicio)),
                toMinutes(formatTime(aula.HoraFim))
            ));

            if (temConflito) {
                return false;
            }

            return disponibilidadesDoDia.some((entry) => {
                const inicioDisponivel = toMinutes(formatTime(entry.HoraInicio));
                const fimDisponivel = toMinutes(formatTime(entry.HoraFim));
                return inicioAula >= inicioDisponivel && fimAula <= fimDisponivel;
            });
        });

        const allAvailableOptions = isCoaching ? compatibleOptions : professores;

        return {
            compatibleOptions,
            allAvailableOptions,
            alternativeOptions: allAvailableOptions.filter((teacher) => (
                !compatibleOptions.some((compatibleTeacher) => compatibleTeacher.IdUtilizador === teacher.IdUtilizador)
            ))
        };
    }, [aulas, disponibilidades, effectiveEndTime, formData.date, formData.startTime, formData.style, isCoaching, professores]);

    const coachingTeacherAvailability = useMemo(() => {
        if (!isCoaching || !formData.teacher || !formData.date) {
            return [];
        }

        return disponibilidades.filter((entry) => (
            entry.IdProfessor === formData.teacher &&
            getDateKey(entry.Data) === formData.date
        ));
    }, [disponibilidades, formData.date, formData.teacher, isCoaching]);

    const coachingTeacherLessons = useMemo(() => {
        if (!isCoaching || !formData.teacher || !formData.date) {
            return [];
        }

        return aulas.filter((aula) => (
            aula.EstaAtivo !== false &&
            aula.IdProfessor === formData.teacher &&
            getDateKey(aula.Data) === formData.date
        ));
    }, [aulas, formData.date, formData.teacher, isCoaching]);

    const availableTimeSlots = useMemo(() => (
        isCoaching
            ? buildAvailableTimeSlots(coachingTeacherAvailability, coachingTeacherLessons, Number(formData.duration || 0))
            : []
    ), [coachingTeacherAvailability, coachingTeacherLessons, formData.duration, isCoaching]);

    const studioState = useMemo(() => (
        getStudioOptions({
            estudios: activeEstudios,
            aulas,
            formData,
            scheduleDates: recurrencePreviewDates,
            effectiveEndTime
        })
    ), [activeEstudios, aulas, effectiveEndTime, formData, recurrencePreviewDates]);

    const selectedTeacherName = useMemo(() => (
        professores.find((teacher) => teacher.IdUtilizador === formData.teacher)?.NomeCompleto || 'O professor selecionado'
    ), [formData.teacher, professores]);

    const hasCompatibleTeacherSelection = teacherState.compatibleOptions.some((teacher) => teacher.IdUtilizador === formData.teacher);
    const hasAvailableTeacherSelection = teacherState.allAvailableOptions.some((teacher) => teacher.IdUtilizador === formData.teacher);
    const canUnlockAlternativeTeacher = !isCoaching && teacherState.alternativeOptions.length > 0;
    const teacherSelectionMode = !isCoaching && formData.teacherSelectionMode === 'alternative'
        ? 'alternative'
        : hasCompatibleTeacherSelection
            ? 'compatible'
            : hasAvailableTeacherSelection && !isCoaching
                ? 'alternative'
                : 'compatible';
    const selectedTeacherId = hasAvailableTeacherSelection ? formData.teacher : '';
    const showAlternativeTeacherSelector = !isCoaching &&
        teacherSelectionMode === 'alternative' &&
        canUnlockAlternativeTeacher &&
        teacherState.allAvailableOptions.length > 0;

    const hasCompatibleStudioSelection = studioState.compatibleOptions.some((studio) => studio.IdEstudio === formData.studio);
    const hasAvailableStudioSelection = studioState.allAvailableOptions.some((studio) => studio.IdEstudio === formData.studio);
    const canUnlockAlternativeStudio = studioState.alternativeOptions.length > 0 || studioState.compatibleOptions.length === 0;
    const studioSelectionMode = formData.studioSelectionMode === 'alternative'
        ? 'alternative'
        : hasCompatibleStudioSelection
            ? 'compatible'
            : hasAvailableStudioSelection
                ? 'alternative'
                : 'compatible';
    const selectedStudioId = hasAvailableStudioSelection ? formData.studio : '';
    const showAlternativeStudioSelector = studioSelectionMode === 'alternative' && canUnlockAlternativeStudio && studioState.allAvailableOptions.length > 0;
    const canSelectTeacher = Boolean(formData.style && (!isCoaching || formData.date));
    const canSelectStudio = Boolean(formData.style && formData.capacity && formData.startTime && effectiveEndTime && recurrencePreviewDates.length > 0);

    useEffect(() => {
        if (formData.teacher && !teacherState.allAvailableOptions.some((teacher) => teacher.IdUtilizador === formData.teacher)) {
            setFormData((prev) => ({
                ...prev,
                teacher: '',
                teacherSelectionMode: 'compatible'
            }));
        }

        if (formData.studio && !studioState.allAvailableOptions.some((studio) => studio.IdEstudio === formData.studio)) {
            setFormData((prev) => ({
                ...prev,
                studio: '',
                studioSelectionMode: 'compatible'
            }));
        }
    }, [formData.studio, formData.teacher, studioState.allAvailableOptions, teacherState.allAvailableOptions]);

    useEffect(() => {
        const validStyleIds = new Set(activeEstilos.map((style) => style.IdEstiloDanca));

        if (formData.style && !validStyleIds.has(formData.style)) {
            setFormData((prev) => ({
                ...prev,
                style: '',
                teacher: '',
                studio: '',
                teacherSelectionMode: 'compatible',
                studioSelectionMode: 'compatible'
            }));
        }

        if (importForm.defaultStyle && !validStyleIds.has(importForm.defaultStyle)) {
            setImportForm((prev) => ({
                ...prev,
                defaultStyle: ''
            }));
        }

        if (studioForm.IdsEstiloDanca.some((id) => !validStyleIds.has(id))) {
            setStudioForm((prev) => ({
                ...prev,
                IdsEstiloDanca: prev.IdsEstiloDanca.filter((id) => validStyleIds.has(id))
            }));
        }
    }, [activeEstilos, formData.style, importForm.defaultStyle, studioForm.IdsEstiloDanca]);

    const scheduleItems = useMemo(() => aulas.map((aula) => {
        const lessonDate = new Date(aula.Data);
        const startMinutes = toMinutes(aula.HoraInicio);
        const endMinutes = toMinutes(aula.HoraFim);
        const enrolled = (aula.Marcacao || []).length;
        const confirmed = Boolean(aula.ConfirmacaoProfessor);
        const validated = Boolean(aula.ValidacaoDirecao);
        const studioLabel = aula.Estudio?.Numero ? `Estudio ${aula.Estudio.Numero}` : aula.IdEstudio;
        const duration = Math.max(endMinutes - startMinutes, 30);
        const endDateTime = buildLessonDateTime(aula.Data, aula.HoraFim);

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
            lessonType: formatLessonTypeLabel(aula.TipoAula || 'Regular'),
            studio: studioLabel,
            capacity: aula.CapacidadeMaxima,
            enrolled,
            confirmed,
            validated,
            statusLabel: getDirectorLessonStatus({
                validated,
                confirmed,
                endDateTime,
                enrolled
            }),
            statusTone: getDirectorLessonStatusTone({
                validated,
                confirmed,
                endDateTime
            }),
            endDateTime,
            dateLabel: formatDate(aula.Data)
        };
    }), [aulas]);

    const scheduleBoardDays = useMemo(() => weekDays.map((day) => {
        const dateKey = getDateKey(day);
        const lessons = scheduleItems.filter((lesson) => lesson.dateKey === dateKey);

        return {
            date: day,
            dateKey,
            lessons,
            groups: groupDayLessonsBySlot(lessons)
        };
    }), [scheduleItems, weekDays]);

    const weeklyLessonTotal = useMemo(
        () => scheduleBoardDays.reduce((total, day) => total + day.lessons.length, 0),
        [scheduleBoardDays]
    );

    const weeklySlotTotal = useMemo(
        () => scheduleBoardDays.reduce((total, day) => total + day.groups.length, 0),
        [scheduleBoardDays]
    );

    const busyDayTotal = useMemo(
        () => scheduleBoardDays.filter((day) => day.lessons.length > 0).length,
        [scheduleBoardDays]
    );

    const clearMessages = () => {
        setError('');
        setFeedback('');
        setOperationSummary(null);
    };

    const resetImportForm = () => {
        setImportForm(getInitialImportForm());
        setImportInputKey((prev) => prev + 1);
    };

    const resetStyleForm = () => {
        setStyleForm(emptyStyleForm);
        setEditingStyleId('');
    };

    const resetStudioForm = () => {
        setStudioForm(emptyStudioForm);
        setEditingStudioId('');
    };

    const handleEditStyle = (style) => {
        setActiveAction('config');
        setEditingStyleId(style.IdEstiloDanca);
        setStyleForm({
            Nome: style.Nome || ''
        });
        clearMessages();
    };

    const handleEditStudio = (studio) => {
        setActiveAction('config');
        setEditingStudioId(studio.IdEstudio);
        setStudioForm({
            Numero: studio.Numero ? String(studio.Numero) : '',
            Capacidade: studio.Capacidade ? String(studio.Capacidade) : '',
            IdsEstiloDanca: getStudioLinkedStyleIds(studio)
        });
        clearMessages();
    };

    const toggleStudioStyleSelection = (idEstiloDanca) => {
        setStudioForm((prev) => ({
            ...prev,
            IdsEstiloDanca: prev.IdsEstiloDanca.includes(idEstiloDanca)
                ? prev.IdsEstiloDanca.filter((id) => id !== idEstiloDanca)
                : [...prev.IdsEstiloDanca, idEstiloDanca]
        }));
    };

    const handleSaveStyle = async () => {
        if (!styleForm.Nome.trim()) {
            setError('Indica o nome do estilo.');
            return;
        }

        setCatalogSaving(true);
        clearMessages();

        try {
            if (editingStyleId) {
                await atualizarEstilo(editingStyleId, styleForm);
                setFeedback('Estilo atualizado com sucesso.');
            } else {
                await criarEstilo(styleForm);
                setFeedback('Estilo criado com sucesso.');
            }

            resetStyleForm();
            await reloadCatalog();
        } catch (err) {
            setError(err.message || 'Não foi possível guardar o estilo.');
        } finally {
            setCatalogSaving(false);
        }
    };

    const handleSaveStudio = async () => {
        if (!studioForm.Numero || !studioForm.Capacidade) {
            setError('Indique o número e a capacidade do estúdio.');
            return;
        }

        if (studioForm.IdsEstiloDanca.length === 0) {
            setError('Selecione pelo menos um estilo para o estúdio.');
            return;
        }

        setCatalogSaving(true);
        clearMessages();

        try {
            if (editingStudioId) {
                await atualizarEstudio(editingStudioId, studioForm);
                setFeedback('Estudio atualizado com sucesso.');
            } else {
                await criarEstudio(studioForm);
                setFeedback('Estudio criado com sucesso.');
            }

            resetStudioForm();
            await reloadCatalog();
        } catch (err) {
            setError(err.message || 'Não foi possível guardar o estúdio.');
        } finally {
            setCatalogSaving(false);
        }
    };

    const handleDeleteStyle = async (style) => {
        const isActive = style.EstaAtivo !== false;
        const actionLabel = isActive ? 'inativar' : 'reativar';

        if (!window.confirm(`${isActive ? 'Inativar' : 'Reativar'} o estilo "${style.Nome}"?`)) {
            return;
        }

        setCatalogSaving(true);
        clearMessages();

        try {
            if (isActive) {
                await removerEstilo(style.IdEstiloDanca);
            } else {
                await atualizarEstadoEstilo(style.IdEstiloDanca, true);
            }

            setFeedback(`Estilo ${isActive ? 'inativado' : 'reativado'} com sucesso.`);

            if (editingStyleId === style.IdEstiloDanca) {
                resetStyleForm();
            }

            await reloadCatalog();
        } catch (err) {
            setError(err.message || `Não foi possível ${actionLabel} o estilo.`);
        } finally {
            setCatalogSaving(false);
        }
    };

    const handleDeleteStudio = async (studio) => {
        const isActive = studio.EstaAtivo !== false;
        const actionLabel = isActive ? 'inativar' : 'reativar';

        if (!window.confirm(`${isActive ? 'Inativar' : 'Reativar'} o estúdio ${studio.Numero}?`)) {
            return;
        }

        setCatalogSaving(true);
        clearMessages();

        try {
            if (isActive) {
                await removerEstudio(studio.IdEstudio);
            } else {
                await atualizarEstadoEstudio(studio.IdEstudio, true);
            }

            setFeedback(`Estudio ${isActive ? 'inativado' : 'reativado'} com sucesso.`);

            if (editingStudioId === studio.IdEstudio) {
                resetStudioForm();
            }

            await reloadCatalog();
        } catch (err) {
            setError(err.message || `Não foi possível ${actionLabel} o estúdio.`);
        } finally {
            setCatalogSaving(false);
        }
    };

    const openLessonModal = (day = new Date(), options = {}) => {
        const dateValue = toDateInputValue(day);
        const lessonType = options.preferredType || 'Regular';
        const dayOfWeek = String(new Date(day).getDay());
        const regularDate = getNextOccurrenceDateKey(dateValue, dayOfWeek);

        setFormData({
            ...initialForm,
            anchorDate: dateValue,
            dayOfWeek,
            date: lessonType === 'Particular' ? dateValue : regularDate,
            lessonType,
            repeatMode: lessonType === 'Particular' ? 'none' : 'weekly'
        });
        setIsQuickBookOpen(true);
        setActiveAction(lessonType === 'Regular' ? 'regular' : activeAction);
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
        openLessonModal(new Date(), { preferredType: 'Regular' });
    };

    const handleLessonTypeChange = (nextType) => {
        setFormData((prev) => {
            const anchorDate = prev.anchorDate || prev.date || toDateInputValue(new Date());
            const dayOfWeek = prev.dayOfWeek || String(new Date(`${anchorDate}T00:00:00`).getDay());

            return {
                ...prev,
                lessonType: nextType,
                date: nextType === 'Particular'
                    ? (prev.date || anchorDate)
                    : getNextOccurrenceDateKey(anchorDate, dayOfWeek),
                dayOfWeek,
                repeatMode: nextType === 'Particular' ? 'none' : 'weekly',
                repeatUntil: nextType === 'Particular' ? '' : prev.repeatUntil,
                teacher: '',
                teacherSelectionMode: 'compatible',
                studio: '',
                studioSelectionMode: 'compatible'
            };
        });
    };

    const handleCoachingDateChange = (value) => {
        setFormData((prev) => ({
            ...prev,
            date: value,
            anchorDate: value || prev.anchorDate,
            dayOfWeek: value ? String(new Date(`${value}T00:00:00`).getDay()) : prev.dayOfWeek,
            studio: '',
            studioSelectionMode: 'compatible'
        }));
    };

    const handleRegularWeekdayChange = (value) => {
        setFormData((prev) => ({
            ...prev,
            dayOfWeek: value,
            date: getNextOccurrenceDateKey(prev.anchorDate || toDateInputValue(new Date()), value),
            studio: '',
            studioSelectionMode: 'compatible'
        }));
    };

    const handleDurationClick = (minutes) => {
        setFormData((prev) => ({
            ...prev,
            duration: String(minutes),
            endTime: prev.startTime ? computeEndTime(prev.startTime, minutes) : '',
            studio: '',
            studioSelectionMode: 'compatible'
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
        OrigemAula: 'Direcao',
        PermitirProfessorAlternativo: formData.teacherSelectionMode === 'alternative',
        IdProfessor: formData.teacher,
        IdEstudio: formData.studio,
        IdEstiloDanca: formData.style,
        PermitirEstudioAlternativo: formData.studioSelectionMode === 'alternative',
        Referencia: `${dateValue} ${formData.startTime}`
    }));

    const handleSubmit = async () => {
        if (!formData.teacher || !formData.style || !formData.capacity || !formData.startTime || !formData.studio) {
            setError('Preenche todos os campos obrigatorios.');
            return;
        }

        if (isCoaching && !formData.date) {
            setError('Escolhe a data do Coaching.');
            return;
        }

        if (!isCoaching && !formData.dayOfWeek) {
            setError('Escolhe o dia da semana da aula regular.');
            return;
        }

        if (!isCoaching && !formData.repeatUntil) {
            setError('Define a data final da recorrencia.');
            return;
        }

        if (!isCoaching) {
            const repeatUntil = parseDateInput(formData.repeatUntil);
            const firstDate = parseDateInput(regularFirstOccurrence);
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

        if (payloads.length === 0) {
            setError('Não foi possível gerar nenhuma aula com os dados escolhidos.');
            return;
        }

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
                    title: result.totalCriadas === 1 ? 'Aula criada' : 'Série criada',
                    message: result.totalCriadas === 1
                        ? `A aula foi marcada para ${formatDate(scheduleReferenceDate)}.`
                        : `${result.totalCriadas} aulas foram adicionadas ao horário.`,
                    tone: 'success'
                });
                setFeedback(
                    result.totalCriadas === 1
                        ? `Aula agendada com sucesso para ${formatDate(scheduleReferenceDate)}.`
                        : `${result.totalCriadas} aulas criadas com sucesso.`
                );
                await loadData();
            }

            if (result.totalFalhas > 0) {
                setError(buildFailureSummaryMessage(result.totalFalhas, result.erros || []));
                requestAnimationFrame(() => {
                    operationSummaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
            }

            if (result.totalCriadas > 0) {
                setIsQuickBookOpen(false);
                setFormData(initialForm);
            }
        } catch (err) {
            setError(err.message || 'Não foi possível agendar a aula.');
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
                    title: 'Importação concluída',
                    message: `${result.totalCriadas} aula(s) criadas a partir do ficheiro.`,
                    tone: 'success'
                });
            setFeedback(`Importação concluída com ${result.totalCriadas} aula(s) criada(s).`);
                await loadData();
                setImportForm((prev) => ({ ...prev, file: null }));
                setImportInputKey((prev) => prev + 1);
            }

            if (combinedErrors.length > 0) {
                setError(buildFailureSummaryMessage(combinedErrors.length, combinedErrors));
                requestAnimationFrame(() => {
                    operationSummaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
            }
        } catch (err) {
            setError(err.message || 'Não foi possível importar o ficheiro.');
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="schedule-page">
            <div className="schedule-header">
                <div>
                    <p className="schedule-eyebrow">Direção</p>
                    <h1>Gestão de horários</h1>
                    <p className="schedule-subtitle">
                        Crie aulas regulares e Coachings, importe horários em CSV e acompanhe o calendário semanal.
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
                    <h2>Criar aulas e Coachings</h2>
                    <p className="schedule-action-copy">
                        Defina sessões de Coaching com data exata ou crie séries regulares semanais para a Direção.
                    </p>
                    <button type="button" className="schedule-button schedule-button--primary" onClick={handleOpenRegularCreator}>
                        Abrir criador
                    </button>
                </article>

                <article className={`schedule-action-card ${activeAction === 'import' ? 'schedule-action-card--active' : ''}`}>
                    <p className="schedule-eyebrow">Menu</p>
                    <h2>Importar horário</h2>
                    <p className="schedule-action-copy">
                        Carrega um ficheiro CSV com datas especificas ou com regras semanais, mensais ou anuais.
                    </p>
                    <button type="button" className="schedule-button schedule-button--ghost" onClick={() => setActiveAction('import')}>
                        Configurar importacao
                    </button>
                </article>

                <article className={`schedule-action-card ${activeAction === 'config' ? 'schedule-action-card--active' : ''}`}>
                    <p className="schedule-eyebrow">Menu</p>
                    <h2>Configurar estúdios e estilos</h2>
                    <p className="schedule-action-copy">
                        Gere os estúdios disponíveis e os estilos de dança usados no planeamento das aulas.
                    </p>
                    <button type="button" className="schedule-button schedule-button--ghost" onClick={() => setActiveAction('config')}>
                        Abrir configuração
                    </button>
                </article>
            </div>

            {activeAction === 'import' && (
                <section className="schedule-import-panel">
                    <div className="schedule-import-header">
                        <div>
                            <p className="schedule-eyebrow">Importação</p>
                            <h2>Carregar ficheiro de horário</h2>
                            <p className="schedule-subtitle">
                                Use CSV com `;` ou `,`. Pode indicar professor, estúdio e estilo por nome, número ou ID.
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
                                    {activeEstudios.map((studio) => (
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
                                    {activeEstilos.map((style) => (
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
                                    <option value="Particular">Coaching</option>
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
                            {importing ? 'A importar...' : 'Importar horário'}
                        </button>
                    </div>
                </section>
            )}

            {activeAction === 'config' && (
                <section className="schedule-import-panel schedule-config-panel">
                    <div className="schedule-import-header">
                        <div>
                            <p className="schedule-eyebrow">Configuração</p>
                            <h2>Gerir estúdios e estilos</h2>
                            <p className="schedule-subtitle">
                                A Direção pode criar, editar, inativar e reativar estúdios e estilos sem perder histórico.
                            </p>
                        </div>
                        <button type="button" className="schedule-button schedule-button--ghost" onClick={() => setActiveAction('regular')}>
                            Fechar
                        </button>
                    </div>

                    <div className="schedule-config-grid">
                        <article className="schedule-config-card">
                            <div className="schedule-config-card-header">
                                <div>
                                    <p className="schedule-eyebrow">Estilos</p>
                                    <h3>{editingStyleId ? 'Editar estilo' : 'Novo estilo'}</h3>
                                    <p className="schedule-helper">
                                        Mantem a lista de estilos usada nas aulas e nos estúdios.
                                    </p>
                                </div>
                            </div>

                            <div className="schedule-config-form-card">
                                <div className="schedule-form">
                                <label>
                                    <span>Nome do estilo</span>
                                    <input
                                        value={styleForm.Nome}
                                        onChange={(event) => setStyleForm({ Nome: event.target.value })}
                                        placeholder="Ex: Jazz Contemporaneo"
                                    />
                                </label>
                                </div>

                                <div className="schedule-modal-actions schedule-modal-actions--compact">
                                    {editingStyleId && (
                                        <button type="button" className="schedule-button schedule-button--ghost" onClick={resetStyleForm}>
                                            Cancelar edição
                                        </button>
                                    )}
                                    <button type="button" className="schedule-button schedule-button--primary" onClick={handleSaveStyle} disabled={catalogSaving}>
                                        {catalogSaving ? 'A guardar...' : editingStyleId ? 'Guardar estilo' : 'Criar estilo'}
                                    </button>
                                </div>
                            </div>

                            <div className="schedule-config-list">
                                {configStyles.length === 0 ? (
                                    <p className="schedule-config-empty">Ainda nao existem estilos configurados.</p>
                                ) : configStyles.map((style) => (
                                    <article key={style.IdEstiloDanca} className={`schedule-config-item ${style.EstaAtivo === false ? 'schedule-config-item--inactive' : ''}`}>
                                        <div className="schedule-config-item-copy">
                                            <div className="schedule-config-item-top">
                                                <strong>{style.Nome}</strong>
                                                <span className={`schedule-config-status ${style.EstaAtivo === false ? 'schedule-config-status--inactive' : 'schedule-config-status--active'}`}>
                                                    {style.EstaAtivo === false ? 'Inativo' : 'Ativo'}
                                                </span>
                                            </div>
                                            <span>ID: {style.IdEstiloDanca.slice(0, 8)}</span>
                                        </div>
                                        <div className="schedule-config-actions">
                                            <button type="button" className="schedule-button schedule-button--ghost schedule-button--small" onClick={() => handleEditStyle(style)}>
                                                Editar
                                            </button>
                                            <button
                                                type="button"
                                                className={`schedule-button schedule-button--small ${style.EstaAtivo === false ? 'schedule-button--primary' : 'schedule-button--danger'}`}
                                                onClick={() => handleDeleteStyle(style)}
                                                disabled={catalogSaving}
                                            >
                                                {style.EstaAtivo === false ? 'Reativar' : 'Inativar'}
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </article>

                        <article className="schedule-config-card">
                            <div className="schedule-config-card-header">
                                <div>
                                    <p className="schedule-eyebrow">Estudios</p>
                                    <h3>{editingStudioId ? 'Editar estúdio' : 'Novo estúdio'}</h3>
                                    <p className="schedule-helper">
                                        Define a capacidade e os estilos suportados por cada estúdio.
                                    </p>
                                </div>
                            </div>

                            <div className="schedule-config-form-card">
                                <div className="schedule-form">
                                    <div className="schedule-form-grid">
                                        <label>
                                            <span>Numero</span>
                                            <input
                                                type="number"
                                                min="1"
                                                value={studioForm.Numero}
                                                onChange={(event) => setStudioForm((prev) => ({ ...prev, Numero: event.target.value }))}
                                                placeholder="Ex: 3"
                                            />
                                        </label>

                                        <label>
                                            <span>Capacidade</span>
                                            <input
                                                type="number"
                                                min="1"
                                                value={studioForm.Capacidade}
                                                onChange={(event) => setStudioForm((prev) => ({ ...prev, Capacidade: event.target.value }))}
                                                placeholder="Ex: 16"
                                            />
                                        </label>
                                    </div>

                                    <div>
                                        <span className="schedule-form-label">Estilos associados</span>
                                        <div className="schedule-config-check-grid">
                                            {activeEstilos.map((style) => (
                                                <label key={style.IdEstiloDanca} className="schedule-config-check">
                                                    <input
                                                        type="checkbox"
                                                        checked={studioForm.IdsEstiloDanca.includes(style.IdEstiloDanca)}
                                                        onChange={() => toggleStudioStyleSelection(style.IdEstiloDanca)}
                                                    />
                                                    <span>{style.Nome}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="schedule-modal-actions schedule-modal-actions--compact">
                                    {editingStudioId && (
                                        <button type="button" className="schedule-button schedule-button--ghost" onClick={resetStudioForm}>
                                            Cancelar edição
                                        </button>
                                    )}
                                    <button type="button" className="schedule-button schedule-button--primary" onClick={handleSaveStudio} disabled={catalogSaving}>
                                        {catalogSaving ? 'A guardar...' : editingStudioId ? 'Guardar estúdio' : 'Criar estúdio'}
                                    </button>
                                </div>
                            </div>

                            <div className="schedule-config-list">
                                {configStudios.length === 0 ? (
                                    <p className="schedule-config-empty">Ainda não existem estúdios configurados.</p>
                                ) : configStudios.map((studio) => (
                                    <article key={studio.IdEstudio} className={`schedule-config-item ${studio.EstaAtivo === false ? 'schedule-config-item--inactive' : ''}`}>
                                        <div className="schedule-config-item-copy">
                                            <div className="schedule-config-item-top">
                                                <strong>{`Estudio ${studio.Numero}`}</strong>
                                                <span className={`schedule-config-status ${studio.EstaAtivo === false ? 'schedule-config-status--inactive' : 'schedule-config-status--active'}`}>
                                                    {studio.EstaAtivo === false ? 'Inativo' : 'Ativo'}
                                                </span>
                                            </div>
                                            <span>{`Capacidade: ${studio.Capacidade}`}</span>
                                            <div className="schedule-config-chip-list">
                                                {(studio.EstudioEstilo || []).map((entry) => (
                                                    <span
                                                        key={`${studio.IdEstudio}-${entry.IdEstiloDanca}`}
                                                        className={`schedule-config-chip ${entry.EstiloDanca?.EstaAtivo === false ? 'schedule-config-chip--inactive' : ''}`}
                                                    >
                                                        {entry.EstiloDanca?.Nome || 'Sem estilo'}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="schedule-config-actions">
                                            <button type="button" className="schedule-button schedule-button--ghost schedule-button--small" onClick={() => handleEditStudio(studio)}>
                                                Editar
                                            </button>
                                            <button
                                                type="button"
                                                className={`schedule-button schedule-button--small ${studio.EstaAtivo === false ? 'schedule-button--primary' : 'schedule-button--danger'}`}
                                                onClick={() => handleDeleteStudio(studio)}
                                                disabled={catalogSaving}
                                            >
                                                {studio.EstaAtivo === false ? 'Reativar' : 'Inativar'}
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </article>
                    </div>
                </section>
            )}

            {operationSummary && (
                <section ref={operationSummaryRef} className="schedule-summary">
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

                    <div className="schedule-toolbar-summary">
                        <span>{weeklyLessonTotal} aula(s)</span>
                        <span>{weeklySlotTotal} bloco(s)</span>
                        <span>{busyDayTotal} dia(s) ocupados</span>
                    </div>
                </div>

                {loading ? (
                    <div className="schedule-empty">
                        <p className="schedule-empty-title">A carregar horários...</p>
                        <p className="schedule-empty-copy">A preparar aulas, estúdios, estilos e professores.</p>
                    </div>
                ) : (
                    <div className="schedule-calendar schedule-calendar--board">
                        <div className="schedule-board">
                            {scheduleBoardDays.map((day, index) => {
                                const isToday = new Date().toDateString() === day.date.toDateString();
                                const dayName = day.date.toLocaleDateString('pt-PT', { weekday: 'long' });
                                const dayLabel = day.date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });

                                return (
                                    <section key={index} className={`schedule-day-panel ${isToday ? 'schedule-day-panel--today' : ''}`}>
                                        <div className="schedule-day-panel-header">
                                            <div className="schedule-day-panel-copy">
                                                <span>{dayName}</span>
                                                <strong>{dayLabel}</strong>
                                                <small>
                                                    {day.lessons.length === 0
                                                        ? 'Sem aulas marcadas'
                                                        : `${day.lessons.length} aula(s) em ${day.groups.length} bloco(s)`}
                                                </small>
                                            </div>
                                        </div>

                                        {day.groups.length === 0 ? (
                                            <div className="schedule-day-panel-empty">
                                                <p>Dia livre.</p>
                                            </div>
                                        ) : (
                                            <div className="schedule-day-panel-body">
                                                {day.groups.map((group) => (
                                                    <article key={group.key} className="schedule-slot-group">
                                                        <div className="schedule-slot-group-header">
                                                            <strong>{group.timeRange}</strong>
                                                            <span>{group.lessons.length} aula(s)</span>
                                                        </div>

                                                        <div className="schedule-slot-list">
                                                            {group.lessons.map((lesson) => (
                                                                <button
                                                                    key={lesson.id}
                                                                    type="button"
                                                                    className={`schedule-slot-card schedule-slot-card--${lesson.statusTone} ${lesson.lessonType === 'Coaching' ? 'schedule-slot-card--coaching' : ''}`}
                                                                    onClick={() => handleOpenLessonDetails(lesson)}
                                                                >
                                                                    <div className="schedule-slot-card-top">
                                                                        <strong>{lesson.style}</strong>
                                                                        <span className={`schedule-slot-badge ${lesson.lessonType === 'Coaching' ? 'schedule-slot-badge--coaching' : 'schedule-slot-badge--regular'}`}>
                                                                            {lesson.lessonType}
                                                                        </span>
                                                                    </div>

                                                                    <div className="schedule-slot-card-meta">
                                                                        <span>{lesson.teacher}</span>
                                                                        <span>{lesson.studio}</span>
                                                                    </div>

                                                                    <div className="schedule-slot-card-meta">
                                                                        <span>{lesson.enrolled}/{lesson.capacity} inscritos</span>
                                                                        <span>{lesson.statusLabel}</span>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </article>
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                );
                            })}
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
                                <h2>{isCoaching ? 'Novo Coaching' : 'Nova aula regular'}</h2>
                                <p className="schedule-helper">
                                    {isCoaching
                                        ? (formData.date ? `Sessão prevista para ${formatDate(formData.date)}.` : 'Escolhe a data do Coaching.')
                                        : scheduleReferenceDate
                                            ? `Primeira ocorrencia em ${formatDate(scheduleReferenceDate)}.`
                                            : 'Escolhe o dia da semana para gerar a serie regular.'}
                                </p>
                            </div>
                            <button type="button" className="schedule-button schedule-button--ghost" onClick={() => setIsQuickBookOpen(false)}>
                                Fechar
                            </button>
                        </div>

                        <div className="schedule-form">
                            {error && <div className="schedule-banner schedule-banner--error">{error}</div>}

                            <label>
                                <span>Tipo de aula *</span>
                                <select
                                    value={formData.lessonType}
                                    onChange={(event) => handleLessonTypeChange(event.target.value)}
                                >
                                    <option value="Regular">Regular</option>
                                    <option value="Particular">Coaching</option>
                                </select>
                            </label>

                            {isCoaching ? (
                                <label>
                                    <span>Data do Coaching *</span>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(event) => handleCoachingDateChange(event.target.value)}
                                    />
                                </label>
                            ) : (
                                <>
                                    <div className="schedule-form-grid">
                                        <label>
                                            <span>Dia da semana *</span>
                                            <select value={formData.dayOfWeek} onChange={(event) => handleRegularWeekdayChange(event.target.value)}>
                                                {WEEKDAY_OPTIONS.map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <label>
                                            <span>Gerar ate *</span>
                                            <input
                                                type="date"
                                                value={formData.repeatUntil}
                                                onChange={(event) => setFormData((prev) => ({ ...prev, repeatUntil: event.target.value }))}
                                            />
                                        </label>
                                    </div>

                                    <p className="schedule-helper">
                                        {formData.repeatUntil
                                            ? `Previstas ${recurrencePreviewDates.length} aula(s), sempre a ${getWeekdayLabel(formData.dayOfWeek).toLowerCase()}.`
                                            : `A série vai arrancar na primeira ${getWeekdayLabel(formData.dayOfWeek).toLowerCase()} disponível a partir de ${formatDate(formData.anchorDate || scheduleReferenceDate)}.`}
                                    </p>
                                </>
                            )}

                            <div className="schedule-form-grid">
                                <label>
                                    <span>Estilo de danca *</span>
                                    <select
                                        value={formData.style}
                                        onChange={(event) => setFormData((prev) => ({
                                            ...prev,
                                            style: event.target.value,
                                            teacher: '',
                                            teacherSelectionMode: 'compatible',
                                            studio: '',
                                            studioSelectionMode: 'compatible'
                                        }))}
                                    >
                                        <option value="">Selecione o estilo</option>
                                        {activeEstilos.map((style) => (
                                            <option key={style.IdEstiloDanca} value={style.IdEstiloDanca}>
                                                {style.Nome}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    <span>Limite de vagas *</span>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.capacity}
                                        onChange={(event) => setFormData((prev) => ({
                                            ...prev,
                                            capacity: event.target.value,
                                            studio: '',
                                            studioSelectionMode: 'compatible'
                                        }))}
                                        placeholder="Ex: 12"
                                    />
                                </label>
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
                                            endTime: prev.duration ? computeEndTime(event.target.value, prev.duration) : prev.endTime,
                                            studio: '',
                                            studioSelectionMode: 'compatible'
                                        }))}
                                    />
                                </label>

                                <label>
                                    <span>Hora de fim</span>
                                    <input
                                        type="time"
                                        value={formData.endTime}
                                        onChange={(event) => setFormData((prev) => ({
                                            ...prev,
                                            endTime: event.target.value,
                                            duration: '',
                                            studio: '',
                                            studioSelectionMode: 'compatible'
                                        }))}
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

                            <label>
                                <span>Professor *</span>
                                <select
                                    value={showAlternativeTeacherSelector ? '__other__' : selectedTeacherId}
                                    onChange={(event) => {
                                        if (event.target.value === '__other__') {
                                            setFormData((prev) => ({
                                                ...prev,
                                                teacherSelectionMode: 'alternative',
                                                teacher: ''
                                            }));
                                            return;
                                        }

                                        setFormData((prev) => ({
                                            ...prev,
                                            teacherSelectionMode: 'compatible',
                                            teacher: event.target.value
                                        }));
                                    }}
                                    disabled={!canSelectTeacher}
                                >
                                    <option value="">
                                        {!formData.style
                                            ? 'Escolha primeiro o estilo'
                                            : !isCoaching
                                                ? teacherState.compatibleOptions.length === 0
                                                    ? 'Sem professor associado ao estilo'
                                                    : 'Selecione o professor'
                                                : formData.date
                                                    ? 'Selecione o professor disponível'
                                                    : 'Escolha primeiro a data do Coaching'}
                                    </option>
                                    {teacherState.compatibleOptions.map((teacher) => (
                                        <option key={teacher.IdUtilizador} value={teacher.IdUtilizador}>
                                            {teacher.NomeCompleto}
                                        </option>
                                    ))}
                                    {canUnlockAlternativeTeacher && (
                                        <option value="__other__">Outro professor</option>
                                    )}
                                </select>
                            </label>

                            {!isCoaching && teacherState.compatibleOptions.length === 0 && teacherState.allAvailableOptions.length > 0 && (
                                <p className="schedule-helper">
                                    Não existe nenhum professor associado ao estilo escolhido. Pode usar a opção "Outro professor".
                                </p>
                            )}

                            {showAlternativeTeacherSelector && teacherState.compatibleOptions.length > 0 && (
                                <p className="schedule-helper">
                                    Esta lista mostra todos os professores ativos, incluindo alternativas fora do estilo.
                                </p>
                            )}

                            {showAlternativeTeacherSelector && (
                                <label>
                                    <span>Outro professor</span>
                                    <select
                                        value={selectedTeacherId}
                                        onChange={(event) => setFormData((prev) => ({
                                            ...prev,
                                            teacherSelectionMode: 'alternative',
                                            teacher: event.target.value
                                        }))}
                                    >
                                        <option value="">
                                            {teacherState.allAvailableOptions.length === 0
                                                ? 'Não existem professores ativos'
                                                : 'Selecione um professor alternativo'}
                                        </option>
                                        {teacherState.allAvailableOptions.map((teacher) => {
                                            const isCompatible = teacherState.compatibleOptions.some((item) => item.IdUtilizador === teacher.IdUtilizador);
                                            return (
                                                <option key={teacher.IdUtilizador} value={teacher.IdUtilizador}>
                                                    {teacher.NomeCompleto}{isCompatible ? ' - Compativel' : ' - Alternativo'}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </label>
                            )}

                            {isCoaching && (
                                <div className="schedule-availability-note">
                                    <p className="schedule-availability-title">Disponibilidade do professor</p>
                                    {!formData.date ? (
                                        <p className="schedule-helper">Escolha primeiro a data do Coaching.</p>
                                    ) : !formData.style ? (
                                        <p className="schedule-helper">Escolha o estilo para filtrar os professores certos.</p>
                                    ) : !formData.teacher ? (
                                        <p className="schedule-helper">Escolha o professor para ver os blocos livres nesse dia.</p>
                                    ) : coachingTeacherAvailability.length === 0 ? (
                                        <p className="schedule-helper">{selectedTeacherName} nao tem disponibilidade registada neste dia.</p>
                                    ) : availableTimeSlots.length === 0 ? (
                                        <p className="schedule-helper">{selectedTeacherName} nao tem blocos livres para a duracao escolhida neste dia.</p>
                                    ) : (
                                        <>
                                            <p className="schedule-helper">
                                                Os blocos abaixo ja descontam as aulas que o professor tem marcadas nesse dia.
                                            </p>
                                            <div className="schedule-availability-slots">
                                                {availableTimeSlots.map((slot) => (
                                                    <button
                                                        key={slot.key}
                                                        type="button"
                                                        className={`schedule-availability-slot ${formData.startTime === slot.startTime ? 'schedule-availability-slot--selected' : ''}`}
                                                        onClick={() => setFormData((prev) => ({
                                                            ...prev,
                                                            startTime: slot.startTime,
                                                            endTime: prev.duration ? computeEndTime(slot.startTime, prev.duration) : slot.endTime,
                                                            studio: '',
                                                            studioSelectionMode: 'compatible'
                                                        }))}
                                                    >
                                                        {slot.startTime} - {slot.endTime}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            <label>
                                <span>Estudio *</span>
                                <select
                                    value={showAlternativeStudioSelector ? '__other__' : selectedStudioId}
                                    onChange={(event) => {
                                        if (event.target.value === '__other__') {
                                            setFormData((prev) => ({
                                                ...prev,
                                                studioSelectionMode: 'alternative',
                                                studio: ''
                                            }));
                                            return;
                                        }

                                        setFormData((prev) => ({
                                            ...prev,
                                            studioSelectionMode: 'compatible',
                                            studio: event.target.value
                                        }));
                                    }}
                                    disabled={!canSelectStudio}
                                >
                                    <option value="">
                                        {!formData.style
                                            ? 'Escolha primeiro o estilo'
                                            : !formData.capacity
                                                ? 'Indique primeiro a capacidade'
                                                : !formData.startTime || !effectiveEndTime
                                                    ? 'Defina primeiro o horário'
                                                        : studioState.compatibleOptions.length === 0
                                                        ? 'Sem estúdio compatível livre'
                                                        : 'Selecione o estúdio compatível'}
                                    </option>
                                    {studioState.compatibleOptions.map((studio) => (
                                        <option key={studio.IdEstudio} value={studio.IdEstudio}>
                                            Estudio {studio.Numero} - Capacidade {studio.Capacidade}
                                        </option>
                                    ))}
                                    {canUnlockAlternativeStudio && (
                                        <option value="__other__">Outro estúdio</option>
                                    )}
                                </select>
                            </label>

                            {studioState.compatibleOptions.length === 0 && studioState.allAvailableOptions.length > 0 && (
                                <p className="schedule-helper">
                                    Não existe nenhum estúdio associado ao estilo livre para este horário. Pode usar a opção "Outro estúdio".
                                </p>
                            )}

                            {showAlternativeStudioSelector && studioState.compatibleOptions.length > 0 && (
                                <p className="schedule-helper">
                                    Esta lista mostra todos os estúdios livres para o horário escolhido, incluindo alternativas fora do estilo.
                                </p>
                            )}

                            {showAlternativeStudioSelector && (
                                <label>
                                    <span>Outro estúdio</span>
                                    <select
                                        value={selectedStudioId}
                                        onChange={(event) => setFormData((prev) => ({
                                            ...prev,
                                            studioSelectionMode: 'alternative',
                                            studio: event.target.value
                                        }))}
                                    >
                                        <option value="">
                                            {studioState.allAvailableOptions.length === 0
                                                ? 'Não existem estúdios livres'
                                                : 'Selecione um estúdio alternativo'}
                                        </option>
                                        {studioState.allAvailableOptions.map((studio) => {
                                            const isCompatible = studioState.compatibleOptions.some((item) => item.IdEstudio === studio.IdEstudio);
                                            return (
                                                <option key={studio.IdEstudio} value={studio.IdEstudio}>
                                                    Estudio {studio.Numero} - Capacidade {studio.Capacidade}{isCompatible ? ' - Compativel' : ' - Alternativo'}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </label>
                            )}

                            {formData.style && canSelectTeacher && teacherState.compatibleOptions.length === 0 && isCoaching && (
                                <p className="schedule-helper">
                                    Não existem professores disponíveis para este estilo na data e horário selecionados.
                                </p>
                            )}

                            {formData.style && canSelectStudio && studioState.allAvailableOptions.length === 0 && (
                                <p className="schedule-helper">
                                    Não existem estúdios livres com capacidade suficiente para este horário.
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
                                    : isCoaching
                                        ? 'Confirmar Coaching'
                                        : 'Criar serie regular'}
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
                                <strong>{selectedLesson.confirmed ? 'Sim' : 'Não'}</strong>
                            </div>
                            <div className="schedule-lesson-detail-card">
                                <span>Validação da direção</span>
                                <strong>{getDirectorLessonStatus(selectedLesson)}</strong>
                            </div>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default ScheduleManagement;
