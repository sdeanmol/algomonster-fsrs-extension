/**
 * @file Type Definitions Wrapper for FSRS Domain Models
 * @module types/fsrs.d.ts
 * @context Shared ambient / module declaration file
 * @description Provides standardized type aliases and re-exports for Free Spaced Repetition Scheduler
 * (FSRS) domain entities, cards, review logs, runtime message envelopes, and storage structures.
 */

import {
    Rating as FSRSRating,
    State as FSRSState,
    Card as FSRSCard,
    FSRSParameters as FSRSParams,
    FSRSCardState as FSRCS,
    ReviewLog as FSRSReviewLog,
    MessageType as MsgType,
    ExtensionMessage as ExtMsg,
    MessageResponse as MsgResp,
    BackupData as BkpData,
    UserSettings as UsrSettings,
    StorageData as StrgData
} from './domain';

/**
 * Core FSRS review assessment rating (Again=1, Hard=2, Good=3, Easy=4).
 */
export { Rating, State } from 'ts-fsrs';

/**
 * Standard Card model representing an algorithmic problem with FSRS tracking metadata.
 */
export type Card = FSRSCard;

/**
 * FSRS algorithmic weights and configuration parameters.
 */
export type FSRSParameters = FSRSParams;

/**
 * Pure mathematical state representation of FSRS memory parameters.
 */
export type FSRSCardState = FSRCS;

/**
 * Log entry capturing an individual review attempt, rating, and duration.
 */
export type ReviewLog = FSRSReviewLog;

/**
 * Enumeration of supported runtime messaging actions.
 */
export type MessageType = MsgType;

/**
 * Envelope structure for Chrome runtime inter-process messages.
 */
export type ExtensionMessage = ExtMsg;

/**
 * Standardized response envelope returned by runtime message listeners.
 * @template T - Type of the result payload.
 */
export type MessageResponse<T = any> = MsgResp<T>;

/**
 * Exported backup archive data schema.
 */
export type BackupData = BkpData;

/**
 * Consolidated user settings model.
 */
export type UserSettings = UsrSettings;

/**
 * Complete `chrome.storage.local` extension database schema.
 */
export type StorageData = StrgData;
