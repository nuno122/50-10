const { verificarToken } = require('../../backend/src/authMiddleware');
const jwt = require('jsonwebtoken');

describe('Auth Middleware - verificarToken', () => {
    let req, res, next;

    const JWT_SECRET = process.env.JWT_SECRET || "ChaveSuperSecretaDaEntArtes_2026";

    beforeEach(() => {
        req = { headers: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        next = jest.fn();
    });

    it('1️⃣ Deve rejeitar requisição sem header authorization', () => {
        verificarToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ erro: "Acesso negado! Inicie sessão para continuar." });
        expect(next).not.toHaveBeenCalled();
    });

    it('2️⃣ Deve rejeitar se authorization não começar com Bearer', () => {
        req.headers.authorization = "TokenInvalido 123";
        verificarToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('3️⃣ Deve chamar next() e setar req.utilizador se o token for válido', () => {
        const tokenValido = jwt.sign({ id: 1, email: "teste@example.com", role: "user" }, JWT_SECRET, { expiresIn: '1h' });
        req.headers.authorization = `Bearer ${tokenValido}`;

        verificarToken(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.utilizador).toBeDefined();
        expect(req.utilizador.email).toBe("teste@example.com");
    });

    it('4️⃣ Deve rejeitar com sessão expirada se o token tiver expirado', () => {
        const tokenExpirado = jwt.sign({ id: 1, email: "teste@example.com" }, JWT_SECRET, { expiresIn: '-1s' });
        req.headers.authorization = `Bearer ${tokenExpirado}`;

        verificarToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ erro: "Sessão expirada ou inválida. Por favor, faça login novamente." });
    });

    it('5️⃣ Deve rejeitar token mal-formado', () => {
        req.headers.authorization = `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature`;

        verificarToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ erro: "Sessão expirada ou inválida. Por favor, faça login novamente." });
    });
});
