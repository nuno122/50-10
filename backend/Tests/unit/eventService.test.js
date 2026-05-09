const eventRepository = require('../../src/repositories/eventRepository');
const eventService = require('../../src/services/eventService');
const PERMISSOES = require('../../src/config/permissions');

jest.mock('../../src/repositories/eventRepository');

describe('Event Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('criarEvento', () => {
        it('deve criar um evento quando a Direcao envia dados validos', async () => {
            eventRepository.create.mockResolvedValue({ IdEvento: 'evento-1', Titulo: 'Workshop de Verao' });

            const resultado = await eventService.criarEvento({
                Titulo: 'Workshop de Verao',
                Descricao: 'Evento aberto a todos os encarregados.',
                DataPublicacaoInicio: '2028-05-01T09:00',
                DataPublicacaoFim: '2028-05-20T18:00',
                DataEvento: '2028-05-25'
            }, {
                IdUtilizador: 'dir-1',
                Permissoes: PERMISSOES.DIRECAO
            });

            expect(resultado.IdEvento).toBe('evento-1');
            expect(eventRepository.create).toHaveBeenCalledWith(expect.objectContaining({
                IdUtilizadorCriador: 'dir-1',
                Titulo: 'Workshop de Verao',
                TipoEvento: 'Geral',
                Local: '',
                Link: '',
                EstadoEvento: true
            }));
        });

        it('deve rejeitar criacao por um professor', async () => {
            await expect(eventService.criarEvento({
                Titulo: 'T',
                Descricao: 'D',
                DataPublicacaoInicio: '2028-05-01T09:00',
                DataPublicacaoFim: '2028-05-20T18:00',
                DataEvento: '2028-05-25',
                Local: 'L',
                TipoEvento: 'Tipo',
                Link: 'https://entartes.pt'
            }, {
                IdUtilizador: 'prof-1',
                Permissoes: PERMISSOES.PROFESSOR
            })).rejects.toThrow('Apenas a Direção pode criar eventos.');

            expect(eventRepository.create).not.toHaveBeenCalled();
        });
    });

    describe('listarEventos', () => {
        it('deve listar todos os eventos para a Direcao', async () => {
            eventRepository.findAll.mockResolvedValue([{ IdEvento: 'evento-1' }]);

            const resultado = await eventService.listarEventos({
                IdUtilizador: 'dir-1',
                Permissoes: PERMISSOES.DIRECAO
            });

            expect(resultado).toHaveLength(1);
            expect(eventRepository.findAll).toHaveBeenCalled();
            expect(eventRepository.findPublished).not.toHaveBeenCalled();
        });

        it('deve listar apenas eventos publicados para o Encarregado', async () => {
            eventRepository.findPublished.mockResolvedValue([{ IdEvento: 'evento-2' }]);

            const resultado = await eventService.listarEventos({
                IdUtilizador: 'enc-1',
                Permissoes: PERMISSOES.ENCARREGADO
            });

            expect(resultado).toHaveLength(1);
            expect(eventRepository.findPublished).toHaveBeenCalled();
            expect(eventRepository.findAll).not.toHaveBeenCalled();
        });
    });

    describe('editarEvento', () => {
        it('deve permitir que a Direcao edite um evento existente', async () => {
            eventRepository.findById.mockResolvedValue({ IdEvento: 'evento-1' });
            eventRepository.update.mockResolvedValue({ IdEvento: 'evento-1', Titulo: 'Evento atualizado' });

            const resultado = await eventService.editarEvento('evento-1', {
                Titulo: 'Evento atualizado',
                Descricao: 'Descricao atualizada',
                DataPublicacaoInicio: '2028-05-01T09:00',
                DataPublicacaoFim: '2028-05-20T18:00',
                DataEvento: '2028-05-25'
            }, {
                IdUtilizador: 'dir-1',
                Permissoes: PERMISSOES.DIRECAO
            });

            expect(resultado.Titulo).toBe('Evento atualizado');
            expect(eventRepository.update).toHaveBeenCalledWith('evento-1', expect.objectContaining({
                Titulo: 'Evento atualizado'
            }));
        });
    });

    describe('removerEvento', () => {
        it('deve permitir que a Direcao remova um evento existente', async () => {
            eventRepository.findById.mockResolvedValue({ IdEvento: 'evento-1' });
            eventRepository.delete.mockResolvedValue({ IdEvento: 'evento-1' });

            const resultado = await eventService.removerEvento('evento-1', {
                IdUtilizador: 'dir-1',
                Permissoes: PERMISSOES.DIRECAO
            });

            expect(resultado.mensagem).toBe('Evento removido com sucesso.');
            expect(eventRepository.delete).toHaveBeenCalledWith('evento-1');
        });
    });

    describe('adicionarComentario', () => {
        it('deve permitir que o professor comente um evento ativo', async () => {
            eventRepository.findById.mockResolvedValue({
                IdEvento: 'evento-1',
                EstadoEvento: true,
                DataPublicacaoFim: new Date('2028-05-20T18:00:00.000Z')
            });
            eventRepository.createComment.mockResolvedValue({
                IdEventoComentario: 'coment-1',
                Comentario: 'Posso apoiar a dinamizacao deste evento.'
            });

            const resultado = await eventService.adicionarComentario(
                'evento-1',
                'Posso apoiar a dinamizacao deste evento.',
                {
                    IdUtilizador: 'prof-1',
                    Permissoes: PERMISSOES.PROFESSOR
                }
            );

            expect(resultado.comentario.IdEventoComentario).toBe('coment-1');
            expect(eventRepository.createComment).toHaveBeenCalledWith({
                IdEvento: 'evento-1',
                IdProfessor: 'prof-1',
                Comentario: 'Posso apoiar a dinamizacao deste evento.'
            });
        });

        it('deve rejeitar comentario em evento inexistente', async () => {
            eventRepository.findById.mockResolvedValue(null);

            await expect(eventService.adicionarComentario(
                'evento-404',
                'Comentario de teste',
                {
                    IdUtilizador: 'prof-1',
                    Permissoes: PERMISSOES.PROFESSOR
                }
            )).rejects.toThrow('Evento nao encontrado.');
        });
    });

    describe('editarComentario', () => {
        it('deve permitir que o professor edite um comentario seu', async () => {
            eventRepository.findCommentById.mockResolvedValue({
                IdEventoComentario: 'coment-1',
                IdProfessor: 'prof-1',
                Comentario: 'Texto antigo'
            });
            eventRepository.updateComment.mockResolvedValue({
                IdEventoComentario: 'coment-1',
                Comentario: 'Texto novo'
            });

            const resultado = await eventService.editarComentario(
                'coment-1',
                'Texto novo',
                {
                    IdUtilizador: 'prof-1',
                    Permissoes: PERMISSOES.PROFESSOR
                }
            );

            expect(resultado.comentario.Comentario).toBe('Texto novo');
            expect(eventRepository.updateComment).toHaveBeenCalledWith(
                'coment-1',
                expect.objectContaining({ Comentario: 'Texto novo' })
            );
        });

        it('deve impedir a edicao de comentarios de outros professores', async () => {
            eventRepository.findCommentById.mockResolvedValue({
                IdEventoComentario: 'coment-1',
                IdProfessor: 'prof-2'
            });

            await expect(eventService.editarComentario(
                'coment-1',
                'Texto novo',
                {
                    IdUtilizador: 'prof-1',
                    Permissoes: PERMISSOES.PROFESSOR
                }
            )).rejects.toThrow('So pode editar comentarios da sua autoria.');
        });
    });
});
