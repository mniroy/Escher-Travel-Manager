import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const getArea = (address?: string, description?: string) => {
    // Fallback to description if address is missing (often description contains address)
    const text = address || description;
    if (!text) return 'Unspecified Location';

    const parts = text.split(',').map(p => p.trim());
    // Heuristic: Try to grab City/District (usually 3rd from last, or 1st if short)
    if (parts.length >= 3) {
        // Try to avoid "Indonesia" or zip codes if possible, but keeping it simple for now
        // Usually: Street, Village, District, Regency, Province, Country
        // We want 'Canggu', 'Ubud', 'Seminyak' which are often ~3rd or 4th from end.
        return parts[Math.max(0, parts.length - 3)];
    }
    return parts[0] || 'Unspecified Location';
};

// --- Time Helpers ---

export const parseTime = (str: string) => {
    try {
        if (!str || str.startsWith('NaN')) return 9 * 60; // Heal bad data

        const parts = str.trim().split(/\s+/);
        // Handle "9:00 AM" or just "9:00"
        const timePart = parts[0];
        const period = parts.length > 1 ? parts[1] : null;

        let [h, m] = timePart.split(':').map(Number);

        if (isNaN(h) || isNaN(m)) return 9 * 60; // Fallback

        if (period) {
            if (period.toUpperCase() === 'PM' && h !== 12) h += 12;
            if (period.toUpperCase() === 'AM' && h === 12) h = 0;
        }
        return h * 60 + m;
    } catch (e) {
        return 9 * 60; // Default 9 AM
    }
};

export const formatTime = (minutes: number) => {
    let h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0 || h === 24) h = 12;
    if (h > 24) h -= 24;
    return `${h}:${m.toString().padStart(2, '0')} ${period}`;
};

export const parseDuration = (str?: string) => {
    if (!str) return 60;
    try {
        const hMatch = str.match(/(\d+)h/);
        const mMatch = str.match(/(\d+)m/);
        let m = 0;
        if (hMatch) m += parseInt(hMatch[1]) * 60;
        if (mMatch) m += parseInt(mMatch[1]);
        return m || 60;
    } catch (e) {
        return 60;
    }
};

export const formatDuration = (mins: number) => {
    if (mins <= 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ''}`;
    return `${m}m`;
};

