# TODO: Sistema Pedidos de Extensão Aluguer

## ✅ Ficheiros Existentes
- [x] rentalRepository.js, rentalService.js, rentalController.js, rentalRoutes.js

## 🔄 Plano Detalhado (4 passos)

### 1. rentalRepository.js (BD Prisma)
```
criarPedidoExtensao(idAluguer, novaDataProposta)
getPedidoExtensaoById(idPedido) { include: Aluguer }
atualizarEstadoPedido(idPedido, estado)
atualizarAluguer(idAluguer, novaDataEntrega, custoAdicional)
```

### 2. rentalService.js (Regras Negócio)
```
solicitarExtensao(idAluguer, novaData): valida + cria "Pendente"
avaliarPedidoExtensao(idPedido, aprovado, valorAdicional): 404 se não existe + update
```

### 3. rentalController.js (HTTP)
```
POST /:id/extensao → 201 + msg
PATCH /pedidos-extensao/:id/avaliar → 200 + msg (400 erro)
```

### 4. rentalRoutes.js (Rotas protegidas)
```
POST('/:id/extensao', verificarToken, solicitarExtensaoPrazo)
PATCH('/pedidos-extensao/:id/avaliar', verificarToken, avaliarPedido)
```
**index.js:** já tem rentalRoutes ✓

## ⏭️ Próximos Passos
1. Editar ficheiros conforme plano
2. `cd backend && npm start` 
3. Testar: POST aluguer → POST extensao → PATCH avaliar

**Confirma plano antes editar?** 👍

