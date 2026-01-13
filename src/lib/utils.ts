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
