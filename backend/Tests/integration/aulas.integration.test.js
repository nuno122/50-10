const { makeRequest, getAdminToken, ensureDatabaseReady, ensurePostalCode, prisma } = require('./setup');

describe('Integracao - Aulas', () => {
    let token;
    let profId;
    let estudioId;
    let estiloId;
    let createdAulaIds = [];
    let createdDisponibilidadeIds = [];
    let createdEstudioId = null;
    let createdEstiloId = null;
    let createdProfessorUserId = null;

    beforeAll(async () => {
        await ensureDatabaseReady();
        token = await getAdminToken();

        const codigoPostal = await ensurePostalCode();
        const prefix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

        const utilizador = await prisma.utilizador.create({
            data: {
                CodigoPostal: codigoPostal.CodigoPostal,
                Morada: 'Rua do Teste',
                Permissoes: 2,
                NomeCompleto: `Professor Integ ${prefix}`,
                NomeUtilizador: `profinteg${prefix}`,
                Email: `profinteg${prefix}@teste.com`,
                PalavraPasseHash: 'hash',
                EstaAtivo: true,
                Nif: `93${prefix}`.slice(0, 9),
                Professor: {
                    create: {
                        Iban: 'PT50000000000000000000000'
                    }
                }
            }
        });

        createdProfessorUserId = utilizador.IdUtilizador;

        const estilo = await prisma.estiloDanca.create({
            data: {
                Nome: `Estilo Integ ${prefix}`
            }
        });

        const estudio = await prisma.estudio.create({
            data: {
                Numero: Number(String(Date.now()).slice(-3)),
                Capacidade: 20
            }
        });

        await prisma.estiloProfessor.create({
            data: {
                IdProfessor: utilizador.IdUtilizador,
                IdEstiloDanca: estilo.IdEstiloDanca
            }
        });

        await prisma.estudioEstilo.create({
            data: {
                IdEstudio: estudio.IdEstudio,
                IdEstiloDanca: estilo.IdEstiloDanca
            }
        });

        const disponibilidade = await prisma.disponibilidade.create({
            data: {
                IdProfessor: utilizador.IdUtilizador,
                Data: new Date('2028-10-10'),
                HoraInicio: new Date('1970-01-01T08:00:00.000Z'),
                HoraFim: new Date('1970-01-01T18:00:00.000Z')
            }
        });

        createdDisponibilidadeIds.push(disponibilidade.IdDisponibilidade);
        createdEstiloId = estilo.IdEstiloDanca;
        createdEstudioId = estudio.IdEstudio;
        profId = utilizador.IdUtilizador;
        estiloId = estilo.IdEstiloDanca;
        estudioId = estudio.IdEstudio;
    });

    afterAll(async () => {
        if (createdAulaIds.length > 0) {
            await prisma.aula.deleteMany({
                where: { IdAula: { in: createdAulaIds } }
            });
        }

        if (createdDisponibilidadeIds.length > 0) {
            await prisma.disponibilidade.deleteMany({
                where: { IdDisponibilidade: { in: createdDisponibilidadeIds } }
            });
        }

        if (createdEstudioId && createdEstiloId) {
            await prisma.estudioEstilo.deleteMany({
                where: {
                    IdEstudio: createdEstudioId,
                    IdEstiloDanca: createdEstiloId
                }
            });
        }

        if (createdProfessorUserId && createdEstiloId) {
            await prisma.estiloProfessor.deleteMany({
                where: {
                    IdProfessor: createdProfessorUserId,
                    IdEstiloDanca: createdEstiloId
                }
            });
        }

        if (createdEstudioId) {
            await prisma.estudio.deleteMany({
                where: { IdEstudio: createdEstudioId }
            });
        }

        if (createdEstiloId) {
            await prisma.estiloDanca.deleteMany({
                where: { IdEstiloDanca: createdEstiloId }
            });
        }

        if (createdProfessorUserId) {
            await prisma.professor.deleteMany({
                where: { IdUtilizador: createdProfessorUserId }
            });

            await prisma.utilizador.deleteMany({
                where: { IdUtilizador: createdProfessorUserId }
            });
        }

        await prisma.$disconnect();
    });

    it('1 Deve criar uma nova aula via API com sucesso', async () => {
        const payload = {
            Data: '2028-10-10T00:00:00.000Z',
            HoraInicio: '1970-01-01T10:00:00.000Z',
            HoraFim: '1970-01-01T11:00:00.000Z',
            CapacidadeMaxima: 20,
            Preco: 15.5,
            IdProfessor: profId,
            IdEstudio: estudioId,
            IdEstiloDanca: estiloId
        };

        const response = await makeRequest('/aulas', 'POST', payload, token);

        expect(response.status).toBe(201);
        expect(response.data.mensagem).toBe('Aula agendada!');
        expect(response.data.aula).toBeDefined();

        if (response.data.aula?.IdAula) {
            createdAulaIds.push(response.data.aula.IdAula);
        }
    });

    it('2 Deve rejeitar a criacao de uma aula no mesmo estudio e horario (400)', async () => {
        const payload = {
            Data: '2028-10-10T00:00:00.000Z',
            HoraInicio: '1970-01-01T10:30:00.000Z',
            HoraFim: '1970-01-01T11:30:00.000Z',
            CapacidadeMaxima: 20,
            Preco: 15.5,
            IdProfessor: profId,
            IdEstudio: estudioId,
            IdEstiloDanca: estiloId
        };

        const response = await makeRequest('/aulas', 'POST', payload, token);

        expect(response.status).toBe(400);
        expect(response.data.erro).toMatch(/est[úu]dio ocupado/i);
    });
});
