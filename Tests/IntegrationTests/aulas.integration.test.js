const { makeRequest, getAdminToken } = require('./setup');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

describe('Integração - Aulas', () => {
    let token;
    let profId, estudioId, estiloId;
    let createdAulaIds = [];

    beforeAll(async () => {
        token = getAdminToken();

        const estiloProfessor = await prisma.estiloProfessor.findFirst({
            include: { Professor: true, EstiloDanca: true }
        });
        
        if (estiloProfessor) {
            const estudioEstilo = await prisma.estudioEstilo.findFirst({
                where: { IdEstiloDanca: estiloProfessor.IdEstiloDanca }
            });

            if (estudioEstilo) {
                profId = estiloProfessor.IdProfessor;
                estiloId = estiloProfessor.IdEstiloDanca;
                estudioId = estudioEstilo.IdEstudio;
            }
        }
        
        if (!profId) {
            // Criar dados temporários para o teste
            let cp = await prisma.codigoPostal.findFirst();
            if (!cp) {
                cp = await prisma.codigoPostal.create({ data: { CodigoPostal: '1000-000', Localidade: 'Lisboa' } });
            }

            const prefix = Date.now().toString() + Math.floor(Math.random() * 1000).toString();
            const nifRandom = Math.floor(100000 + Math.random() * 900000).toString();
            const utilizador = await prisma.utilizador.create({
                data: {
                    CodigoPostal: cp.CodigoPostal,
                    Morada: 'Rua do Teste',
                    Permissoes: 2,
                    NomeCompleto: `Professor Integ ${prefix}`,
                    NomeUtilizador: `profinteg${prefix}`,
                    Email: `profinteg${prefix}@teste.com`,
                    PalavraPasseHash: 'hash',
                    EstaAtivo: true,
                    Nif: `999${nifRandom}`
                }
            });

            const professor = await prisma.professor.create({
                data: {
                    IdUtilizador: utilizador.IdUtilizador,
                    Iban: 'PT50000000000000000000000'
                }
            });

            const estilo = await prisma.estiloDanca.create({
                data: { Nome: `Estilo Integ ${prefix}` }
            });

            const estudio = await prisma.estudio.create({
                data: { Numero: parseInt(Math.floor(Math.random() * 900) + 100), Capacidade: 20 }
            });

            await prisma.estiloProfessor.create({
                data: { IdProfessor: professor.IdUtilizador, IdEstiloDanca: estilo.IdEstiloDanca }
            });

            await prisma.estudioEstilo.create({
                data: { IdEstudio: estudio.IdEstudio, IdEstiloDanca: estilo.IdEstiloDanca }
            });

            // Disponibilidade para passar nas verificações de classe
            await prisma.disponibilidade.create({
                data: {
                    IdProfessor: professor.IdUtilizador,
                    Data: new Date('2028-10-10'),
                    HoraInicio: new Date('2028-10-10T08:00:00.000Z'),
                    HoraFim: new Date('2028-10-10T18:00:00.000Z')
                }
            });

            profId = professor.IdUtilizador;
            estiloId = estilo.IdEstiloDanca;
            estudioId = estudio.IdEstudio;
        }
    });

    afterAll(async () => {
        // Limpar apenas as aulas criadas por este teste
        try {
            if (createdAulaIds.length > 0) {
                await prisma.aula.deleteMany({
                    where: { IdAula: { in: createdAulaIds } }
                });
            }
        } catch (e) {
            console.error('Erro na limpeza:', e.message);
        }
        await prisma.$disconnect();
    });

    it('1️⃣ Deve criar uma nova aula via API com sucesso', async () => {

        const payload = {
            Data: '2028-10-10T00:00:00.000Z',
            HoraInicio: '1970-01-01T10:00:00.000Z',
            HoraFim: '1970-01-01T11:00:00.000Z',
            CapacidadeMaxima: 25,
            Preco: 15.50,
            IdProfessor: profId,
            IdEstudio: estudioId,
            IdEstiloDanca: estiloId
        };

        const response = await makeRequest('/aulas', 'POST', payload, token);
        
        expect(response.status).toBe(201);
        expect(response.data.mensagem).toBe('Aula agendada!');
        expect(response.data.aula).toBeDefined();
        
        if (response.data.aula && response.data.aula.IdAula) {
            createdAulaIds.push(response.data.aula.IdAula);
        }
    });

    it('2️⃣ Deve rejeitar a criação de uma aula no mesmo estúdio e horário (Overlap 400)', async () => {

        const payload = {
            Data: '2028-10-10T00:00:00.000Z',
            HoraInicio: '1970-01-01T10:30:00.000Z',
            HoraFim: '1970-01-01T11:30:00.000Z',
            CapacidadeMaxima: 25,
            Preco: 15.50,
            IdProfessor: profId,
            IdEstudio: estudioId,
            IdEstiloDanca: estiloId
        };

        const response = await makeRequest('/aulas', 'POST', payload, token);
        
        expect(response.status).toBe(400);
        expect(response.data.erro).toBe('Conflito de horario! Estudio ocupado.');
        
        if (response.status === 201 && response.data.aula) {
            createdAulaIds.push(response.data.aula.IdAula);
        }
    });
});
