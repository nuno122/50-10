const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { verificarToken, verificarPermissao } = require('../authMiddleware');
const PERMISSOES = require('../config/permissions');

router.get(
    '/',
    verificarToken,
    verificarPermissao(PERMISSOES.DIRECAO, PERMISSOES.PROFESSOR, PERMISSOES.ENCARREGADO),
    eventController.getEventos
);

router.post(
    '/',
    verificarToken,
    verificarPermissao(PERMISSOES.DIRECAO),
    eventController.createEvento
);

router.patch(
    '/:idEvento',
    verificarToken,
    verificarPermissao(PERMISSOES.DIRECAO),
    eventController.updateEvento
);

router.delete(
    '/:idEvento',
    verificarToken,
    verificarPermissao(PERMISSOES.DIRECAO),
    eventController.deleteEvento
);

router.post(
    '/:idEvento/comentarios',
    verificarToken,
    verificarPermissao(PERMISSOES.PROFESSOR),
    eventController.createComentario
);

router.patch(
    '/comentarios/:idEventoComentario',
    verificarToken,
    verificarPermissao(PERMISSOES.PROFESSOR),
    eventController.updateComentario
);

module.exports = router;
