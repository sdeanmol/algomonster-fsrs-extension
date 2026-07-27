/**
 * @file types/fsrs.d.ts
 * @description Type definitions wrapper for FSRS domain models and Chrome Extension message/storage schemas.
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

export { Rating, State } from 'ts-fsrs';
export type Card = FSRSCard;
export type FSRSParameters = FSRSParams;
export type FSRSCardState = FSRCS;
export type ReviewLog = FSRSReviewLog;
export type MessageType = MsgType;
export type ExtensionMessage = ExtMsg;
export type MessageResponse<T = any> = MsgResp<T>;
export type BackupData = BkpData;
export type UserSettings = UsrSettings;
export type StorageData = StrgData;
