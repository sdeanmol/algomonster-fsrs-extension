/**
 * @file features/common/utils/cardUtils.ts
 * @description Shared utilities for processing card objects safely across different module schemas.
 */

import { Logger } from '@common/logger';
import { Card } from '../../../types/domain';
import { UIUtils } from './uiUtils';

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
    try {
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
    } catch (err) {
        UIUtils.catchError('CardUtils', 'Error in getLastReviewDate', err, { card });
        return null;
    }
}

/**
 * Generates a unique string ID for a card.
 */
export function generateCardId(): string {
    try {
        return Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
    } catch (err) {
        UIUtils.catchError('CardUtils', 'Error generating card ID', err);
        return `id_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    }
}

/**
 * Normalizes a URL by removing query strings and hash anchors.
 */
export function cleanUrl(url?: string | null): string {
    if (!url) return '';
    try {
        return url.split('?')[0].split('#')[0];
    } catch (err) {
        UIUtils.catchError('CardUtils', `Error cleaning URL '${url}'`, err, { url });
        return String(url);
    }
}

/**
 * Filters all cards matching the specified URL.
 */
export function getCardsForUrl(cards: Card[], url: string): Card[] {
    if (!Array.isArray(cards) || !url) return [];
    try {
        const targetClean = cleanUrl(url);
        return cards.filter(c => c && c.problemUrl && cleanUrl(c.problemUrl) === targetClean);
    } catch (err) {
        UIUtils.catchError('CardUtils', `Error filtering cards for URL '${url}'`, err, { url });
        return [];
    }
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
        UIUtils.catchError('CardUtils', 'Error in ensureCardIds', err);
        return cards;
    }
}
