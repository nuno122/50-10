const availabilityService = require('../../backend/src/services/availabilityService');
const availabilityRepo = require('../../backend/src/repositories/availabilityRepository');

jest.mock('../../backend/src/repositories/availabilityRepository');

describe('Availability Service', () => {
    const utilizadorProfessor = {
        IdUtilizador: 'prof-1'
    };

    beforeEach(() => {
        jest.clearAllMocks();
        availabilityRepo.findProfessorById.mockResolvedValue({ IdUtilizador: 'prof-1' });
    });

    it('deve rejeitar quando o intervalo a substituir nao e enviado', async () => {
        await expect(availabilityService.guardarMinhasDisponibilidades(utilizadorProfessor, {
            disponibilidades: []
        })).rejects.toThrow('Indica o intervalo a substituir em replaceRange.from e replaceRange.to.');
    });

    it('deve rejeitar disponibilidades com horarios sobrepostos no mesmo dia', async () => {
        await expect(availabilityService.guardarMinhasDisponibilidades(utilizadorProfessor, {
            replaceRange: {
                from: '2026-05-01',
                to: '2026-05-31'
            },
            disponibilidades: [
                {
                    Data: '2026-05-05',
                    HoraInicio: '2026-05-05T09:00:00.000Z',
                    HoraFim: '2026-05-05T11:00:00.000Z'
                },
                {
                    Data: '2026-05-05',
                    HoraInicio: '2026-05-05T10:30:00.000Z',
                    HoraFim: '2026-05-05T12:00:00.000Z'
                }
            ]
        })).rejects.toThrow('Existem disponibilidades sobrepostas em 2026-05-05.');
    });

    it('deve guardar disponibilidades deduplicadas com sucesso', async () => {
        availabilityRepo.replaceByProfessorInScope.mockResolvedValue([
            {
                IdDisponibilidade: 'disp-1',
                Data: new Date('2026-05-05T00:00:00.000Z'),
                HoraInicio: new Date('1970-01-01T09:00:00.000Z'),
                HoraFim: new Date('1970-01-01T11:00:00.000Z')
            }
        ]);

        const resultado = await availabilityService.guardarMinhasDisponibilidades(utilizadorProfessor, {
            replaceRange: {
                from: '2026-05-01',
                to: '2026-05-31'
            },
            disponibilidades: [
                {
                    Data: '2026-05-05',
                    HoraInicio: '2026-05-05T09:00:00.000Z',
                    HoraFim: '2026-05-05T11:00:00.000Z'
                },
                {
                    Data: '2026-05-05',
                    HoraInicio: '2026-05-05T09:00:00.000Z',
                    HoraFim: '2026-05-05T11:00:00.000Z'
                }
            ]
        });

        expect(availabilityRepo.replaceByProfessorInScope).toHaveBeenCalledWith('prof-1', {
            scope: {
                type: 'range',
                from: '2026-05-01',
                to: '2026-05-31'
            },
            disponibilidades: [
                {
                    Data: '2026-05-05',
                    HoraInicio: '2026-05-05T09:00:00.000Z',
                    HoraFim: '2026-05-05T11:00:00.000Z'
                }
            ]
        });
        expect(resultado.mensagem).toBe('1 disponibilidade(s) guardada(s) com sucesso.');
        expect(resultado.totalGuardadas).toBe(1);
    });

    it('deve inferir o intervalo a partir das datas recebidas quando replaceRange nao vier', async () => {
        availabilityRepo.replaceByProfessorInScope.mockResolvedValue([
            {
                IdDisponibilidade: 'disp-1',
                Data: new Date('2026-05-05T00:00:00.000Z'),
                HoraInicio: new Date('1970-01-01T09:00:00.000Z'),
                HoraFim: new Date('1970-01-01T11:00:00.000Z')
            }
        ]);

        await availabilityService.guardarMinhasDisponibilidades(utilizadorProfessor, {
            disponibilidades: [
                {
                    Data: '2026-05-05',
                    HoraInicio: '2026-05-05T09:00:00.000Z',
                    HoraFim: '2026-05-05T11:00:00.000Z'
                },
                {
                    Data: '2026-05-18',
                    HoraInicio: '2026-05-18T14:00:00.000Z',
                    HoraFim: '2026-05-18T16:00:00.000Z'
                }
            ]
        });

        expect(availabilityRepo.replaceByProfessorInScope).toHaveBeenCalledWith('prof-1', {
            scope: {
                type: 'range',
                from: '2026-05-05',
                to: '2026-05-18'
            },
            disponibilidades: [
                {
                    Data: '2026-05-05',
                    HoraInicio: '2026-05-05T09:00:00.000Z',
                    HoraFim: '2026-05-05T11:00:00.000Z'
                },
                {
                    Data: '2026-05-18',
                    HoraInicio: '2026-05-18T14:00:00.000Z',
                    HoraFim: '2026-05-18T16:00:00.000Z'
                }
            ]
        });
    });

    it('deve permitir substituir apenas datas especificas na importacao', async () => {
        availabilityRepo.replaceByProfessorInScope.mockResolvedValue([]);

        await availabilityService.guardarMinhasDisponibilidades(utilizadorProfessor, {
            replaceDates: ['2026-05-05', '2026-05-12'],
            disponibilidades: [
                {
                    Data: '2026-05-05',
                    HoraInicio: '2026-05-05T09:00:00.000Z',
                    HoraFim: '2026-05-05T11:00:00.000Z'
                }
            ]
        });

        expect(availabilityRepo.replaceByProfessorInScope).toHaveBeenCalledWith('prof-1', {
            scope: {
                type: 'dates',
                dates: ['2026-05-05', '2026-05-12']
            },
            disponibilidades: [
                {
                    Data: '2026-05-05',
                    HoraInicio: '2026-05-05T09:00:00.000Z',
                    HoraFim: '2026-05-05T11:00:00.000Z'
                }
            ]
        });
    });

    it('deve aceitar aliases range e entries no payload', async () => {
        availabilityRepo.replaceByProfessorInScope.mockResolvedValue([]);

        await availabilityService.guardarMinhasDisponibilidades(utilizadorProfessor, {
            range: {
                from: '2026-06-01',
                to: '2026-06-30'
            },
            entries: [
                {
                    Data: '2026-06-03',
                    HoraInicio: '2026-06-03T10:00:00.000Z',
                    HoraFim: '2026-06-03T12:00:00.000Z'
                }
            ]
        });

        expect(availabilityRepo.replaceByProfessorInScope).toHaveBeenCalledWith('prof-1', {
            scope: {
                type: 'range',
                from: '2026-06-01',
                to: '2026-06-30'
            },
            disponibilidades: [
                {
                    Data: '2026-06-03',
                    HoraInicio: '2026-06-03T10:00:00.000Z',
                    HoraFim: '2026-06-03T12:00:00.000Z'
                }
            ]
        });
    });

    it('deve aceitar start e end dentro de replaceRange', async () => {
        availabilityRepo.replaceByProfessorInScope.mockResolvedValue([]);

        await availabilityService.guardarMinhasDisponibilidades(utilizadorProfessor, {
            replaceRange: {
                start: '2026-05-01',
                end: '2026-05-31'
            },
            disponibilidades: []
        });

        expect(availabilityRepo.replaceByProfessorInScope).toHaveBeenCalledWith('prof-1', {
            scope: {
                type: 'range',
                from: '2026-05-01',
                to: '2026-05-31'
            },
            disponibilidades: []
        });
    });
});
