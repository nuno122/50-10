const fs = require('fs');
const path = require('path');

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const IMAGES_DIR = path.join(__dirname, '..', '..', '..', 'frontend', 'Images');

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

const parseContentDisposition = (value = '') => {
    return value.split(';').reduce((result, part) => {
        const [key, ...rawValue] = part.trim().split('=');
        if (!key || rawValue.length === 0) return result;

        result[key.toLowerCase()] = rawValue.join('=').trim().replace(/^"|"$/g, '');
        return result;
    }, {});
};

const sanitizeFilename = (filename) => {
    if (!filename || typeof filename !== 'string') {
        return '';
    }

    const baseName = path.basename(filename.replace(/\\/g, '/'));
    return baseName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
};

const parseMultipart = (buffer, boundary) => {
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const parts = [];
    let cursor = 0;

    while (cursor < buffer.length) {
        const boundaryStart = buffer.indexOf(boundaryBuffer, cursor);
        if (boundaryStart === -1) break;

        let partStart = boundaryStart + boundaryBuffer.length;

        if (buffer[partStart] === 45 && buffer[partStart + 1] === 45) {
            break;
        }

        if (buffer[partStart] === 13 && buffer[partStart + 1] === 10) {
            partStart += 2;
        }

        const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), partStart);
        if (headerEnd === -1) break;

        const nextBoundary = buffer.indexOf(boundaryBuffer, headerEnd + 4);
        if (nextBoundary === -1) break;

        let contentEnd = nextBoundary;
        if (buffer[contentEnd - 2] === 13 && buffer[contentEnd - 1] === 10) {
            contentEnd -= 2;
        }

        const headers = buffer
            .slice(partStart, headerEnd)
            .toString('latin1')
            .split('\r\n')
            .reduce((result, line) => {
                const separatorIndex = line.indexOf(':');
                if (separatorIndex === -1) return result;

                const key = line.slice(0, separatorIndex).trim().toLowerCase();
                result[key] = line.slice(separatorIndex + 1).trim();
                return result;
            }, {});

        parts.push({
            headers,
            content: buffer.slice(headerEnd + 4, contentEnd)
        });

        cursor = nextBoundary;
    }

    return parts;
};

const inventoryImageUpload = (req, res, next) => {
    const contentType = req.headers['content-type'] || '';

    if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
        return next();
    }

    let completed = false;
    const handleError = (erro) => {
        if (completed) return;

        completed = true;
        if (res.headersSent) {
            next(erro);
            return;
        }

        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Nao foi possivel carregar a imagem.'
        });
    };

    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) {
        return handleError(criarErro('Pedido multipart sem boundary.', 400));
    }

    const chunks = [];
    let totalSize = 0;

    req.on('data', (chunk) => {
        if (completed) return;

        totalSize += chunk.length;

        if (totalSize > MAX_UPLOAD_SIZE) {
            handleError(criarErro('A imagem nao pode ultrapassar 5 MB.', 413));
            req.destroy();
            return;
        }

        chunks.push(chunk);
    });

    req.on('error', (erro) => {
        handleError(erro);
    });

    req.on('end', () => {
        if (completed) return;

        try {
            const boundary = boundaryMatch[1] || boundaryMatch[2];
            const parts = parseMultipart(Buffer.concat(chunks), boundary);
            const body = {};
            let savedFile = null;

            for (const part of parts) {
                const disposition = parseContentDisposition(part.headers['content-disposition']);
                const fieldName = disposition.name;
                if (!fieldName) continue;

                if (disposition.filename) {
                    if (part.content.length === 0) continue;

                    const filename = sanitizeFilename(disposition.filename);
                    const extension = path.extname(filename).toLowerCase();

                    if (!filename || !ALLOWED_EXTENSIONS.has(extension)) {
                        throw criarErro('A imagem deve ser JPG, PNG, WEBP ou GIF.', 400);
                    }

                    fs.mkdirSync(IMAGES_DIR, { recursive: true });
                    const destination = path.join(IMAGES_DIR, filename);
                    fs.writeFileSync(destination, part.content);

                    savedFile = {
                        fieldname: fieldName,
                        originalname: disposition.filename,
                        filename,
                        path: destination
                    };
                    body.ImagemPath = filename;
                } else {
                    body[fieldName] = part.content.toString('utf8');
                }
            }

            req.body = body;
            req.file = savedFile;
            completed = true;
            next();
        } catch (erro) {
            handleError(erro);
        }
    });
};

module.exports = inventoryImageUpload;
