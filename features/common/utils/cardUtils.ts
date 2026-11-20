/**
 * @file Card Processing and Schema Normalization Utilities
 * @module features/common/utils/cardUtils
 * @context Shared across Content Scripts, Background, Popup, and Dashboard
 * @description Provides helper functions for card ID generation, URL normalization,
 * card filtering by URL, ID deduplication, and multi-format review date extraction.
 */

import { Logger } from '@common/logger';
import { withErrorHandling, withFallback } from '../../../decorators';
import { Card } from '../../../types/domain';
import { UIUtils } from './uiUtils';

/**
 * Historical review log entry within a card, accommodating legacy string dates or numeric timestamps.
 */
export interface CardHistoryLogEntry {
    /** Timestamp of the review event (milliseconds number or ISO string) */
    date: number | string;
    /** User assessment rating (1-4) */
    rating?: number;
    /** Review study duration in milliseconds */
    duration?: number;
    /** Additional metadata */
    [key: string]: unknown;
}

/**
 * Flexible structural interface matching both modern and legacy card formats.
 */
export interface CardLike {
    /** Legacy camelCase review timestamp */
    lastReview?: number | string | Date | null;
    /** ts-fsrs standard snake_case review timestamp */
    last_review?: number | string | Date | null;
    /** Chronological review history logs */
    historyLog?: (CardHistoryLogEntry | number | string)[];
    /** Extensible card properties */
    [key: string]: unknown;
}

/**
 * Extracts and normalizes the most recent review timestamp from a card object,
 * handling legacy camelCase (`lastReview`), FSRS snake_case (`last_review`),
 * and the latest entry in `historyLog`.
 * 
 * @param card - The card candidate object from storage.
 * @returns Unix epoch timestamp in milliseconds, or null if the card has never been reviewed.
 * @example
 * ```ts
 * const lastReviewMs = getLastReviewDate(card);
 * if (lastReviewMs) {
 *     console.log(`Reviewed ${new Date(lastReviewMs).toLocaleDateString()}`);
 * }
 * ```
 */
export function getLastReviewDate(card?: CardLike | null): number | null {
    if (!card) return null;
    return withErrorHandling(() => {
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
    }, 'CardUtils', { contextMessage: 'Error in getLastReviewDate', fallback: null, metadata: { card } })() ?? null;
}

/**
 * Generates an alphanumeric pseudo-unique identifier for a card.
 * Combines base-36 timestamp encoding with random noise.
 * @returns A unique card identifier string.
 */
export function generateCardId(): string {
    return withErrorHandling(
        () => Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9),
        'CardUtils',
        {
            contextMessage: 'Error generating card ID',
            fallback: () => `id_${Date.now()}_${Math.floor(Math.random() * 1000000)}`
        }
    )() ?? `id_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
}

/**
 * Normalizes a URL by stripping query parameters (`?query=...`) and hash anchors (`#anchor`).
 * Ensures consistent lookups across variations of problem URLs.
 * @param url - Raw page URL to normalize.
 * @returns Clean canonical URL string without query parameters or hash fragments.
 * @example
 * ```ts
 * cleanUrl('https://leetcode.com/problems/two-sum/?envType=study-plan#solution');
 * // => 'https://leetcode.com/problems/two-sum/'
 * ```
 */
export function cleanUrl(url?: string | null): string {
    if (!url) return '';
    return withErrorHandling(
        () => url.split('?')[0].split('#')[0],
        'CardUtils',
        { contextMessage: `Error cleaning URL '${url}'`, fallback: String(url), metadata: { url } }
    )() ?? String(url);
}

/**
 * Filters an array of cards to find those matching a target URL, comparing cleaned URLs.
 * @param cards - Collection of cards to search.
 * @param url - Destination problem URL to match against.
 * @returns Array of cards mapped to the cleaned URL.
 */
export function getCardsForUrl(cards: Card[], url: string): Card[] {
    if (!Array.isArray(cards) || !url) return [];
    return withErrorHandling(
        () => {
            const targetClean = cleanUrl(url);
            return cards.filter(c => c && c.problemUrl && cleanUrl(c.problemUrl) === targetClean);
        },
        'CardUtils',
        { contextMessage: `Error filtering cards for URL '${url}'`, fallback: [], metadata: { url } }
    )() ?? [];
}

/**
 * Iterates through an array of cards, generating and assigning unique IDs to any card missing an ID.
 * Mutates cards in place and returns the array.
 * @param cards - Array of cards to validate.
 * @returns The validated array of cards where every entity is guaranteed to have a unique ID.
 */
export function ensureCardIds(cards: Card[]): Card[] {
    if (!Array.isArray(cards)) return [];
    return withErrorHandling(
        () => {
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
        },
        'CardUtils',
        { contextMessage: 'Error in ensureCardIds', fallback: cards }
    )() ?? cards;
}
