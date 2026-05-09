const logControllerError = (context, erro) => {
    const status = erro?.statusCode || 500;

    if (status >= 500) {
        console.error(`[${context}]`, erro);
    }

    return status;
};

const handleControllerError = (res, erro, fallbackMessage, context) => {
    const status = logControllerError(context, erro);
    res.status(status).json({
        erro: erro?.message || fallbackMessage
    });
};

module.exports = {
    logControllerError,
    handleControllerError
};
