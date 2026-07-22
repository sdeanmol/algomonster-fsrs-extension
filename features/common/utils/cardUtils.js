/**
 * @file features/common/utils/cardUtils.js
 * @description Shared utilities for processing card objects safely across different module schemas.
 */

/**
 * Robustly extracts the most recent review date from a card, normalizing across 
 * different historical data schemas (ts-fsrs snake_case, legacy camelCase, and raw historyLog).
 * 
 * @param {Object} card - The card object from the database.
 * @returns {number|null} - The timestamp of the last review, or null if never reviewed.
 */
export function getLastReviewDate(card) {
    if (!card) return null;

    let lr = card.lastReview || card.last_review;
    
    if (!lr && card.historyLog && card.historyLog.length > 0) {
        const lastLog = card.historyLog[card.historyLog.length - 1];
        lr = typeof lastLog === 'object' ? lastLog.date : lastLog;
    }

    return lr || null;
}
