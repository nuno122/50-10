const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "ChaveSuperSecretaDaEntArtes_2026";

// Simular testes do middleware
console.log("=== TESTES DO AUTH MIDDLEWARE ===\n");

// 1. Teste: Gerar um token válido
console.log("1️⃣  Gerando token válido...");
const tokenValido = jwt.sign(
    { id: 1, email: "teste@example.com", role: "user" },
    JWT_SECRET,
    { expiresIn: '1h' }
);
console.log("✅ Token gerado:", tokenValido.substring(0, 20) + "...\n");

// 2. Teste: Verificar token válido
console.log("2️⃣  Verificando token válido...");
try {
    const decoded = jwt.verify(tokenValido, JWT_SECRET);
    console.log("✅ Token inválido e válido. Utilizador:", decoded, "\n");
} catch (erro) {
    console.log("❌ Erro:", erro.message, "\n");
}

// 3. Teste: Token expirado
console.log("3️⃣  Testando token expirado...");
const tokenExpirado = jwt.sign(
    { id: 1, email: "teste@example.com" },
    JWT_SECRET,
    { expiresIn: '-1s' } // Já expirou
);
try {
    jwt.verify(tokenExpirado, jwt.SECRET);
    console.log("❌ Token deveria estar expirado!\n");
} catch (erro) {
    console.log("✅ Erro esperado:", erro.message, "\n");
}

// 4. Teste: Token inválido/corrompido
console.log("4️⃣  Testando token corrompido...");
const tokenInvalido = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature";
try {
    jwt.verify(tokenInvalido, JWT_SECRET);
    console.log("❌ Token deveria ser inválido!\n");
} catch (erro) {
    console.log("✅ Erro esperado:", erro.message, "\n");
}

// 5. Teste: Simulando middleware
console.log("5️⃣  Simulando middleware com requisição sem token...");
const reqSemToken = {
    headers: {
        authorization: undefined
    }
};
if (!reqSemToken.headers.authorization || !reqSemToken.headers.authorization.startsWith('Bearer ')) {
    console.log("✅ Middleware rejeitaria: Acesso negado! Inicie sessão para continuar.\n");
}

// 6. Teste: Middleware com token válido
console.log("6️⃣  Simulando middleware com token válido...");
const reqComToken = {
    headers: {
        authorization: `Bearer ${tokenValido}`
    }
};
const cabecalho = reqComToken.headers.authorization;
if (cabecalho && cabecalho.startsWith('Bearer ')) {
    const token = cabecalho.split(' ')[1];
    try {
        const user = jwt.verify(token, JWT_SECRET);
        console.log("✅ Middleware aceitaria. Utilizador:", user.email, "\n");
    } catch (erro) {
        console.log("❌ Erro:", erro.message, "\n");
    }
}

console.log("=== TESTES CONCLUÍDOS ===");
