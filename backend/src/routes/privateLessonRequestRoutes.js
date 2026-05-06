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

router.get(
    '/professor',
    verificarToken,
    verificarPermissao(PERMISSOES.PROFESSOR),
    privateLessonRequestController.getPedidosDoProfessor
);

router.post(
    '/',
    verificarToken,
    verificarPermissao(PERMISSOES.ENCARREGADO),
    privateLessonRequestController.criarPedido
);

router.patch(
    '/:idPedidoAulaPrivada/confirmar-professor',
    verificarToken,
    verificarPermissao(PERMISSOES.PROFESSOR),
    privateLessonRequestController.confirmarPedidoProfessor
);

router.patch(
    '/:idPedidoAulaPrivada/rejeitar-professor',
    verificarToken,
    verificarPermissao(PERMISSOES.PROFESSOR),
    privateLessonRequestController.rejeitarPedidoProfessor
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
