const express = require('express');
const router = express.Router();
const privateLessonRequestController = require('../controllers/privateLessonRequestController');
const { verificarToken, verificarPermissao } = require('../authMiddleware');
const PERMISSOES = require('../config/permissions');

router.get(
    '/',
    verificarToken,
    verificarPermissao(PERMISSOES.DIRECAO),
    privateLessonRequestController.getPedidos
);

router.get(
    '/encarregado',
    verificarToken,
    verificarPermissao(PERMISSOES.ENCARREGADO),
    privateLessonRequestController.getPedidosDoEncarregado
);

router.post(
    '/',
    verificarToken,
    verificarPermissao(PERMISSOES.ENCARREGADO),
    privateLessonRequestController.criarPedido
);

router.patch(
    '/:idPedidoAulaPrivada/aprovar',
    verificarToken,
    verificarPermissao(PERMISSOES.DIRECAO),
    privateLessonRequestController.aprovarPedido
);

router.patch(
    '/:idPedidoAulaPrivada/rejeitar',
    verificarToken,
    verificarPermissao(PERMISSOES.DIRECAO),
    privateLessonRequestController.rejeitarPedido
);

module.exports = router;
