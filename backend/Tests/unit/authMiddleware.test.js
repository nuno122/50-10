const jwt = require('jsonwebtoken');
const { verificarToken, verificarPermissao } = require('../../src/authMiddleware');
const userRepository = require('../../src/repositories/userRepository');

jest.mock('../../src/repositories/userRepository');

describe('Auth Middleware', () => {
    let req;
    let res;
    let next;

    const JWT_SECRET = process.env.JWT_SECRET || "ChaveSuperSecretaDaEntArtes_2026";

    beforeEach(() => {
        jest.clearAllMocks();

        req = { headers: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        next = jest.fn();
    });

    describe('verificarToken', () => {
        it('deve rejeitar requisicao sem header authorization', async () => {
            await verificarToken(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ erro: 'Acesso negado! Inicie sessão para continuar.' });
            expect(next).not.toHaveBeenCalled();
        });

        it('deve rejeitar se authorization nao comecar com Bearer', async () => {
            req.headers.authorization = 'TokenInvalido 123';

            await verificarToken(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });

        it('deve chamar next e usar os dados atuais da base de dados quando o token for valido', async () => {
            const tokenValido = jwt.sign(
                { IdUtilizador: 'user-1', Permissoes: 3 },
                JWT_SECRET,
                { expiresIn: '1h' }
            );
            req.headers.authorization = `Bearer ${tokenValido}`;
            userRepository.findAuthById.mockResolvedValue({
                IdUtilizador: 'user-1',
                Email: 'direcao@example.com',
                NomeCompleto: 'Direcao Teste',
                Permissoes: 3,
                EstaAtivo: true
            });

            await verificarToken(req, res, next);

            expect(userRepository.findAuthById).toHaveBeenCalledWith('user-1');
            expect(next).toHaveBeenCalled();
            expect(req.utilizador).toMatchObject({
                IdUtilizador: 'user-1',
                Email: 'direcao@example.com',
                NomeCompleto: 'Direcao Teste',
                Permissoes: 3,
                EstaAtivo: true
            });
        });

        it('deve rejeitar token valido se o utilizador ja nao existir', async () => {
            const tokenValido = jwt.sign({ IdUtilizador: 'apagado', Permissoes: 3 }, JWT_SECRET, { expiresIn: '1h' });
            req.headers.authorization = `Bearer ${tokenValido}`;
            userRepository.findAuthById.mockResolvedValue(null);

            await verificarToken(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ erro: 'Sessão expirada ou inválida. Por favor, inicie sessão novamente.' });
            expect(next).not.toHaveBeenCalled();
        });

        it('deve rejeitar token valido se o utilizador estiver inativo', async () => {
            const tokenValido = jwt.sign({ IdUtilizador: 'inativo', Permissoes: 3 }, JWT_SECRET, { expiresIn: '1h' });
            req.headers.authorization = `Bearer ${tokenValido}`;
            userRepository.findAuthById.mockResolvedValue({
                IdUtilizador: 'inativo',
                Permissoes: 3,
                EstaAtivo: false
            });

            await verificarToken(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });

        it('deve rejeitar token expirado', async () => {
            const tokenExpirado = jwt.sign({ IdUtilizador: 'user-1' }, JWT_SECRET, { expiresIn: '-1s' });
            req.headers.authorization = `Bearer ${tokenExpirado}`;

            await verificarToken(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ erro: 'Sessão expirada ou inválida. Por favor, inicie sessão novamente.' });
        });

        it('deve rejeitar token mal-formado', async () => {
            req.headers.authorization = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature';

            await verificarToken(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ erro: 'Sessão expirada ou inválida. Por favor, inicie sessão novamente.' });
        });
    });

    describe('verificarPermissao', () => {
        it('deve permitir quando a permissao atual esta autorizada', () => {
            req.utilizador = { Permissoes: 3 };

            verificarPermissao(3)(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('deve rejeitar quando a permissao atual nao esta autorizada', () => {
            req.utilizador = { Permissoes: 2 };

            verificarPermissao(3)(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });
    });
});
