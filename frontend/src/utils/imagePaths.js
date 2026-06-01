const DEFAULT_API_ORIGIN = 'http://localhost:3000';
const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
const API_ORIGIN = rawApiBaseUrl
    ? rawApiBaseUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '')
    : DEFAULT_API_ORIGIN;

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

    const encodedPath = relativePath
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');

    return new URL(`/images/${encodedPath}`, API_ORIGIN).toString();
};
