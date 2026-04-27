const inventoryService = require('../../backend/src/services/inventoryService');
const inventoryRepository = require('../../backend/src/repositories/inventoryRepository');

jest.mock('../../backend/src/repositories/inventoryRepository');

describe('Inventory Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('criarArtigo', () => {
        it('1️⃣ Deve rejeitar com 400 quando Nome está em falta', async () => {
            const dados = { CustoPorDia: 10, QuantidadeTotal: 5 };
            await expect(inventoryService.criarArtigo(dados))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Nome do artigo é obrigatório.' });
        });

        it('2️⃣ Deve rejeitar com 400 quando CustoPorDia está em falta', async () => {
            const dados = { Nome: 'Violino', QuantidadeTotal: 5 };
            await expect(inventoryService.criarArtigo(dados))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Custo por dia deve ser um valor positivo.' });
        });

        it('3️⃣ Deve criar artigo com sucesso quando os dados são válidos', async () => {
            const dados = { Nome: 'Guitarra', CustoPorDia: 15, QuantidadeTotal: 10 };
            inventoryRepository.create.mockResolvedValue({ IdArtigo: 1, ...dados });

            const resultado = await inventoryService.criarArtigo(dados);

            expect(resultado.IdArtigo).toBe(1);
            expect(inventoryRepository.create).toHaveBeenCalledWith(dados);
        });
    });

    describe('editarArtigo', () => {
        it('4️⃣ Deve rejeitar com 400 quando id está em falta', async () => {
            await expect(inventoryService.editarArtigo(null, {}))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'ID do artigo é obrigatório para edição.' });
        });

        it('5️⃣ Deve chamar o repositório com os dados corretos quando id é válido', async () => {
            const id = 5;
            const novosDados = { Nome: 'Guitarra Elétrica' };
            inventoryRepository.update.mockResolvedValue({ IdArtigo: id, ...novosDados });

            const resultado = await inventoryService.editarArtigo(id, novosDados);

            expect(resultado.IdArtigo).toBe(id);
            expect(inventoryRepository.update).toHaveBeenCalledWith(id, novosDados);
        });
    });

    describe('removerArtigo', () => {
        it('6️⃣ Deve rejeitar com 400 quando id está em falta', async () => {
            await expect(inventoryService.removerArtigo(undefined))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'ID do artigo é obrigatório para remoção.' });
        });

        it('7️⃣ Deve remover e devolver mensagem de confirmação', async () => {
            inventoryRepository.delete.mockResolvedValue(true);
            const resultado = await inventoryService.removerArtigo(10);
            expect(resultado).toBe(true);
            expect(inventoryRepository.delete).toHaveBeenCalledWith(10);
        });
    });
});
