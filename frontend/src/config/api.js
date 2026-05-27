const normalizeBaseUrl = (value, fallback) => {
    const resolvedValue = typeof value === 'string' ? value.trim() : '';
    const candidate = resolvedValue || fallback;

    return candidate.replace(/\/+$/, '');
};

export const API_BASE_URL = normalizeBaseUrl(
    import.meta.env.VITE_API_BASE_URL,
    'http://localhost:3000/api'
);

export const API_ORIGIN = normalizeBaseUrl(
    import.meta.env.VITE_API_ORIGIN,
    API_BASE_URL.replace(/\/api$/, '')
);
