/**
 * @file features/common/utils/cardUtils.ts
 * @description Shared utilities for processing card objects safely across different module schemas.
 */

export interface CardHistoryLogEntry {
    date: number | string;
    rating?: number;
    duration?: number;
    [key: string]: any;
}

export interface CardLike {
    lastReview?: number | string | Date | null;
    last_review?: number | string | Date | null;
    historyLog?: (CardHistoryLogEntry | number | string)[];
    [key: string]: any;
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

    let lr: any = card.lastReview || card.last_review;

    if (!lr && card.historyLog && card.historyLog.length > 0) {
        const lastLog = card.historyLog[card.historyLog.length - 1];
        lr = typeof lastLog === 'object' && lastLog !== null ? lastLog.date : lastLog;
    }

    if (!lr) return null;

    return lr;
}
