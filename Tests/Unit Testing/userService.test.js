const userService = require('../../backend/src/services/userService');
const userRepository = require('../../backend/src/repositories/userRepository');

jest.mock('../../backend/src/repositories/userRepository');

describe('User Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('criarUtilizador - Validação de campos obrigatórios', () => {
        it('1️⃣ Deve rejeitar com 400 quando NomeCompleto está em falta', async () => {
            const dados = { Email: 'teste@teste.com', Permissoes: 1 };
            await expect(userService.criarUtilizador(dados))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'NomeCompleto é obrigatório.' });
        });

        it('2️⃣ Deve rejeitar com 400 quando Email está em falta', async () => {
            const dados = { NomeCompleto: 'Sr. Teste', Permissoes: 1 };
            await expect(userService.criarUtilizador(dados))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Email é obrigatório.' });
        });

        it('3️⃣ Deve rejeitar com 400 quando Permissoes é um valor inválido', async () => {
            const dados = { NomeCompleto: 'Sr. Teste', Email: 't@t.com', Permissoes: 99 };
            await expect(userService.criarUtilizador(dados))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Nível de permissão inválido.' });
        });

        it('4️⃣ Deve rejeitar com 400 quando Aluno não tem DataNascimento', async () => {
            const dados = { NomeCompleto: 'Aluno', Email: 'a@a.com', Permissoes: 1 }; // Aluno = 1
            await expect(userService.criarUtilizador(dados))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Data de Nascimento é obrigatória para alunos.' });
        });

        it('5️⃣ Deve rejeitar com 400 quando Professor não tem IBAN', async () => {
            const dados = { NomeCompleto: 'Prof', Email: 'p@p.com', Permissoes: 2 }; // Professor = 2
            await expect(userService.criarUtilizador(dados))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'IBAN é obrigatório para professores.' });
        });
    });

    describe('criarUtilizador - Criação com sucesso', () => {
        it('6️⃣ Deve criar Aluno e chamar o repositório com password hasheada (não em plaintext)', async () => {
            const dados = { 
                NomeCompleto: 'Aluno OK', 
                Email: 'ok@a.com', 
                Permissoes: 1, 
                DataNascimento: '2000-01-01',
                PalavraPasse: '123456'
            };
            
            userRepository.create.mockResolvedValue({ id: 123, ...dados });

            const resultado = await userService.criarUtilizador(dados);

            expect(resultado.id).toBe(123);
            expect(userRepository.create).toHaveBeenCalled();
            
            // Verifica que a password enviada ao repo não é a plaintext '123456'
            const callData = userRepository.create.mock.calls[0][0];
            expect(callData.PalavraPasseHash).toBeDefined();
            expect(callData.PalavraPasseHash).not.toBe('123456');
        });

        it('7️⃣ Deve criar Direção (Permissoes: 3) sem campos extra obrigatórios', async () => {
            const dados = { 
                NomeCompleto: 'Admin', 
                Email: 'admin@a.com', 
                Permissoes: 3,
                PalavraPasse: 'secret'
            };
            
            userRepository.create.mockResolvedValue({ id: 1, ...dados });

            const resultado = await userService.criarUtilizador(dados);
            expect(resultado.id).toBe(1);
        });
    });
});
