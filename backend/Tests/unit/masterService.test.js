const masterService = require('../../src/services/masterService');
const masterRepository = require('../../src/repositories/masterRepository');

jest.mock('../../src/repositories/masterRepository');

describe('Master Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        masterRepository.findActiveAulasByEstilo.mockResolvedValue([]);
        masterRepository.findPendingPedidosByEstilo.mockResolvedValue([]);
        masterRepository.findActiveStudiosByEstilo.mockResolvedValue([]);
        masterRepository.findActiveAulasByEstudio.mockResolvedValue([]);
    });

    describe('criarEstilo', () => {
        it('deve rejeitar quando o nome nao e fornecido', async () => {
            await expect(masterService.criarEstilo({ Nome: '' }))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'O nome do estilo e obrigatorio.' });
        });

        it('deve rejeitar quando ja existe um estilo com esse nome', async () => {
            masterRepository.findEstiloByNome.mockResolvedValue({ IdEstiloDanca: 'estilo-1', EstaAtivo: true });

            await expect(masterService.criarEstilo({ Nome: 'Ballet' }))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Ja existe um estilo com esse nome.' });
        });

        it('deve rejeitar quando ja existe um estilo inativo com esse nome', async () => {
            masterRepository.findEstiloByNome.mockResolvedValue({ IdEstiloDanca: 'estilo-1', EstaAtivo: false });

            await expect(masterService.criarEstilo({ Nome: 'Ballet' }))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Ja existe um estilo inativo com esse nome. Reativa-o em vez de criar outro.' });
        });

        it('deve criar o estilo com sucesso', async () => {
            masterRepository.findEstiloByNome.mockResolvedValue(null);
            masterRepository.createEstilo.mockResolvedValue({ IdEstiloDanca: 'estilo-1', Nome: 'Ballet' });

            const resultado = await masterService.criarEstilo({ Nome: '  Ballet  ' });

            expect(masterRepository.createEstilo).toHaveBeenCalledWith({ Nome: 'Ballet' });
            expect(resultado.IdEstiloDanca).toBe('estilo-1');
        });
    });

    describe('removerEstilo', () => {
        it('deve inativar um estilo ativo sem o apagar', async () => {
            masterRepository.findEstiloById.mockResolvedValue({
                IdEstiloDanca: 'estilo-1',
                EstaAtivo: true
            });
            masterRepository.updateEstiloStatus.mockResolvedValue({ IdEstiloDanca: 'estilo-1', EstaAtivo: false });

            await masterService.removerEstilo('estilo-1');

            expect(masterRepository.updateEstiloStatus).toHaveBeenCalledWith('estilo-1', false);
        });

        it('deve bloquear se o estilo ja estiver inativo', async () => {
            masterRepository.findEstiloById.mockResolvedValue({
                IdEstiloDanca: 'estilo-1',
                EstaAtivo: false
            });

            await expect(masterService.removerEstilo('estilo-1'))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'O estilo já se encontra inativo.' });
        });

        it('deve bloquear se existirem aulas futuras para esse estilo', async () => {
            masterRepository.findEstiloById.mockResolvedValue({
                IdEstiloDanca: 'estilo-1',
                EstaAtivo: true
            });
            masterRepository.findActiveAulasByEstilo.mockResolvedValue([
                {
                    IdAula: 'aula-1',
                    Data: '2099-01-01',
                    HoraFim: '1970-01-01T19:00:00.000Z',
                    Marcacao: []
                }
            ]);

            await expect(masterService.removerEstilo('estilo-1'))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Não pode inativar este estilo porque tem aulas futuras associadas.' });
        });

        it('deve bloquear se existirem pedidos de Coaching pendentes para esse estilo', async () => {
            masterRepository.findEstiloById.mockResolvedValue({
                IdEstiloDanca: 'estilo-1',
                EstaAtivo: true
            });
            masterRepository.findPendingPedidosByEstilo.mockResolvedValue([
                {
                    IdPedidoAulaPrivada: 'pedido-1',
                    DataPretendida: '2099-01-01',
                    HoraPretendida: '1970-01-01T18:00:00.000Z'
                }
            ]);

            await expect(masterService.removerEstilo('estilo-1'))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Não pode inativar este estilo porque existem pedidos de Coaching pendentes para esse estilo.' });
        });

        it('deve bloquear se deixar estudios ativos sem estilos ativos', async () => {
            masterRepository.findEstiloById.mockResolvedValue({
                IdEstiloDanca: 'estilo-1',
                EstaAtivo: true
            });
            masterRepository.findActiveStudiosByEstilo.mockResolvedValue([
                {
                    IdEstudio: 'est-1',
                    EstudioEstilo: [
                        {
                            IdEstiloDanca: 'estilo-1',
                            EstiloDanca: { EstaAtivo: true }
                        }
                    ]
                }
            ]);

            await expect(masterService.removerEstilo('estilo-1'))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Não pode inativar este estilo porque deixaria estúdios ativos sem estilos ativos associados.' });
        });
    });

    describe('atualizarEstadoEstudio', () => {
        it('deve bloquear a reativacao quando nao existem estilos ativos associados', async () => {
            masterRepository.findEstudioById.mockResolvedValue({
                IdEstudio: 'est-1',
                EstaAtivo: false,
                EstudioEstilo: [
                    {
                        IdEstiloDanca: 'estilo-1',
                        EstiloDanca: { EstaAtivo: false }
                    }
                ]
            });

            await expect(masterService.atualizarEstadoEstudio('est-1', true))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Não pode reativar um estúdio sem pelo menos um estilo ativo associado.' });
        });

        it('deve reativar quando existe pelo menos um estilo ativo associado', async () => {
            masterRepository.findEstudioById.mockResolvedValue({
                IdEstudio: 'est-1',
                EstaAtivo: false,
                EstudioEstilo: [
                    {
                        IdEstiloDanca: 'estilo-1',
                        EstiloDanca: { EstaAtivo: true }
                    }
                ]
            });
            masterRepository.updateEstudioStatus.mockResolvedValue({ IdEstudio: 'est-1', EstaAtivo: true });

            await masterService.atualizarEstadoEstudio('est-1', true);

            expect(masterRepository.updateEstudioStatus).toHaveBeenCalledWith('est-1', true);
        });
    });

    describe('criarEstudio', () => {
        it('deve rejeitar quando nao existem estilos associados', async () => {
            await expect(masterService.criarEstudio({
                Numero: 1,
                Capacidade: 10,
                IdsEstiloDanca: []
            }))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Selecione pelo menos um estilo ativo para o estúdio.' });
        });

        it('deve rejeitar quando algum estilo nao existe ou esta inativo', async () => {
            masterRepository.findEstilosByIds.mockResolvedValue([{ IdEstiloDanca: 'estilo-1' }]);

            await expect(masterService.criarEstudio({
                Numero: 1,
                Capacidade: 10,
                IdsEstiloDanca: ['estilo-1', 'estilo-2']
            }))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Um ou mais estilos selecionados nao existem ou estao inativos.' });
        });

        it('deve rejeitar quando ja existe um estudio ativo com esse numero', async () => {
            masterRepository.findEstilosByIds.mockResolvedValue([{ IdEstiloDanca: 'estilo-1' }]);
            masterRepository.findEstudioByNumero.mockResolvedValue({ IdEstudio: 'est-1', EstaAtivo: true });

            await expect(masterService.criarEstudio({
                Numero: 3,
                Capacidade: 12,
                IdsEstiloDanca: ['estilo-1']
            }))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Já existe um estúdio com esse número.' });
        });

        it('deve rejeitar quando ja existe um estudio inativo com esse numero', async () => {
            masterRepository.findEstilosByIds.mockResolvedValue([{ IdEstiloDanca: 'estilo-1' }]);
            masterRepository.findEstudioByNumero.mockResolvedValue({ IdEstudio: 'est-1', EstaAtivo: false });

            await expect(masterService.criarEstudio({
                Numero: 3,
                Capacidade: 12,
                IdsEstiloDanca: ['estilo-1']
            }))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Já existe um estúdio inativo com esse número. Reative-o em vez de criar outro.' });
        });

        it('deve criar o estudio com sucesso', async () => {
            masterRepository.findEstilosByIds.mockResolvedValue([{ IdEstiloDanca: 'estilo-1' }]);
            masterRepository.findEstudioByNumero.mockResolvedValue(null);
            masterRepository.createEstudio.mockResolvedValue({ IdEstudio: 'est-1', Numero: 4 });

            const resultado = await masterService.criarEstudio({
                Numero: 4,
                Capacidade: 18,
                IdsEstiloDanca: ['estilo-1', 'estilo-1']
            });

            expect(masterRepository.createEstudio).toHaveBeenCalledWith({
                Numero: 4,
                Capacidade: 18,
                IdsEstiloDanca: ['estilo-1']
            });
            expect(resultado.IdEstudio).toBe('est-1');
        });
    });

    describe('removerEstudio', () => {
        it('deve inativar um estudio ativo sem o apagar', async () => {
            masterRepository.findEstudioById.mockResolvedValue({
                IdEstudio: 'est-1',
                EstaAtivo: true
            });
            masterRepository.updateEstudioStatus.mockResolvedValue({ IdEstudio: 'est-1', EstaAtivo: false });

            await masterService.removerEstudio('est-1');

            expect(masterRepository.updateEstudioStatus).toHaveBeenCalledWith('est-1', false);
        });

        it('deve bloquear se o estudio ja estiver inativo', async () => {
            masterRepository.findEstudioById.mockResolvedValue({
                IdEstudio: 'est-1',
                EstaAtivo: false
            });

            await expect(masterService.removerEstudio('est-1'))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'O estúdio já se encontra inativo.' });
        });

        it('deve bloquear se existirem aulas futuras com marcacoes nesse estudio', async () => {
            masterRepository.findEstudioById.mockResolvedValue({
                IdEstudio: 'est-1',
                EstaAtivo: true
            });
            masterRepository.findActiveAulasByEstudio.mockResolvedValue([
                {
                    IdAula: 'aula-1',
                    Data: '2099-01-01',
                    HoraFim: '1970-01-01T19:00:00.000Z',
                    Marcacao: [{ IdMarcacao: 'marc-1' }]
                }
            ]);

            await expect(masterService.removerEstudio('est-1'))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Não pode inativar este estúdio porque tem aulas futuras com marcações associadas.' });
        });
    });

    describe('atualizarEstudio', () => {
        it('deve bloquear se a nova capacidade ficar abaixo de aulas futuras ja agendadas', async () => {
            masterRepository.findEstilosByIds.mockResolvedValue([{ IdEstiloDanca: 'estilo-1' }]);
            masterRepository.findEstudioById.mockResolvedValue({
                IdEstudio: 'est-1',
                EstaAtivo: true
            });
            masterRepository.findEstudioByNumero.mockResolvedValue({ IdEstudio: 'est-1', EstaAtivo: true });
            masterRepository.findActiveAulasByEstudio.mockResolvedValue([
                {
                    IdAula: 'aula-1',
                    Data: '2099-01-01',
                    HoraFim: '1970-01-01T19:00:00.000Z',
                    CapacidadeMaxima: 12,
                    IdEstiloDanca: 'estilo-1'
                }
            ]);

            await expect(masterService.atualizarEstudio('est-1', {
                Numero: 1,
                Capacidade: 10,
                IdsEstiloDanca: ['estilo-1']
            }))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Não pode reduzir a capacidade do estúdio abaixo da capacidade máxima de aulas futuras já agendadas.' });
        });

        it('deve bloquear se tentar remover do estudio um estilo usado em aulas futuras', async () => {
            masterRepository.findEstilosByIds.mockResolvedValue([{ IdEstiloDanca: 'estilo-2' }]);
            masterRepository.findEstudioById.mockResolvedValue({
                IdEstudio: 'est-1',
                EstaAtivo: true
            });
            masterRepository.findEstudioByNumero.mockResolvedValue({ IdEstudio: 'est-1', EstaAtivo: true });
            masterRepository.findActiveAulasByEstudio.mockResolvedValue([
                {
                    IdAula: 'aula-1',
                    Data: '2099-01-01',
                    HoraFim: '1970-01-01T19:00:00.000Z',
                    CapacidadeMaxima: 10,
                    IdEstiloDanca: 'estilo-1'
                }
            ]);

            await expect(masterService.atualizarEstudio('est-1', {
                Numero: 1,
                Capacidade: 20,
                IdsEstiloDanca: ['estilo-2']
            }))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Não pode remover deste estúdio estilos que ainda estão a ser usados em aulas futuras.' });
        });
    });
});
