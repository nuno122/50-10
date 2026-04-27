const { makeRequest, getAdminToken } = require('./setup');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

describe('Integração - Aulas', () => {
    let token;
    let profId, estudioId, estiloId;

    beforeAll(async () => {
        token = getAdminToken();

        const professor = await prisma.professor.findFirst();
        const estudio = await prisma.estudio.findFirst();
        const estilo = await prisma.estiloDanca.findFirst();

        if (professor && estudio && estilo) {
            profId = professor.IdUtilizador;
            estudioId = estudio.IdEstudio;
            estiloId = estilo.IdEstiloDanca;
        }
    });

    afterAll(async () => {
        // Limpar todas as aulas de teste da base de dados baseadas na Data de teste (2028-10-10)
        try {
            await prisma.aula.deleteMany({
                where: { Data: new Date('2028-10-10') }
            });
        } catch (e) {
            console.error('Erro na limpeza:', e.message);
        }
        await prisma.$disconnect();
    });

    it('1️⃣ Deve criar uma nova aula via API com sucesso', async () => {
        if (!profId) return;

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
    });

    it('2️⃣ Deve rejeitar a criação de uma aula no mesmo estúdio e horário (Overlap 400)', async () => {
        if (!profId) return;

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
    });
});
