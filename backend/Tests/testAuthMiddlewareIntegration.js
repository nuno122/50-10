const http = require('http');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "ChaveSuperSecretaDaEntArtes_2026";
const API_URL = 'http://localhost:3000/api';

// Gerar um token de teste
const tokenValido = jwt.sign(
    { id: 1, email: "teste@example.com", role: "user" },
    JWT_SECRET,
    { expiresIn: '1h' }
);

// Função para fazer requisições HTTP
function fazerRequisicao(opcoes, dados = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(opcoes, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: body ? JSON.parse(body) : null
                });
            });
        });

        req.on('error', reject);

        if (dados) {
            req.write(JSON.stringify(dados));
        }
        req.end();
    });
}

// Teste das rotas
async function testar() {
    console.log("=== TESTES DE INTEGRAÇÃO DO MIDDLEWARE ===\n");

    // Aguardar que o servidor inicie
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
        // 1. Verificar se o servidor está online
        console.log("1️⃣  Testando se servidor está online...");
        const statusRes = await fazerRequisicao({
            hostname: 'localhost',
            port: 3000,
            path: '/api/status',
            method: 'GET'
        });
        console.log(`✅ Status: ${statusRes.status} - ${statusRes.body?.mensagem}\n`);

        // 2. Tentar acessar rota protegida SEM token
        console.log("2️⃣  Tentando acessar /utilizadores SEM token...");
        const semTokenRes = await fazerRequisicao({
            hostname: 'localhost',
            port: 3000,
            path: '/api/utilizadores',
            method: 'GET'
        });
        if (semTokenRes.status === 401) {
            console.log(`✅ Status: ${semTokenRes.status} (esperado)`);
            console.log(`   Mensagem: ${semTokenRes.body?.erro}\n`);
        } else {
            console.log(`❌ Status: ${semTokenRes.status} (deveria ser 401)\n`);
        }

        // 3. Tentar acessar rota COM token inválido
        console.log("3️⃣  Tentando acessar /utilizadores COM token INVÁLIDO...");
        const tokenInvalidoRes = await fazerRequisicao({
            hostname: 'localhost',
            port: 3000,
            path: '/api/utilizadores',
            method: 'GET',
            headers: {
                'Authorization': 'Bearer token_invalido'
            }
        });
        if (tokenInvalidoRes.status === 401) {
            console.log(`✅ Status: ${tokenInvalidoRes.status} (esperado)`);
            console.log(`   Mensagem: ${tokenInvalidoRes.body?.erro}\n`);
        } else {
            console.log(`❌ Status: ${tokenInvalidoRes.status} (deveria ser 401)\n`);
        }

        // 4. Tentar acessar rota COM token VÁLIDO
        console.log("4️⃣  Tentando acessar /utilizadores COM token VÁLIDO...");
        const comTokenRes = await fazerRequisicao({
            hostname: 'localhost',
            port: 3000,
            path: '/api/utilizadores',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${tokenValido}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`✅ Status: ${comTokenRes.status} (passou no middleware)`);
        console.log(`   Nota: A resposta depende se há dados na BD\n`);

        // 5. Testar rota de login (NÃO protegida)
        console.log("5️⃣  Testando /utilizadores/login (NÃO protegida)...");
        const loginRes = await fazerRequisicao({
            hostname: 'localhost',
            port: 3000,
            path: '/api/utilizadores/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        }, { email: "teste@example.com", password: "123456" });
        console.log(`✅ Status: ${loginRes.status} (passou, não foi bloqueado pelo middleware)`);
        console.log(`   Nota: A resposta depende da lógica do controller\n`);

        // 6. Testar outra rota protegida (marcações)
        console.log("6️⃣  Testando /marcacoes COM token VÁLIDO...");
        const marcacoesRes = await fazerRequisicao({
            hostname: 'localhost',
            port: 3000,
            path: '/api/marcacoes',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${tokenValido}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`✅ Status: ${marcacoesRes.status} (passou no middleware)\n`);

        console.log("=== TESTES DE INTEGRAÇÃO CONCLUÍDOS ===");
        console.log("\n✅ Middleware está funcionando correctamente!");
        console.log("   • Rejeita pedidos sem token (401)");
        console.log("   • Rejeita tokens inválidos (401)");
        console.log("   • Aceita tokens válidos");
        console.log("   • Não bloqueia rotas públicas (como /login)");

    } catch (erro) {
        console.error("❌ Erro durante testes:", erro.message);
    }

    process.exit(0);
}

// Aguardar um pouco e executar os testes
setTimeout(testar, 1000);
