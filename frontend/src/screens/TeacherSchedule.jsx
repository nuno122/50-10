import React, { useEffect, useMemo, useState } from 'react';
import {
    cancelarAulaProfessor,
    getAulas,
    getMinhasDisponibilidades,
    guardarMinhasDisponibilidades
} from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';

const DAYS_OF_WEEK = [
    { id: 1, name: 'Segunda-feira' },
    { id: 2, name: 'Terca-feira' },
    { id: 3, name: 'Quarta-feira' },
    { id: 4, name: 'Quinta-feira' },
    { id: 5, name: 'Sexta-feira' },
    { id: 6, name: 'Sabado' },
    { id: 0, name: 'Domingo' }
];

const AVAILABILITY_FIELD_ALIASES = {
    data: ['data', 'dia', 'date'],
    diaSemana: ['diasemana', 'weekday', 'semana'],
    diaMes: ['diames', 'daymonth', 'dayofmonth'],
    horaInicio: ['horainicio', 'inicio', 'start'],
    horaFim: ['horafim', 'fim', 'end']
};

const toDateInputValue = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getMonthInputValue = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
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

const parseMonthInput = (value) => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;
    return {
        year: Number(match[1]),
        monthIndex: Number(match[2]) - 1
    };
};

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('pt-PT').format(date);
};

const formatMonthLabel = (value) => {
    const month = parseMonthInput(value);
    if (!month) return 'Mes selecionado';
    return new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' })
        .format(new Date(month.year, month.monthIndex, 1));
};

const extractTime = (value) => {
    const text = String(value || '');
    const match = text.match(/(\d{2}):(\d{2})/);
    return match ? `${match[1]}:${match[2]}` : '';
};

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

const buildIsoTime = (dateValue, timeValue) => `${dateValue}T${timeValue}:00.000Z`;

const getDateKey = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return toDateInputValue(date);
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

const getMonthBounds = (monthValue) => {
    const parsed = parseMonthInput(monthValue);
    if (!parsed) return null;

    const start = new Date(parsed.year, parsed.monthIndex, 1);
    const end = new Date(parsed.year, parsed.monthIndex + 1, 0);

    return {
        start: toDateInputValue(start),
        end: toDateInputValue(end)
    };
};

const getDaysOfMonth = (monthValue) => {
    const bounds = getMonthBounds(monthValue);
    if (!bounds) return [];

    const current = parseDateInput(bounds.start);
    const end = parseDateInput(bounds.end);
    const days = [];

    while (current && end && current <= end) {
        days.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }

    return days;
};

const buildAvailabilityView = (entry) => {
    const dateKey = getDateKey(entry.Data);
    const startTime = extractTime(entry.HoraInicio);
    const endTime = extractTime(entry.HoraFim);
    const date = new Date(entry.Data);

    return {
        id: entry.IdDisponibilidade || `${dateKey}-${startTime}-${endTime}`,
        dateKey,
        dateLabel: formatDate(entry.Data),
        startTime,
        endTime,
        dayOfWeek: Number.isNaN(date.getTime()) ? null : date.getDay()
    };
};

const buildMonthlyDraft = (monthValue, entries) => {
    const grouped = entries.reduce((accumulator, entry) => {
        if (!accumulator[entry.dateKey]) {
            accumulator[entry.dateKey] = [];
        }

        accumulator[entry.dateKey].push(entry);
        return accumulator;
    }, {});

    return getDaysOfMonth(monthValue).map((date) => {
        const dateKey = toDateInputValue(date);
        const slots = (grouped[dateKey] || [])
            .map((entry) => ({
                startTime: entry.startTime,
                endTime: entry.endTime
            }))
            .sort((left, right) => left.startTime.localeCompare(right.startTime));
        const starts = slots.map((entry) => entry.startTime).sort((left, right) => left.localeCompare(right));
        const ends = slots.map((entry) => entry.endTime).sort((left, right) => right.localeCompare(left));

        return {
            dateKey,
            label: new Intl.DateTimeFormat('pt-PT', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit'
            }).format(date),
            isAvailable: slots.length > 0,
            startTime: slots.length > 0 ? starts[0] : '09:00',
            endTime: slots.length > 0 ? ends[0] : '18:00',
            note: slots.length > 1 ? `${slots.length} blocos guardados neste dia.` : '',
            slots
        };
    });
};

const buildAvailabilityEntriesFromDraft = (draft) => {
    return draft
        .flatMap((day) => (day.slots || []).map((slot) => ({
            id: `draft-${day.dateKey}-${slot.startTime}-${slot.endTime}`,
            dateKey: day.dateKey,
            dateLabel: formatDate(day.dateKey),
            startTime: slot.startTime,
            endTime: slot.endTime,
            dayOfWeek: new Date(day.dateKey).getDay()
        })));
};

const buildCalendarCells = (monthValue) => {
    const parsed = parseMonthInput(monthValue);

    if (!parsed) {
        return [];
    }

    const firstDay = new Date(parsed.year, parsed.monthIndex, 1);
    const daysInMonth = new Date(parsed.year, parsed.monthIndex + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7;
    const cells = [];

    for (let index = 0; index < startOffset; index += 1) {
        cells.push({ id: `empty-start-${index}`, isCurrentMonth: false });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(parsed.year, parsed.monthIndex, day);
        cells.push({
            id: toDateInputValue(date),
            isCurrentMonth: true,
            dateKey: toDateInputValue(date),
            dayNumber: day,
            weekdayLabel: new Intl.DateTimeFormat('pt-PT', { weekday: 'short' }).format(date)
        });
    }

    while (cells.length % 7 !== 0) {
        cells.push({ id: `empty-end-${cells.length}`, isCurrentMonth: false });
    }

    return cells;
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

const normalizeText = (value) => {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
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

const buildImportDates = (cadence, row, rangeStart, rangeEnd) => {
    if (cadence === 'specific') {
        const exactDate = parseDateInput(readRowValue(row, AVAILABILITY_FIELD_ALIASES.data));

        if (!exactDate) {
            throw new Error(`Linha ${row.__line}: a coluna Data esta em falta ou e invalida.`);
        }

        return [toDateInputValue(exactDate)];
    }

    if (cadence === 'weekly') {
        const weekday = resolveWeekday(readRowValue(row, AVAILABILITY_FIELD_ALIASES.diaSemana));

        if (weekday === null) {
            throw new Error(`Linha ${row.__line}: DiaSemana invalido.`);
        }

        return buildWeeklyDates(weekday, rangeStart, rangeEnd);
    }

    const dayOfMonth = Number(readRowValue(row, AVAILABILITY_FIELD_ALIASES.diaMes));

    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
        throw new Error(`Linha ${row.__line}: DiaMes invalido.`);
    }

    return buildMonthlyDates(dayOfMonth, rangeStart, rangeEnd);
};

const dedupeAvailabilityEntries = (entries) => {
    const uniqueMap = new Map();

    entries.forEach((entry) => {
        const key = `${entry.Data}|${entry.HoraInicio}|${entry.HoraFim}`;
        uniqueMap.set(key, entry);
    });

    return [...uniqueMap.values()].sort((left, right) => {
        if (left.Data !== right.Data) {
            return left.Data.localeCompare(right.Data);
        }

        return left.HoraInicio.localeCompare(right.HoraInicio);
    });
};

const getInitialImportForm = () => {
    const today = new Date();
    const end = new Date(today);
    end.setMonth(end.getMonth() + 3);

    return {
        cadence: 'specific',
        startDate: toDateInputValue(today),
        endDate: toDateInputValue(end),
        file: null
    };
};

const TeacherSchedule = () => {
    const { user } = useAuth();
    const { notify, refreshSnapshot } = useNotifications();
    const [activeTab, setActiveTab] = useState('lessons');
    const [availabilityMode, setAvailabilityMode] = useState('calendar');
    const [lessons, setLessons] = useState([]);
    const [savedAvailability, setSavedAvailability] = useState([]);
    const [monthlyMonth, setMonthlyMonth] = useState(getMonthInputValue(new Date()));
    const [monthlyDraft, setMonthlyDraft] = useState([]);
    const [selectedCalendarDates, setSelectedCalendarDates] = useState([]);
    const [calendarTimeRange, setCalendarTimeRange] = useState({
        startTime: '09:00',
        endTime: '18:00'
    });
    const [importForm, setImportForm] = useState(getInitialImportForm);
    const [importInputKey, setImportInputKey] = useState(0);
    const [selectedLesson, setSelectedLesson] = useState(null);
    const [isStudentsModalOpen, setIsStudentsModalOpen] = useState(false);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [savingLesson, setSavingLesson] = useState(false);
    const [savingAvailability, setSavingAvailability] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');

    const loadData = async () => {
        if (!user?.Id) return;

        setLoading(true);
        setError('');

        try {
            const [aulas, disponibilidades] = await Promise.all([
                getAulas(),
                getMinhasDisponibilidades()
            ]);

            const ownLessons = aulas
                .filter((lesson) => lesson.IdProfessor === user.Id)
                .map((lesson) => ({
                    id: lesson.IdAula,
                    title: lesson.EstiloDanca?.Nome || 'Aula',
                    date: formatDate(lesson.Data),
                    time: `${extractTime(lesson.HoraInicio) || '--:--'} - ${extractTime(lesson.HoraFim) || '--:--'}`,
                    studio: lesson.Estudio?.Numero ? `Estudio ${lesson.Estudio.Numero}` : lesson.IdEstudio,
                    students: (lesson.Marcacao || []).map((booking) => ({
                        id: booking.IdAluno,
                        name: booking.Aluno?.Utilizador?.NomeCompleto || booking.IdAluno
                    })),
                    status: lesson.EstaAtivo === false ? 'cancelled' : 'scheduled'
                }));

            const availabilityView = disponibilidades
                .map(buildAvailabilityView)
                .filter((entry) => entry.dateKey && entry.startTime && entry.endTime);

            setLessons(ownLessons);
            setSavedAvailability(availabilityView);
        } catch (err) {
            setError(err.message || 'Nao foi possivel carregar os dados do professor.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [user?.Id]);

    useEffect(() => {
        setMonthlyDraft(buildMonthlyDraft(monthlyMonth, savedAvailability));
        setSelectedCalendarDates([]);
    }, [monthlyMonth, savedAvailability]);

    const filteredLessons = useMemo(() => {
        const term = searchQuery.toLowerCase();
        return lessons.filter((lesson) => (
            lesson.title.toLowerCase().includes(term) ||
            lesson.studio.toLowerCase().includes(term)
        ));
    }, [lessons, searchQuery]);

    const monthlyDraftWithSelection = useMemo(() => {
        try {
            return mergeSelectedDatesIntoDraft(monthlyDraft);
        } catch {
            return monthlyDraft;
        }
    }, [monthlyDraft, selectedCalendarDates, calendarTimeRange]);

    const monthlySavedCount = useMemo(
        () => savedAvailability.filter((entry) => entry.dateKey.startsWith(monthlyMonth)).length,
        [savedAvailability, monthlyMonth]
    );

    const monthlySummaryDays = useMemo(() => (
        monthlyDraftWithSelection.filter((day) => day.isAvailable)
    ), [monthlyDraftWithSelection]);

    const calendarCells = useMemo(
        () => buildCalendarCells(monthlyMonth),
        [monthlyMonth]
    );

    const monthlyDraftMap = useMemo(
        () => monthlyDraft.reduce((accumulator, day) => {
            accumulator[day.dateKey] = day;
            return accumulator;
        }, {}),
        [monthlyDraft]
    );

    const selectedCalendarEntries = useMemo(
        () => selectedCalendarDates
            .map((dateKey) => monthlyDraftMap[dateKey])
            .filter(Boolean),
        [monthlyDraftMap, selectedCalendarDates]
    );

    const openStudentsModal = (lesson) => {
        setSelectedLesson(lesson);
        setIsStudentsModalOpen(true);
    };

    const openCancelModal = (lesson) => {
        setSelectedLesson(lesson);
        setCancelReason('');
        setIsCancelModalOpen(true);
    };

    const handleCancelLesson = async () => {
        if (!selectedLesson) return;

        setSavingLesson(true);
        setError('');

        try {
            await cancelarAulaProfessor(selectedLesson.id);
            setIsCancelModalOpen(false);
            await refreshSnapshot();
            notify({
                title: 'Aula cancelada',
                message: `${selectedLesson.title} foi cancelada com sucesso.`,
                tone: 'success'
            });
            setFeedback('Aula cancelada com sucesso.');
            await loadData();
        } catch (err) {
            setError(err.message || 'Nao foi possivel cancelar a aula.');
        } finally {
            setSavingLesson(false);
        }
    };

    const updateMonthlyDay = (dateKey, patch) => {
        setMonthlyDraft((previous) => previous.map((day) => (
            day.dateKey === dateKey ? { ...day, ...patch } : day
        )));
    };

    const toggleCalendarDate = (dateKey) => {
        setSelectedCalendarDates((previous) => (
            previous.includes(dateKey)
                ? previous.filter((item) => item !== dateKey)
                : [...previous, dateKey].sort((left, right) => left.localeCompare(right))
        ));

        const selectedDay = monthlyDraftMap[dateKey];
        if (selectedDay?.isAvailable) {
            setCalendarTimeRange({
                startTime: selectedDay.startTime,
                endTime: selectedDay.endTime
            });
        }
    };

    const validateTimeSlot = (startTime, endTime, label) => {
        if (!normalizeTimeValue(startTime) || !normalizeTimeValue(endTime)) {
            throw new Error(`${label}: preenche HoraInicio e HoraFim corretamente.`);
        }

        if (toMinutes(startTime) >= toMinutes(endTime)) {
            throw new Error(`${label}: HoraFim tem de ser depois de HoraInicio.`);
        }
    };

    const validateSelectedDatesAreFutureOrToday = () => {
        const todayKey = toDateInputValue(new Date());
        const pastDate = selectedCalendarDates.find((dateKey) => dateKey < todayKey);

        if (pastDate) {
            throw new Error('Nao podes marcar disponibilidade em dias anteriores a hoje.');
        }
    };

    const mergeSlotIntoDay = (day, slot) => {
        const nextSlots = [...(day.slots || [])];
        const duplicate = nextSlots.some((item) => item.startTime === slot.startTime && item.endTime === slot.endTime);

        if (duplicate) {
            return day;
        }

        const overlap = nextSlots.some((item) => (
            toMinutes(slot.startTime) < toMinutes(item.endTime) &&
            toMinutes(slot.endTime) > toMinutes(item.startTime)
        ));

        if (overlap) {
            throw new Error(`${day.label}: existe sobreposicao com outro horario ja marcado.`);
        }

        nextSlots.push(slot);
        nextSlots.sort((left, right) => left.startTime.localeCompare(right.startTime));

        return {
            ...day,
            isAvailable: true,
            startTime: nextSlots[0].startTime,
            endTime: nextSlots[nextSlots.length - 1].endTime,
            note: nextSlots.length > 1 ? `${nextSlots.length} blocos guardados neste dia.` : '',
            slots: nextSlots
        };
    };

    function mergeSelectedDatesIntoDraft(draft) {
        if (selectedCalendarDates.length === 0) {
            return draft;
        }

        validateTimeSlot(calendarTimeRange.startTime, calendarTimeRange.endTime, 'Horario selecionado');
        validateSelectedDatesAreFutureOrToday();

        const selectedSet = new Set(selectedCalendarDates);
        const slot = {
            startTime: calendarTimeRange.startTime,
            endTime: calendarTimeRange.endTime
        };

        return draft.map((day) => (
            selectedSet.has(day.dateKey)
                ? mergeSlotIntoDay(day, slot)
                : day
        ));
    }

    const persistAvailability = async ({ entries, range, replaceDates, title }) => {
        setSavingAvailability(true);
        setError('');

        try {
            const normalizedEntries = dedupeAvailabilityEntries(entries);
            const result = await guardarMinhasDisponibilidades({
                replaceRange: range,
                replaceDates,
                disponibilidades: normalizedEntries
            });

            await refreshSnapshot();
            notify({
                title,
                message: result.mensagem,
                tone: 'success'
            });

            setFeedback(result.mensagem);
            await loadData();
        } catch (err) {
            setError(err.message || 'Nao foi possivel guardar a disponibilidade.');
        } finally {
            setSavingAvailability(false);
        }
    };

    const handleSaveMonthly = async () => {
        const bounds = getMonthBounds(monthlyMonth);

        if (!bounds) {
            setError('Escolha um mes valido.');
            return;
        }

        try {
            const entries = [];
            const draftToPersist = mergeSelectedDatesIntoDraft(monthlyDraft);
            const totalActiveDays = draftToPersist.filter((day) => day.isAvailable).length;

            if (totalActiveDays === 0) {
                setError('Selecione pelo menos um dia com horario antes de guardar a disponibilidade.');
                return;
            }

            setMonthlyDraft(draftToPersist);

            draftToPersist.forEach((day) => {
                if (!day.isAvailable) {
                    return;
                }

                (day.slots || []).forEach((slot) => {
                    validateTimeSlot(slot.startTime, slot.endTime, day.label);

                    entries.push({
                        Data: day.dateKey,
                        HoraInicio: buildIsoTime(day.dateKey, slot.startTime),
                        HoraFim: buildIsoTime(day.dateKey, slot.endTime)
                    });
                });
            });

            await persistAvailability({
                entries,
                range: bounds,
                title: 'Disponibilidade mensal atualizada'
            });
        } catch (err) {
            setError(err.message || 'Nao foi possivel guardar a disponibilidade mensal.');
        }
    };

    const handleSelectWeekdays = () => {
        setSelectedCalendarDates(
            monthlyDraft
                .filter((day) => {
                    const weekday = new Date(day.dateKey).getDay();
                    return weekday >= 1 && weekday <= 5;
                })
                .map((day) => day.dateKey)
        );
    };

    const handleClearSelection = () => {
        setSelectedCalendarDates([]);
    };

    const applyTimeToSelectedDates = () => {
        if (selectedCalendarDates.length === 0) {
            setError('Escolha pelo menos um dia no calendario.');
            return;
        }

        try {
            setMonthlyDraft((previous) => mergeSelectedDatesIntoDraft(previous));
        } catch (err) {
            setError(err.message || 'Nao foi possivel aplicar o horario.');
        }
    };

    const removeSelectedDatesAvailability = async () => {
        if (selectedCalendarDates.length === 0) {
            setError('Escolha pelo menos um dia no calendario.');
            return;
        }

        const totalDias = selectedCalendarDates.length;
        const confirmed = window.confirm(
            totalDias === 1
                ? 'Tem a certeza que quer remover a disponibilidade deste dia?'
                : `Tem a certeza que quer remover a disponibilidade destes ${totalDias} dias?`
        );

        if (!confirmed) {
            return;
        }

        setSavingAvailability(true);
        setError('');

        try {
            const result = await guardarMinhasDisponibilidades({
                replaceDates: selectedCalendarDates,
                disponibilidades: []
            });

            await refreshSnapshot();
            notify({
                title: 'Disponibilidade removida',
                message: result.mensagem,
                tone: 'success'
            });

            setFeedback(result.mensagem);
            setSelectedCalendarDates([]);
            await loadData();
        } catch (err) {
            setError(err.message || 'Nao foi possivel remover a disponibilidade.');
        } finally {
            setSavingAvailability(false);
        }
    };

    const getImportTemplateCopy = () => {
        if (importForm.cadence === 'weekly') {
            return 'CSV com colunas: diaSemana, horaInicio, horaFim.';
        }

        if (importForm.cadence === 'monthly') {
            return 'CSV com colunas: diaMes, horaInicio, horaFim.';
        }

        return 'CSV com colunas: data, horaInicio, horaFim.';
    };

    const handleImport = async () => {
        if (!importForm.file) {
            setError('Selecione um ficheiro CSV para importar.');
            return;
        }

        setSavingAvailability(true);
        setError('');

        try {
            const rows = parseCsvText(await importForm.file.text());
            const entries = [];
            let range = null;

            if (importForm.cadence === 'specific') {
                rows.forEach((row) => {
                    const dateKey = readRowValue(row, AVAILABILITY_FIELD_ALIASES.data);
                    const parsedDate = parseDateInput(dateKey);
                    const startTime = normalizeTimeValue(readRowValue(row, AVAILABILITY_FIELD_ALIASES.horaInicio));
                    const endTime = normalizeTimeValue(readRowValue(row, AVAILABILITY_FIELD_ALIASES.horaFim));

                    if (!parsedDate) {
                        throw new Error(`Linha ${row.__line}: Data invalida.`);
                    }

                    validateTimeSlot(startTime, endTime, `Linha ${row.__line}`);

                    const normalizedDate = toDateInputValue(parsedDate);
                    entries.push({
                        Data: normalizedDate,
                        HoraInicio: buildIsoTime(normalizedDate, startTime),
                        HoraFim: buildIsoTime(normalizedDate, endTime)
                    });
                });

                const uniqueEntries = dedupeAvailabilityEntries(entries);

                if (uniqueEntries.length === 0) {
                    throw new Error('Nao foi encontrada nenhuma disponibilidade valida no ficheiro.');
                }

                range = {
                    from: uniqueEntries[0].Data,
                    to: uniqueEntries[uniqueEntries.length - 1].Data
                };
            } else {
                const startDate = parseDateInput(importForm.startDate);
                const endDate = parseDateInput(importForm.endDate);

                if (!startDate || !endDate || endDate < startDate) {
                    throw new Error('Defina um intervalo valido para a importacao.');
                }

                rows.forEach((row) => {
                    const startTime = normalizeTimeValue(readRowValue(row, AVAILABILITY_FIELD_ALIASES.horaInicio));
                    const endTime = normalizeTimeValue(readRowValue(row, AVAILABILITY_FIELD_ALIASES.horaFim));

                    validateTimeSlot(startTime, endTime, `Linha ${row.__line}`);

                    buildImportDates(importForm.cadence, row, startDate, endDate).forEach((dateKey) => {
                        entries.push({
                            Data: dateKey,
                            HoraInicio: buildIsoTime(dateKey, startTime),
                            HoraFim: buildIsoTime(dateKey, endTime)
                        });
                    });
                });

                range = {
                    from: importForm.startDate,
                    to: importForm.endDate
                };
            }

            if (entries.length === 0) {
                throw new Error('O ficheiro nao gerou disponibilidades dentro do intervalo escolhido.');
            }

            const normalizedEntries = dedupeAvailabilityEntries(entries);
            const result = await guardarMinhasDisponibilidades({
                replaceRange: range,
                replaceDates: importForm.cadence === 'specific'
                    ? [...new Set(normalizedEntries.map((entry) => entry.Data))]
                    : undefined,
                disponibilidades: normalizedEntries
            });

            await refreshSnapshot();
            notify({
                title: 'Horario importado',
                message: result.mensagem,
                tone: 'success'
            });

            setFeedback(result.mensagem);
            setImportForm(getInitialImportForm());
            setImportInputKey((previous) => previous + 1);
            await loadData();
        } catch (err) {
            setError(err.message || 'Nao foi possivel importar o horario.');
        } finally {
            setSavingAvailability(false);
        }
    };

    return (
        <div className="teacher-page">
            <div className="teacher-header">
                <div>
                    <p className="teacher-eyebrow">Professor</p>
                    <h1>Aulas e Disponibilidade</h1>
                </div>
            </div>

            {feedback && <div className="teacher-banner teacher-banner--success">{feedback}</div>}
            {error && <div className="teacher-banner teacher-banner--error">{error}</div>}

            <div className="teacher-tabs">
                <button
                    type="button"
                    className={`teacher-tab ${activeTab === 'lessons' ? 'teacher-tab--active' : ''}`}
                    onClick={() => setActiveTab('lessons')}
                >
                    Minhas Aulas
                </button>
                <button
                    type="button"
                    className={`teacher-tab ${activeTab === 'availability' ? 'teacher-tab--active' : ''}`}
                    onClick={() => setActiveTab('availability')}
                >
                    Disponibilidade
                </button>
            </div>

            {activeTab === 'lessons' && (
                <div className="teacher-section">
                    <div className="teacher-toolbar">
                        <input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Pesquisar por estilo ou estudio..."
                        />
                        <div className="teacher-filter-badges">
                            <span className="teacher-chip teacher-chip--active">Proximas</span>
                            <span className="teacher-chip">Concluidas</span>
                            <span className="teacher-chip">Canceladas</span>
                        </div>
                    </div>

                    {loading ? (
                        <div className="teacher-empty">
                            <p className="teacher-empty-title">A carregar aulas...</p>
                        </div>
                    ) : (
                        <div className="teacher-grid">
                            {filteredLessons.filter((lesson) => lesson.status !== 'cancelled').map((lesson) => (
                                <article key={lesson.id} className="teacher-card">
                                    <div className="teacher-card-header">
                                        <span className="teacher-badge teacher-badge--primary">Aula</span>
                                        <h2>{lesson.title}</h2>
                                    </div>

                                    <div className="teacher-card-body">
                                        <p>{lesson.date}</p>
                                        <p>{lesson.time}</p>
                                        <p>{lesson.studio}</p>
                                        <p>{lesson.students.length} aluno(s) inscrito(s)</p>
                                    </div>

                                    <div className="teacher-card-actions">
                                        <button type="button" className="teacher-button teacher-button--ghost" onClick={() => openStudentsModal(lesson)}>
                                            Ver Inscritos
                                        </button>
                                        <button type="button" className="teacher-button teacher-button--danger" onClick={() => openCancelModal(lesson)}>
                                            Cancelar Aula
                                        </button>
                                    </div>
                                </article>
                            ))}

                            {filteredLessons.filter((lesson) => lesson.status === 'cancelled').map((lesson) => (
                                <article key={lesson.id} className="teacher-card teacher-card--cancelled">
                                    <div className="teacher-card-header">
                                        <span className="teacher-badge teacher-badge--danger">Cancelada</span>
                                        <h2>{lesson.title}</h2>
                                    </div>
                                    <div className="teacher-card-body">
                                        <p>{lesson.date}</p>
                                        <p>{lesson.time}</p>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'availability' && (
                <div className="teacher-section">
                    <div className="teacher-availability-actions">
                        <article className={`schedule-action-card ${availabilityMode === 'calendar' ? 'schedule-action-card--active' : ''}`}>
                            <p className="schedule-eyebrow">Modo</p>
                            <h2>Calendario</h2>
                            <p className="schedule-action-copy">
                                Clica num ou varios dias do mes e aplica o mesmo horario a todos de uma vez.
                            </p>
                            <button type="button" className="schedule-button schedule-button--primary" onClick={() => setAvailabilityMode('calendar')}>
                                Abrir calendario
                            </button>
                        </article>

                        <article className="schedule-action-card">
                            <p className="schedule-eyebrow">Modo</p>
                            <h2>Como funciona</h2>
                            <p className="schedule-action-copy">
                                Seleciona os dias no calendario, define as horas e depois guarda o mes para persistir as alteracoes.
                            </p>
                            <div className="teacher-availability-tip">Mais rapido para excecoes, ferias e dias avulso.</div>
                        </article>

                        <article className={`schedule-action-card ${availabilityMode === 'import' ? 'schedule-action-card--active' : ''}`}>
                            <p className="schedule-eyebrow">Modo</p>
                            <h2>Importar horario</h2>
                            <p className="schedule-action-copy">
                                Carrega um CSV para preencher disponibilidades especificas, semanais ou mensais em lote.
                            </p>
                            <button type="button" className="schedule-button schedule-button--ghost" onClick={() => setAvailabilityMode('import')}>
                                Importar CSV
                            </button>
                        </article>
                    </div>

                    {availabilityMode === 'calendar' && (
                        <section className="schedule-import-panel">
                            <div className="schedule-import-header">
                                <div>
                                    <p className="schedule-eyebrow">Disponibilidade</p>
                                    <h2>Calendario mensal</h2>
                                    <p className="schedule-subtitle">
                                        Escolhe um mes, clica nos dias pretendidos e aplica um horario comum aos dias selecionados.
                                    </p>
                                </div>
                            </div>

                            <div className="schedule-form">
                                <div className="schedule-form-grid">
                                    <label>
                                        <span>Mes</span>
                                        <input
                                            type="month"
                                            value={monthlyMonth}
                                            onChange={(event) => setMonthlyMonth(event.target.value)}
                                        />
                                    </label>

                                    <label>
                                        <span>Resumo do mes</span>
                                        <input type="text" value={`${monthlySavedCount} bloco(s) guardado(s)`} disabled />
                                    </label>
                                </div>
                            </div>

                            <div className="teacher-calendar-header">
                                <div>
                                    <h3>{formatMonthLabel(monthlyMonth)}</h3>
                                    <p>{selectedCalendarDates.length} dia(s) selecionado(s)</p>
                                </div>
                                <div className="teacher-availability-tools">
                                    <button type="button" className="schedule-button schedule-button--ghost" onClick={handleSelectWeekdays}>
                                        Selecionar dias uteis
                                    </button>
                                    <button type="button" className="schedule-button schedule-button--ghost" onClick={handleClearSelection}>
                                        Limpar selecao
                                    </button>
                                </div>
                            </div>

                            <div className="teacher-calendar-weekdays">
                                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'].map((label) => (
                                    <span key={label}>{label}</span>
                                ))}
                            </div>

                            <div className="teacher-calendar-grid">
                                {calendarCells.map((cell) => {
                                    if (!cell.isCurrentMonth) {
                                        return <div key={cell.id} className="teacher-calendar-day teacher-calendar-day--empty" />;
                                    }

                                    const day = monthlyDraftMap[cell.dateKey];
                                    const isSelected = selectedCalendarDates.includes(cell.dateKey);
                                    const isAvailable = Boolean(day?.isAvailable);

                                    return (
                                        <button
                                            key={cell.id}
                                            type="button"
                                            className={`teacher-calendar-day ${isSelected ? 'teacher-calendar-day--selected' : ''} ${isAvailable ? 'teacher-calendar-day--available' : ''}`}
                                            onClick={() => toggleCalendarDate(cell.dateKey)}
                                        >
                                            <strong>{cell.dayNumber}</strong>
                                            <span>
                                                {isAvailable
                                                    ? day.slots?.length > 1
                                                        ? `${day.slots.length} blocos`
                                                        : `${day.startTime}-${day.endTime}`
                                                    : 'Sem horario'}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="teacher-calendar-editor">
                                <div className="teacher-calendar-editor-copy">
                                    <h3>Horario para os dias selecionados</h3>
                                    <p>Escolhe as horas uma vez e aplica a todos os dias que marcaste no calendario.</p>
                                </div>

                                <div className="teacher-availability-time">
                                    <input
                                        type="time"
                                        value={calendarTimeRange.startTime}
                                        onChange={(event) => setCalendarTimeRange((previous) => ({ ...previous, startTime: event.target.value }))}
                                    />
                                    <span>ate</span>
                                    <input
                                        type="time"
                                        value={calendarTimeRange.endTime}
                                        onChange={(event) => setCalendarTimeRange((previous) => ({ ...previous, endTime: event.target.value }))}
                                    />
                                </div>
                            </div>

                            {selectedCalendarEntries.length > 0 && (
                                <div className="teacher-selection-summary">
                                    {selectedCalendarEntries.slice(0, 6).map((day) => (
                                        <span key={day.dateKey} className="teacher-selection-pill">
                                            {day.label}{day.slots?.length > 1 ? ` (${day.slots.length})` : ''}
                                        </span>
                                    ))}
                                    {selectedCalendarEntries.length > 6 && (
                                        <span className="teacher-selection-pill">+{selectedCalendarEntries.length - 6} dias</span>
                                    )}
                                </div>
                            )}

                            <div className="schedule-modal-actions">
                                <button type="button" className="schedule-button schedule-button--ghost" onClick={removeSelectedDatesAvailability}>
                                    Remover disponibilidade
                                </button>
                                <button type="button" className="schedule-button schedule-button--primary" onClick={handleSaveMonthly} disabled={savingAvailability}>
                                    {savingAvailability ? 'A guardar...' : 'Guardar disponibilidade'}
                                </button>
                            </div>
                        </section>
                    )}

                    {availabilityMode === 'import' && (
                        <section className="schedule-import-panel">
                            <div className="schedule-import-header">
                                <div>
                                    <p className="schedule-eyebrow">Importacao</p>
                                    <h2>Importar horario do professor</h2>
                                    <p className="schedule-subtitle">
                                        Aceita CSV com `;` ou `,` e substitui a disponibilidade apenas no periodo importado.
                                    </p>
                                </div>
                            </div>

                            <div className="schedule-segmented">
                                {[
                                    { id: 'specific', label: 'Datas exatas' },
                                    { id: 'weekly', label: 'Semanal' },
                                    { id: 'monthly', label: 'Mensal' }
                                ].map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        className={`schedule-segment ${importForm.cadence === option.id ? 'schedule-segment--active' : ''}`}
                                        onClick={() => setImportForm((previous) => ({ ...previous, cadence: option.id }))}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>

                            <p className="schedule-helper">{getImportTemplateCopy()}</p>

                            <div className="schedule-form">
                                {importForm.cadence !== 'specific' && (
                                    <div className="schedule-form-grid">
                                        <label>
                                            <span>Aplicar de</span>
                                            <input
                                                type="date"
                                                value={importForm.startDate}
                                                onChange={(event) => setImportForm((previous) => ({ ...previous, startDate: event.target.value }))}
                                            />
                                        </label>

                                        <label>
                                            <span>Aplicar ate</span>
                                            <input
                                                type="date"
                                                value={importForm.endDate}
                                                onChange={(event) => setImportForm((previous) => ({ ...previous, endDate: event.target.value }))}
                                            />
                                        </label>
                                    </div>
                                )}

                                <label className="teacher-availability-file">
                                    <span>Ficheiro CSV</span>
                                    <input
                                        key={importInputKey}
                                        type="file"
                                        accept=".csv,text/csv"
                                        onChange={(event) => setImportForm((previous) => ({ ...previous, file: event.target.files?.[0] || null }))}
                                    />
                                </label>
                            </div>

                            <div className="schedule-modal-actions">
                                <button
                                    type="button"
                                    className="schedule-button schedule-button--ghost"
                                    onClick={() => {
                                        setImportForm(getInitialImportForm());
                                        setImportInputKey((previous) => previous + 1);
                                    }}
                                >
                                    Limpar
                                </button>
                                <button type="button" className="schedule-button schedule-button--primary" onClick={handleImport} disabled={savingAvailability}>
                                    {savingAvailability ? 'A importar...' : 'Importar horario'}
                                </button>
                            </div>
                        </section>
                    )}

                    <div className="teacher-availability-card">
                        <div className="teacher-availability-header">
                            <div>
                                <h2>Resumo do Mes</h2>
                                <p>
                                    {availabilityMode === 'calendar'
                                        ? 'Pre-visualizacao dos dias e blocos horarios que estao a ser editados neste mes.'
                                        : 'Vista agregada das disponibilidades guardadas para este mes.'}
                                </p>
                            </div>
                        </div>

                        {monthlySummaryDays.length > 0 ? (
                            <ul className="schedule-summary-list">
                                {monthlySummaryDays.map((day) => (
                                    <li key={day.dateKey}>
                                        <strong>{day.label}</strong>
                                        <span>
                                            {day.slots.length === 1
                                                ? '1 bloco horario'
                                                : `${day.slots.length} blocos horarios`}
                                        </span>
                                        <span>
                                            {day.slots.map((slot) => `${slot.startTime} ate ${slot.endTime}`).join(' | ')}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="teacher-empty">
                                <p className="teacher-empty-title">Ainda nao existem disponibilidades marcadas neste mes.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {isStudentsModalOpen && selectedLesson && (
                <div className="teacher-modal-backdrop" onClick={() => setIsStudentsModalOpen(false)}>
                    <section className="teacher-modal teacher-modal--small" onClick={(event) => event.stopPropagation()}>
                        <div className="teacher-modal-header">
                            <div>
                                <p className="teacher-eyebrow">Lista de inscritos</p>
                                <h2>{selectedLesson.title}</h2>
                                <p>{selectedLesson.date} | {selectedLesson.time}</p>
                            </div>
                        </div>

                        <div className="teacher-students-list">
                            {selectedLesson.students.length === 0 ? (
                                <div className="teacher-empty">
                                    <p className="teacher-empty-title">Nenhum aluno inscrito nesta aula ainda.</p>
                                </div>
                            ) : (
                                selectedLesson.students.map((student) => (
                                    <div key={student.id} className="teacher-student-row">
                                        <div className="teacher-student-avatar">
                                            {student.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
                                        </div>
                                        <span>{student.name}</span>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="teacher-modal-actions">
                            <button type="button" className="teacher-button teacher-button--ghost" onClick={() => setIsStudentsModalOpen(false)}>
                                Fechar
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {isCancelModalOpen && selectedLesson && (
                <div className="teacher-modal-backdrop" onClick={() => setIsCancelModalOpen(false)}>
                    <section className="teacher-modal teacher-modal--small" onClick={(event) => event.stopPropagation()}>
                        <div className="teacher-modal-header">
                            <div>
                                <p className="teacher-eyebrow">Cancelar aula</p>
                                <h2>{selectedLesson.title}</h2>
                                <p>{selectedLesson.date}</p>
                            </div>
                        </div>

                        <div className="teacher-cancel-note">
                            Ao confirmar, a aula sera marcada como cancelada no sistema. O motivo abaixo e apenas informativo no frontend atual.
                        </div>

                        <label className="teacher-cancel-label">
                            <span>Motivo do cancelamento (opcional)</span>
                            <input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Ex: motivos de saude, imprevisto pessoal..." />
                        </label>

                        <div className="teacher-modal-actions">
                            <button type="button" className="teacher-button teacher-button--ghost" onClick={() => setIsCancelModalOpen(false)}>
                                Voltar
                            </button>
                            <button type="button" className="teacher-button teacher-button--danger" onClick={handleCancelLesson} disabled={savingLesson}>
                                {savingLesson ? 'A cancelar...' : 'Confirmar Cancelamento'}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default TeacherSchedule;
