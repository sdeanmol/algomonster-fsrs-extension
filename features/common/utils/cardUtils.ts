/**
 * @file features/common/utils/cardUtils.ts
 * @description Shared utilities for processing card objects safely across different module schemas.
 */

import { Card } from '../../../types/domain';

export interface CardHistoryLogEntry {
    date: number | string;
    rating?: number;
    duration?: number;
    [key: string]: unknown;
}

export interface CardLike {
    lastReview?: number | string | Date | null;
    last_review?: number | string | Date | null;
    historyLog?: (CardHistoryLogEntry | number | string)[];
    [key: string]: unknown;
}

/**
 * Robustly extracts the most recent review date from a card, normalizing across 
 * different historical data schemas (ts-fsrs snake_case, legacy camelCase, and raw historyLog).
 * 
 * @param {CardLike | null | undefined} card - The card object from the database.
 * @returns {number | null} - The timestamp of the last review, or null if never reviewed.
 */
export function getLastReviewDate(card?: CardLike | null): number | null {
    if (!card) return null;

    let lr = card.lastReview || card.last_review;

    if (!lr && card.historyLog && card.historyLog.length > 0) {
        const lastLog = card.historyLog[card.historyLog.length - 1];
        lr = typeof lastLog === 'object' && lastLog !== null ? lastLog.date : lastLog;
    }

    if (!lr) return null;

    if (typeof lr === 'number') return lr;
    if (typeof lr === 'string') {
        const parsed = Date.parse(lr);
        return isNaN(parsed) ? null : parsed;
    }
    if (lr instanceof Date) return lr.getTime();

    return null;
}

/**
 * Generates a unique string ID for a card.
 */
export function generateCardId(): string {
    return Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * Normalizes a URL by removing query strings and hash anchors.
 */
export function cleanUrl(url?: string | null): string {
    if (!url) return '';
    return url.split('?')[0].split('#')[0];
}

/**
 * Filters all cards matching the specified URL.
 */
export function getCardsForUrl(cards: Card[], url: string): Card[] {
    if (!Array.isArray(cards) || !url) return [];
    const targetClean = cleanUrl(url);
    return cards.filter(c => c && c.problemUrl && cleanUrl(c.problemUrl) === targetClean);
}

/**
 * Ensures that every card in the array has a valid unique `id` property.
 * Modifies missing IDs in-place and returns the array.
 */
export function ensureCardIds(cards: Card[]): Card[] {
    if (!Array.isArray(cards)) return [];
    try {
        const existingIds = new Set<string>();
        cards.forEach(c => {
            if (c && c.id) {
                existingIds.add(String(c.id));
            }
        });

        cards.forEach(c => {
            if (c && !c.id) {
                let newId = generateCardId();
                while (existingIds.has(newId)) {
                    newId = generateCardId();
                }
                c.id = newId;
                existingIds.add(newId);
            }
        });

        return cards;
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const logger = (globalThis as unknown as { Logger?: { error: (m: string, s: string, d?: unknown) => void } }).Logger;
        if (logger) logger.error('CardUtils', `Error in ensureCardIds: ${errorMessage}`, { err });
        // Comment: Return cards array safely even if ID generation encounters invalid objects
        return cards;
    }
}
