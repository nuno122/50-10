const API_ORIGIN = 'http://localhost:3000';

export const resolveInventoryImageUrl = (imagePath) => {
    if (!imagePath || typeof imagePath !== 'string') {
        return '';
    }

    const trimmedPath = imagePath.trim().replace(/\\/g, '/');
    if (!trimmedPath) {
        return '';
    }

    if (trimmedPath.startsWith('data:')) {
        return trimmedPath;
    }

    if (/^https?:\/\//i.test(trimmedPath)) {
        return trimmedPath;
    }

    const relativePath = trimmedPath
        .replace(/^.*\/frontend\/images\//i, '')
        .replace(/^\.?\/*images\//i, '')
        .replace(/^\/+/, '');

    if (!relativePath) {
        return '';
    }

    return new URL(`/images/${relativePath}`, API_ORIGIN).toString();
};
