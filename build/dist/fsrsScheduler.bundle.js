/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./features/tracker/scheduler/fsrsScheduler.js"
/*!*****************************************************!*\
  !*** ./features/tracker/scheduler/fsrsScheduler.js ***!
  \*****************************************************/
(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var ts_fsrs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ts-fsrs */ "./node_modules/ts-fsrs/dist/index.mjs");
/* module decorator */ module = __webpack_require__.hmd(module);
/**
 * @file features/tracker/scheduler/fsrsScheduler.js
 * @description Concrete implementation of the Free Spaced Repetition Scheduler (FSRS) algorithm.
 * Extends the abstract Scheduler base class to provide mathematically precise card
 * stability, difficulty, retrievability, and scheduled review intervals using ts-fsrs.
 */



// Fallback logic if we are running outside Webpack bundling context (which we shouldn't be now)
const BaseScheduler = typeof Scheduler !== 'undefined' ? Scheduler : ( true ? __webpack_require__(/*! ./scheduler.js */ "./features/tracker/scheduler/scheduler.js") : 0);

class FsrsScheduler extends BaseScheduler {
    /**
     * Initializes the FSRS scheduler with standard FSRS-4.5 weights and constants.
     * @param {Object|null} [params=null] - Configuration overrides.
     */
    constructor(params = null) {
        super();
        this.w = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];
        this.decay = -0.5;
        this.factor = 19 / 81;
        this.requestRetention = 0.90; // Target memory retention rate

        if (params) {
            if (params.w && Array.isArray(params.w) && params.w.length === 17) {
                this.w = params.w;
            }
            if (params.decay !== undefined && !isNaN(params.decay)) {
                this.decay = parseFloat(params.decay);
            }
            if (params.factor !== undefined && !isNaN(params.factor)) {
                this.factor = parseFloat(params.factor);
            }
            if (params.requestRetention !== undefined && !isNaN(params.requestRetention)) {
                this.requestRetention = parseFloat(params.requestRetention);
            }
        }
    }

    createCard(problemTitle, problemUrl, textRead, approach, tags = []) {
        if (typeof window !== 'undefined' && window.Logger) window.Logger.debug('FSRS', 'Creating new card', { problemTitle, problemUrl });
        const now = new Date();
        
        // ts-fsrs provides createEmptyCard() which scaffolds the standard FSRS structure
        const emptyCard = (0,ts_fsrs__WEBPACK_IMPORTED_MODULE_0__.createEmptyCard)(now);
        
        return {
            id: Date.now().toString(),
            problemTitle,
            problemUrl,
            textRead,
            approach,
            tags,
            historyLog: [{ rating: 0, date: now.getTime() }], // Track exactly when this was created/reviewed
            
            // FSRS standardized schema fields:
            due: emptyCard.due.getTime(),
            stability: emptyCard.stability,
            difficulty: emptyCard.difficulty,
            elapsed_days: emptyCard.elapsed_days,
            scheduled_days: emptyCard.scheduled_days,
            reps: emptyCard.reps,
            lapses: emptyCard.lapses,
            state: emptyCard.state,
            last_review: emptyCard.last_review ? emptyCard.last_review.getTime() : null
        };
    }

    reviewCard(card, rating, customWeights = null, now = Date.now()) {
        if (typeof window !== 'undefined' && window.Logger) window.Logger.debug('FSRS', `Reviewing card: ${card.problemTitle} with rating ${rating}`);
        let newCard = { ...card };
        
        newCard.previousDue = card.due;
        newCard.historyLog = newCard.historyLog || [];
        newCard.historyLog.push({ rating, date: now });

        let lastReview = card.last_review;
        if (!lastReview && card.historyLog && card.historyLog.length > 0) {
            const lastLog = card.historyLog[card.historyLog.length - 1];
            lastReview = typeof lastLog === 'object' ? lastLog.date : lastLog;
        }

        const w = (customWeights && customWeights.length === 17) ? customWeights : this.w;

        // Initialize ts-fsrs scheduler with standard or custom weights
        const scheduler = (0,ts_fsrs__WEBPACK_IMPORTED_MODULE_0__.fsrs)({
            w: w,
            request_retention: this.requestRetention
        });

        // Convert plain object back to ts-fsrs Card interface format
        const tsCard = {
            due: new Date(newCard.due),
            stability: newCard.stability,
            difficulty: newCard.difficulty,
            elapsed_days: newCard.elapsed_days,
            scheduled_days: newCard.scheduled_days,
            reps: newCard.reps,
            lapses: newCard.lapses,
            state: newCard.state,
            last_review: lastReview ? new Date(lastReview) : undefined
        };

        // ts-fsrs ratings are: 1=Again, 2=Hard, 3=Good, 4=Easy
        const result = scheduler.next(tsCard, new Date(now), rating);
        
        // Map back to JSON-serializable structure
        newCard.due = result.card.due.getTime();
        newCard.stability = result.card.stability;
        newCard.difficulty = result.card.difficulty;
        newCard.elapsed_days = result.card.elapsed_days;
        newCard.scheduled_days = result.card.scheduled_days;
        newCard.reps = result.card.reps;
        newCard.lapses = result.card.lapses;
        newCard.state = result.card.state;
        newCard.last_review = result.card.last_review ? result.card.last_review.getTime() : null;

        return newCard;
    }

    getRetrievability(card, now = Date.now()) {
        let lastReview = card.last_review;
        if (!lastReview && card.historyLog && card.historyLog.length > 0) {
            const lastLog = card.historyLog[card.historyLog.length - 1];
            lastReview = typeof lastLog === 'object' ? lastLog.date : lastLog;
        }

        if (card.stability <= 0 || !lastReview) {
            return 0;
        }

        const tsCard = {
            due: new Date(card.due),
            stability: card.stability,
            difficulty: card.difficulty,
            elapsed_days: card.elapsed_days,
            scheduled_days: card.scheduled_days,
            reps: card.reps,
            lapses: card.lapses,
            state: card.state,
            last_review: new Date(lastReview)
        };

        // ts-fsrs native retrievability computation
        const scheduler = (0,ts_fsrs__WEBPACK_IMPORTED_MODULE_0__.fsrs)({
            w: this.w,
            request_retention: this.requestRetention
        });

        // get_retrievability takes the card state and current date, returns probability (0.0 to 1.0)
        return scheduler.get_retrievability(tsCard, new Date(now), false) || 0;
    }

    getDefaultRequestRetention() {
        return this.requestRetention;
    }

    isHighDifficulty(card) {
        // In FSRS, difficulty scales from 1 (easiest) to 10 (hardest).
        return card.difficulty >= 7;
    }

    isGraduated(card) {
        // FSRS graduated criteria: state is Review (2) and stability indicates long-term retention.
        return card.state === 2 && card.stability > 7;
    }



    resetConfiguration() {
        this.w = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];
        this.decay = -0.5;
        this.factor = 19 / 81;
        this.requestRetention = 0.90;
    }

    exportConfiguration() {
        return {
            w: [...this.w],
            decay: this.decay,
            factor: this.factor,
            requestRetention: this.requestRetention
        };
    }

    importConfiguration(config) {
        if (!config) return;
        if (config.w && Array.isArray(config.w) && config.w.length === 17) {
            this.w = config.w;
        }
        if (config.decay !== undefined) this.decay = parseFloat(config.decay);
        if (config.factor !== undefined) this.factor = parseFloat(config.factor);
        if (config.requestRetention !== undefined) this.requestRetention = parseFloat(config.requestRetention);
    }
}

if ( true && module.exports) {
    module.exports = FsrsScheduler;
} else if (typeof window !== 'undefined') {
    window.FsrsScheduler = FsrsScheduler;
}


/***/ },

/***/ "./features/tracker/scheduler/scheduler.js"
/*!*************************************************!*\
  !*** ./features/tracker/scheduler/scheduler.js ***!
  \*************************************************/
(module) {

/**
 * @file features/tracker/scheduler/scheduler.js
 * @description Abstract base class defining the standard interface for scheduling algorithms.
 * Any scheduling algorithm (e.g., FSRS, SM-2, Leitner) must extend this class to be fully
 * pluggable within the extension architecture.
 */

class Scheduler {
    constructor() {
        if (new.target === Scheduler) {
            throw new TypeError("Cannot construct Scheduler instances directly.");
        }
    }

    /**
     * Initializes a new flashcard schema with default scheduling parameters.
     * @param {string} problemTitle - The title of the problem.
     * @param {string} problemUrl - The canonical URL of the problem.
     * @param {string} textRead - Saved notes context.
     * @param {string} approach - Textual description of the problem-solving approach.
     * @param {string[]} [tags=[]] - Category tags associated with this card.
     * @returns {Object} Newly initialized card schema.
     */
    createCard(problemTitle, problemUrl, textRead, approach, tags = []) {
        throw new Error("Method 'createCard()' must be implemented.");
    }

    /**
     * Transition card parameters based on review rating.
     * @param {Object} card - The active flashcard.
     * @param {number} rating - Review quality (1=Again, 2=Hard, 3=Good, 4=Easy).
     * @param {number[]|null} [customWeights=null] - Optional override weights.
     * @param {number} [now=Date.now()] - Custom baseline timestamp.
     * @returns {Object} A copy of the card with updated scheduling metrics.
     */
    reviewCard(card, rating, customWeights = null, now = Date.now()) {
        throw new Error("Method 'reviewCard()' must be implemented.");
    }

    /**
     * Computes the mathematical retrievability probability (0.0 to 1.0) of a card.
     * @param {Object} card - The active flashcard.
     * @param {number} [now=Date.now()] - Evaluation timestamp.
     * @returns {number} Retrievability percentage representation.
     */
    getRetrievability(card, now = Date.now()) {
        throw new Error("Method 'getRetrievability()' must be implemented.");
    }

    /**
     * Computes projected retrievability over a future time span based on current stability.
     * @param {number} stability - The card or average stability metric.
     * @param {number} elapsedDays - Future evaluation point in days.
     * @returns {number} Projected retrievability probability (0.0 to 1.0).
     */
    getProjectedRetrievability(stability, elapsedDays) {
        throw new Error("Method 'getProjectedRetrievability()' must be implemented.");
    }

    /**
     * Retrieves the baseline target memory retention rate for the scheduling algorithm.
     * @returns {number} Default request retention target (e.g., 0.90 for 90%).
     */
    getDefaultRequestRetention() {
        throw new Error("Method 'getDefaultRequestRetention()' must be implemented.");
    }

    /**
     * Determines whether the card is considered to have a highly difficult rating
     * based on the algorithm's specific difficulty scale.
     * @param {Object} card - The active flashcard.
     * @returns {boolean} True if the card difficulty is strictly 'high'.
     */
    isHighDifficulty(card) {
        throw new Error("Method 'isHighDifficulty()' must be implemented.");
    }

    /**
     * Evaluates whether a card has passed the learning phase into 'graduated' review.
     * @param {Object} card - The active flashcard.
     * @returns {boolean} True if graduated.
     */
    isGraduated(card) {
        throw new Error("Method 'isGraduated()' must be implemented.");
    }

    /**
     * Determines whether the current scheduler implementation supports personalized optimization.
     * @returns {boolean} True if optimization is supported.
     */
    supportsOptimization() {
        return false;
    }

    /**
     * Trains and applies optimized scheduling parameters based on historical review data.
     * @param {Object[]} reviewHistory - Historical review log data.
     * @returns {Promise<Object>} The optimization results and metadata.
     */
    async optimize(reviewHistory) {
        throw new Error("Method 'optimize()' is not supported by this scheduler.");
    }

    /**
     * Resets the scheduling parameters to their algorithmic defaults.
     */
    resetConfiguration() {
        throw new Error("Method 'resetConfiguration()' is not supported by this scheduler.");
    }

    /**
     * Exports the current scheduling parameters.
     * @returns {Object} Current configuration parameters.
     */
    exportConfiguration() {
        throw new Error("Method 'exportConfiguration()' is not supported by this scheduler.");
    }

    /**
     * Imports and applies scheduling parameters.
     * @param {Object} config - Configuration parameters.
     */
    importConfiguration(config) {
        throw new Error("Method 'importConfiguration()' is not supported by this scheduler.");
    }

    /**
     * Helper to export to CommonJS if running in Node environment for testing.
     */
}

if ( true && module.exports) {
    module.exports = Scheduler;
}


/***/ },

/***/ "./node_modules/ts-fsrs/dist/index.mjs"
/*!*********************************************!*\
  !*** ./node_modules/ts-fsrs/dist/index.mjs ***!
  \*********************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AbstractScheduler: () => (/* binding */ AbstractScheduler),
/* harmony export */   BasicLearningStepsStrategy: () => (/* binding */ BasicLearningStepsStrategy),
/* harmony export */   CLAMP_PARAMETERS: () => (/* binding */ CLAMP_PARAMETERS),
/* harmony export */   ConvertStepUnitToMinutes: () => (/* binding */ ConvertStepUnitToMinutes),
/* harmony export */   DefaultInitSeedStrategy: () => (/* binding */ DefaultInitSeedStrategy),
/* harmony export */   FSRS: () => (/* binding */ FSRS),
/* harmony export */   FSRS5_DEFAULT_DECAY: () => (/* binding */ FSRS5_DEFAULT_DECAY),
/* harmony export */   FSRS6_DEFAULT_DECAY: () => (/* binding */ FSRS6_DEFAULT_DECAY),
/* harmony export */   FSRSAlgorithm: () => (/* binding */ FSRSAlgorithm),
/* harmony export */   FSRSVersion: () => (/* binding */ FSRSVersion),
/* harmony export */   GenSeedStrategyWithCardId: () => (/* binding */ GenSeedStrategyWithCardId),
/* harmony export */   Grades: () => (/* binding */ Grades),
/* harmony export */   INIT_S_MAX: () => (/* binding */ INIT_S_MAX),
/* harmony export */   Rating: () => (/* binding */ Rating),
/* harmony export */   S_MAX: () => (/* binding */ S_MAX),
/* harmony export */   S_MIN: () => (/* binding */ S_MIN),
/* harmony export */   State: () => (/* binding */ State),
/* harmony export */   StrategyMode: () => (/* binding */ StrategyMode),
/* harmony export */   TypeConvert: () => (/* binding */ TypeConvert),
/* harmony export */   W17_W18_Ceiling: () => (/* binding */ W17_W18_Ceiling),
/* harmony export */   checkParameters: () => (/* binding */ checkParameters),
/* harmony export */   clamp: () => (/* binding */ clamp),
/* harmony export */   clipParameters: () => (/* binding */ clipParameters),
/* harmony export */   computeDecayFactor: () => (/* binding */ computeDecayFactor),
/* harmony export */   createEmptyCard: () => (/* binding */ createEmptyCard),
/* harmony export */   dateDiffInDays: () => (/* binding */ dateDiffInDays),
/* harmony export */   date_diff: () => (/* binding */ date_diff),
/* harmony export */   date_scheduler: () => (/* binding */ date_scheduler),
/* harmony export */   default_enable_fuzz: () => (/* binding */ default_enable_fuzz),
/* harmony export */   default_enable_short_term: () => (/* binding */ default_enable_short_term),
/* harmony export */   default_learning_steps: () => (/* binding */ default_learning_steps),
/* harmony export */   default_maximum_interval: () => (/* binding */ default_maximum_interval),
/* harmony export */   default_relearning_steps: () => (/* binding */ default_relearning_steps),
/* harmony export */   default_request_retention: () => (/* binding */ default_request_retention),
/* harmony export */   default_w: () => (/* binding */ default_w),
/* harmony export */   fixDate: () => (/* binding */ fixDate),
/* harmony export */   fixRating: () => (/* binding */ fixRating),
/* harmony export */   fixState: () => (/* binding */ fixState),
/* harmony export */   forgetting_curve: () => (/* binding */ forgetting_curve),
/* harmony export */   formatDate: () => (/* binding */ formatDate),
/* harmony export */   fsrs: () => (/* binding */ fsrs),
/* harmony export */   generatorParameters: () => (/* binding */ generatorParameters),
/* harmony export */   get_fuzz_range: () => (/* binding */ get_fuzz_range),
/* harmony export */   migrateParameters: () => (/* binding */ migrateParameters),
/* harmony export */   roundTo: () => (/* binding */ roundTo),
/* harmony export */   show_diff_message: () => (/* binding */ show_diff_message)
/* harmony export */ });
class FSRSError extends Error {
  constructor(message = "FSRS Error") {
    super(message);
    this.name = "FSRSError";
    Error.captureStackTrace?.(this, FSRSError);
  }
}
class FSRSValidationError extends FSRSError {
  constructor(message) {
    super(message);
    this.name = "FSRSValidationError";
    Error.captureStackTrace?.(this, FSRSValidationError);
  }
}

var State = /* @__PURE__ */ ((State2) => {
  State2[State2["New"] = 0] = "New";
  State2[State2["Learning"] = 1] = "Learning";
  State2[State2["Review"] = 2] = "Review";
  State2[State2["Relearning"] = 3] = "Relearning";
  return State2;
})(State || {});
var Rating = /* @__PURE__ */ ((Rating2) => {
  Rating2[Rating2["Manual"] = 0] = "Manual";
  Rating2[Rating2["Again"] = 1] = "Again";
  Rating2[Rating2["Hard"] = 2] = "Hard";
  Rating2[Rating2["Good"] = 3] = "Good";
  Rating2[Rating2["Easy"] = 4] = "Easy";
  return Rating2;
})(Rating || {});

class TypeConvert {
  static card(card) {
    return {
      ...card,
      state: TypeConvert.state(card.state),
      due: TypeConvert.time(card.due),
      last_review: card.last_review ? TypeConvert.time(card.last_review) : void 0
    };
  }
  static rating(value) {
    if (typeof value === "string") {
      const firstLetter = value.charAt(0).toUpperCase();
      const restOfString = value.slice(1).toLowerCase();
      const ret = Rating[`${firstLetter}${restOfString}`];
      if (ret === void 0) {
        throw new FSRSValidationError(`Invalid rating:[${value}]`);
      }
      return ret;
    } else if (typeof value === "number") {
      return value;
    }
    throw new FSRSValidationError(`Invalid rating:[${value}]`);
  }
  static state(value) {
    if (typeof value === "string") {
      const firstLetter = value.charAt(0).toUpperCase();
      const restOfString = value.slice(1).toLowerCase();
      const ret = State[`${firstLetter}${restOfString}`];
      if (ret === void 0) {
        throw new FSRSValidationError(`Invalid state:[${value}]`);
      }
      return ret;
    } else if (typeof value === "number") {
      return value;
    }
    throw new FSRSValidationError(`Invalid state:[${value}]`);
  }
  static time(value) {
    if (value instanceof Date) {
      return value;
    }
    const date = new Date(value);
    if (typeof value === "object" && value !== null && !Number.isNaN(Date.parse(value) || +date)) {
      return date;
    } else if (typeof value === "string") {
      const timestamp = Date.parse(value);
      if (!Number.isNaN(timestamp)) {
        return new Date(timestamp);
      } else {
        throw new FSRSValidationError(`Invalid date:[${value}]`);
      }
    } else if (typeof value === "number") {
      return new Date(value);
    }
    throw new FSRSValidationError(`Invalid date:[${value}]`);
  }
  static review_log(log) {
    return {
      ...log,
      due: TypeConvert.time(log.due),
      rating: TypeConvert.rating(log.rating),
      state: TypeConvert.state(log.state),
      review: TypeConvert.time(log.review)
    };
  }
}

/* istanbul ignore next -- @preserve */
Date.prototype.scheduler = function(t, isDay) {
  return date_scheduler(this, t, isDay);
};
/* istanbul ignore next -- @preserve */
Date.prototype.diff = function(pre, unit) {
  return date_diff(this, pre, unit);
};
/* istanbul ignore next -- @preserve */
Date.prototype.format = function() {
  return formatDate(this);
};
/* istanbul ignore next -- @preserve */
Date.prototype.dueFormat = function(last_review, unit, timeUnit) {
  return show_diff_message(this, last_review, unit, timeUnit);
};
function date_scheduler(now, t, isDay) {
  return new Date(
    isDay ? TypeConvert.time(now).getTime() + t * 24 * 60 * 60 * 1e3 : TypeConvert.time(now).getTime() + t * 60 * 1e3
  );
}
function date_diff(now, pre, unit) {
  if (!now || !pre) {
    throw new FSRSValidationError("Invalid date");
  }
  const diff = TypeConvert.time(now).getTime() - TypeConvert.time(pre).getTime();
  let r = 0;
  switch (unit) {
    case "days":
      r = Math.floor(diff / (24 * 60 * 60 * 1e3));
      break;
    case "minutes":
      r = Math.floor(diff / (60 * 1e3));
      break;
  }
  return r;
}
function formatDate(dateInput) {
  const date = TypeConvert.time(dateInput);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  return `${year}-${padZero(month)}-${padZero(day)} ${padZero(hours)}:${padZero(
    minutes
  )}:${padZero(seconds)}`;
}
function padZero(num) {
  return num < 10 ? `0${num}` : `${num}`;
}
const TIMEUNIT = [60, 60, 24, 31, 12];
const TIMEUNITFORMAT = ["second", "min", "hour", "day", "month", "year"];
function show_diff_message(due, last_review, unit, timeUnit = TIMEUNITFORMAT) {
  due = TypeConvert.time(due);
  last_review = TypeConvert.time(last_review);
  if (timeUnit.length !== TIMEUNITFORMAT.length) {
    timeUnit = TIMEUNITFORMAT;
  }
  let diff = due.getTime() - last_review.getTime();
  let i = 0;
  diff /= 1e3;
  for (i = 0; i < TIMEUNIT.length; i++) {
    if (diff < TIMEUNIT[i]) {
      break;
    } else {
      diff /= TIMEUNIT[i];
    }
  }
  return `${Math.floor(diff)}${unit ? timeUnit[i] : ""}`;
}
/* istanbul ignore next -- @preserve */
function fixDate(value) {
  return TypeConvert.time(value);
}
/* istanbul ignore next -- @preserve */
function fixState(value) {
  return TypeConvert.state(value);
}
/* istanbul ignore next -- @preserve */
function fixRating(value) {
  return TypeConvert.rating(value);
}
const Grades = Object.freeze([
  Rating.Again,
  Rating.Hard,
  Rating.Good,
  Rating.Easy
]);
const FUZZ_RANGES = [
  {
    start: 2.5,
    end: 7,
    factor: 0.15
  },
  {
    start: 7,
    end: 20,
    factor: 0.1
  },
  {
    start: 20,
    end: Infinity,
    factor: 0.05
  }
];
function get_fuzz_range(interval, elapsed_days, maximum_interval) {
  let delta = 1;
  for (const range of FUZZ_RANGES) {
    delta += range.factor * Math.max(Math.min(interval, range.end) - range.start, 0);
  }
  interval = Math.min(interval, maximum_interval);
  let min_ivl = Math.max(2, Math.round(interval - delta));
  const max_ivl = Math.min(Math.round(interval + delta), maximum_interval);
  if (interval > elapsed_days) {
    min_ivl = Math.max(min_ivl, elapsed_days + 1);
  }
  min_ivl = Math.min(min_ivl, max_ivl);
  return { min_ivl, max_ivl };
}
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function roundTo(num, decimals) {
  const factor = 10 ** decimals;
  return Math.round(num * factor) / factor;
}
function dateDiffInDays(last, cur) {
  const utc1 = Date.UTC(
    last.getUTCFullYear(),
    last.getUTCMonth(),
    last.getUTCDate()
  );
  const utc2 = Date.UTC(
    cur.getUTCFullYear(),
    cur.getUTCMonth(),
    cur.getUTCDate()
  );
  return Math.floor(
    (utc2 - utc1) / 864e5
    /** 1000 * 60 * 60 * 24*/
  );
}

const ConvertStepUnitToMinutes = (step) => {
  const unit = step.slice(-1);
  const value = parseInt(step.slice(0, -1), 10);
  if (Number.isNaN(value) || !Number.isFinite(value) || value < 0) {
    throw new FSRSValidationError(`Invalid step value: ${step}`);
  }
  switch (unit) {
    case "m":
      return value;
    case "h":
      return value * 60;
    case "d":
      return value * 1440;
    default:
      throw new FSRSValidationError(
        `Invalid step unit: ${step}, expected m/h/d`
      );
  }
};
const BasicLearningStepsStrategy = (params, state, cur_step) => {
  const learning_steps = state === State.Relearning || state === State.Review ? params.relearning_steps : params.learning_steps;
  const steps_length = learning_steps.length;
  if (steps_length === 0 || cur_step >= steps_length) return {};
  const firstStep = learning_steps[0];
  const toMinutes = ConvertStepUnitToMinutes;
  const getAgainInterval = () => {
    return toMinutes(firstStep);
  };
  const getHardInterval = () => {
    if (steps_length === 1) return Math.round(toMinutes(firstStep) * 1.5);
    const nextStep = learning_steps[1];
    return Math.round((toMinutes(firstStep) + toMinutes(nextStep)) / 2);
  };
  const getStepInfo = (index) => {
    if (index < 0 || index >= steps_length) {
      return null;
    } else {
      return learning_steps[index];
    }
  };
  const getGoodMinutes = (step) => {
    return toMinutes(step);
  };
  const result = {};
  const step_info = getStepInfo(Math.max(0, cur_step));
  if (state === State.Review) {
    result[Rating.Again] = {
      scheduled_minutes: toMinutes(step_info),
      next_step: 0
    };
    return result;
  } else {
    result[Rating.Again] = {
      scheduled_minutes: getAgainInterval(),
      next_step: 0
    };
    result[Rating.Hard] = {
      scheduled_minutes: getHardInterval(),
      next_step: cur_step
    };
    const next_info = getStepInfo(cur_step + 1);
    if (next_info) {
      const nextMin = getGoodMinutes(next_info);
      if (nextMin) {
        result[Rating.Good] = {
          scheduled_minutes: Math.round(nextMin),
          next_step: cur_step + 1
        };
      }
    }
  }
  return result;
};

function DefaultInitSeedStrategy() {
  const time = this.review_time.getTime();
  const reps = this.current.reps;
  const mul = this.current.difficulty * this.current.stability;
  return `${time}_${reps}_${mul}`;
}
function GenSeedStrategyWithCardId(card_id_field) {
  return function() {
    const card_id = Reflect.get(this.current, card_id_field) ?? 0;
    const reps = this.current.reps;
    return String(card_id + reps || 0);
  };
}

var StrategyMode = /* @__PURE__ */ ((StrategyMode2) => {
  StrategyMode2["SCHEDULER"] = "Scheduler";
  StrategyMode2["LEARNING_STEPS"] = "LearningSteps";
  StrategyMode2["SEED"] = "Seed";
  return StrategyMode2;
})(StrategyMode || {});

class AbstractScheduler {
  last;
  current;
  review_time;
  next = /* @__PURE__ */ new Map();
  algorithm;
  strategies;
  elapsed_days = 0;
  // init
  constructor(card, now, algorithm, strategies) {
    this.algorithm = algorithm;
    this.last = TypeConvert.card(card);
    this.current = TypeConvert.card(card);
    this.review_time = TypeConvert.time(now);
    this.strategies = strategies;
    this.init();
  }
  checkGrade(grade) {
    if (!Number.isFinite(grade) || grade < 1 || grade > 4) {
      throw new FSRSValidationError(`Invalid grade "${grade}",expected 1-4`);
    }
  }
  init() {
    const { state, last_review } = this.current;
    let interval = 0;
    if (state !== State.New && last_review) {
      interval = dateDiffInDays(last_review, this.review_time);
    }
    this.current.last_review = this.review_time;
    this.elapsed_days = interval;
    this.current.elapsed_days = interval;
    this.current.reps += 1;
    let seed_strategy = DefaultInitSeedStrategy;
    if (this.strategies) {
      const custom_strategy = this.strategies.get(StrategyMode.SEED);
      if (custom_strategy) {
        seed_strategy = custom_strategy;
      }
    }
    this.algorithm.seed = seed_strategy.call(this);
  }
  preview() {
    return {
      [Rating.Again]: this.review(Rating.Again),
      [Rating.Hard]: this.review(Rating.Hard),
      [Rating.Good]: this.review(Rating.Good),
      [Rating.Easy]: this.review(Rating.Easy),
      [Symbol.iterator]: this.previewIterator.bind(this)
    };
  }
  *previewIterator() {
    for (const grade of Grades) {
      yield this.review(grade);
    }
  }
  review(grade) {
    const { state } = this.last;
    let item;
    this.checkGrade(grade);
    switch (state) {
      case State.New:
        item = this.newState(grade);
        break;
      case State.Learning:
      case State.Relearning:
        item = this.learningState(grade);
        break;
      case State.Review:
        item = this.reviewState(grade);
        break;
    }
    return item;
  }
  buildLog(rating) {
    const { last_review, due, elapsed_days } = this.last;
    return {
      rating,
      state: this.current.state,
      due: last_review || due,
      stability: this.current.stability,
      difficulty: this.current.difficulty,
      elapsed_days: this.elapsed_days,
      last_elapsed_days: elapsed_days,
      scheduled_days: this.current.scheduled_days,
      learning_steps: this.current.learning_steps,
      review: this.review_time
    };
  }
}

class Alea {
  c;
  s0;
  s1;
  s2;
  constructor(seed) {
    const mash = Mash();
    this.c = 1;
    this.s0 = mash(" ");
    this.s1 = mash(" ");
    this.s2 = mash(" ");
    if (seed == null) seed = Date.now();
    this.s0 -= mash(seed);
    if (this.s0 < 0) this.s0 += 1;
    this.s1 -= mash(seed);
    if (this.s1 < 0) this.s1 += 1;
    this.s2 -= mash(seed);
    if (this.s2 < 0) this.s2 += 1;
  }
  next() {
    const t = 2091639 * this.s0 + this.c * 23283064365386963e-26;
    this.s0 = this.s1;
    this.s1 = this.s2;
    this.c = t | 0;
    this.s2 = t - this.c;
    return this.s2;
  }
  set state(state) {
    this.c = state.c;
    this.s0 = state.s0;
    this.s1 = state.s1;
    this.s2 = state.s2;
  }
  get state() {
    return {
      c: this.c,
      s0: this.s0,
      s1: this.s1,
      s2: this.s2
    };
  }
}
function Mash() {
  let n = 4022871197;
  return function mash(data) {
    data = String(data);
    for (let i = 0; i < data.length; i++) {
      n += data.charCodeAt(i);
      let h = 0.02519603282416938 * n;
      n = h >>> 0;
      h -= n;
      h *= n;
      n = h >>> 0;
      h -= n;
      n += h * 4294967296;
    }
    return (n >>> 0) * 23283064365386963e-26;
  };
}
function alea(seed) {
  const xg = new Alea(seed);
  const prng = () => xg.next();
  prng.int32 = () => xg.next() * 4294967296 | 0;
  prng.double = () => prng() + (prng() * 2097152 | 0) * 11102230246251565e-32;
  prng.state = () => xg.state;
  prng.importState = (state) => {
    xg.state = state;
    return prng;
  };
  return prng;
}

const version="5.4.1";

const default_request_retention = 0.9;
const default_maximum_interval = 36500;
const default_enable_fuzz = false;
const default_enable_short_term = true;
const default_learning_steps = Object.freeze([
  "1m",
  "10m"
]);
const default_relearning_steps = Object.freeze([
  "10m"
]);
const FSRSVersion = `v${version} using FSRS-6.0`;
const S_MIN = 1e-3;
const S_MAX = 36500;
const INIT_S_MAX = 100;
const FSRS5_DEFAULT_DECAY = 0.5;
const FSRS6_DEFAULT_DECAY = 0.1542;
const default_w = Object.freeze([
  0.212,
  1.2931,
  2.3065,
  8.2956,
  6.4133,
  0.8334,
  3.0194,
  1e-3,
  1.8722,
  0.1666,
  0.796,
  1.4835,
  0.0614,
  0.2629,
  1.6483,
  0.6014,
  1.8729,
  0.5425,
  0.0912,
  0.0658,
  FSRS6_DEFAULT_DECAY
]);
const W17_W18_Ceiling = 2;
const CLAMP_PARAMETERS = (w17_w18_ceiling, enable_short_term = default_enable_short_term) => [
  [S_MIN, INIT_S_MAX],
  [S_MIN, INIT_S_MAX],
  [S_MIN, INIT_S_MAX],
  [S_MIN, INIT_S_MAX],
  [1, 10],
  [1e-3, 4],
  [1e-3, 4],
  [1e-3, 0.75],
  [0, 4.5],
  [0, 0.8],
  [1e-3, 3.5],
  [1e-3, 5],
  [1e-3, 0.25],
  [1e-3, 0.9],
  [0, 4],
  [0, 1],
  [1, 6],
  [0, w17_w18_ceiling],
  [0, w17_w18_ceiling],
  [
    enable_short_term ? 0.01 : 0,
    0.8
  ],
  [0.1, 0.8]
];

const clipParameters = (parameters, numRelearningSteps, enableShortTerm = default_enable_short_term) => {
  const clip = CLAMP_PARAMETERS(W17_W18_Ceiling, enableShortTerm).slice(
    0,
    parameters.length
  );
  if (Math.max(0, numRelearningSteps) > 1) {
    const w11 = clamp(parameters[11] || 0, clip[11][0], clip[11][1]);
    const w13 = clamp(parameters[13] || 0, clip[13][0], clip[13][1]);
    const w14 = clamp(parameters[14] || 0, clip[14][0], clip[14][1]);
    const value = -(Math.log(w11) + Math.log(Math.pow(2, w13) - 1) + w14 * 0.3) / numRelearningSteps;
    const w17_w18_ceiling = clamp(
      roundTo(Math.sqrt(Math.max(value, 0)), 8),
      0.01,
      W17_W18_Ceiling
    );
    if (clip[17]) clip[17] = [clip[17][0], w17_w18_ceiling];
    if (clip[18]) clip[18] = [clip[18][0], w17_w18_ceiling];
  }
  return clip.map(
    ([min, max], index) => clamp(parameters[index] || 0, min, max)
  );
};
const checkParameters = (parameters) => {
  const invalid = parameters.find((param) => !Number.isFinite(param));
  if (invalid !== void 0) {
    throw new FSRSValidationError(
      `Non-finite or NaN value in parameters ${parameters}`
    );
  } else if (![17, 19, 21].includes(parameters.length)) {
    throw new FSRSValidationError(
      `Invalid parameter length: ${parameters.length}. Must be 17, 19 or 21 for FSRSv4, 5 and 6 respectively.`
    );
  }
  return parameters;
};
const migrateParameters = (parameters, numRelearningSteps = 0, enableShortTerm = default_enable_short_term) => {
  if (parameters === void 0) {
    return [...default_w];
  }
  switch (parameters.length) {
    case 21:
      return clipParameters(
        Array.from(parameters),
        numRelearningSteps,
        enableShortTerm
      );
    case 19:
      console.debug("[FSRS-6]auto fill w from 19 to 21 length");
      return clipParameters(
        Array.from(parameters),
        numRelearningSteps,
        enableShortTerm
      ).concat([0, FSRS5_DEFAULT_DECAY]);
    case 17: {
      const w = clipParameters(
        Array.from(parameters),
        numRelearningSteps,
        enableShortTerm
      );
      w[4] = +(w[5] * 2 + w[4]).toFixed(8);
      w[5] = +(Math.log(w[5] * 3 + 1) / 3).toFixed(8);
      w[6] = +(w[6] + 0.5).toFixed(8);
      console.debug("[FSRS-6]auto fill w from 17 to 21 length");
      return w.concat([0, 0, 0, FSRS5_DEFAULT_DECAY]);
    }
    default:
      console.warn("[FSRS]Invalid parameters length, using default parameters");
      return [...default_w];
  }
};
const generatorParameters = (props) => {
  const learning_steps = Array.isArray(props?.learning_steps) ? props.learning_steps : default_learning_steps;
  const relearning_steps = Array.isArray(props?.relearning_steps) ? props.relearning_steps : default_relearning_steps;
  const enable_short_term = props?.enable_short_term ?? default_enable_short_term;
  const w = migrateParameters(
    props?.w,
    relearning_steps.length,
    enable_short_term
  );
  return {
    request_retention: props?.request_retention || default_request_retention,
    maximum_interval: props?.maximum_interval || default_maximum_interval,
    w,
    enable_fuzz: props?.enable_fuzz ?? default_enable_fuzz,
    enable_short_term,
    learning_steps,
    relearning_steps
  };
};
function createEmptyCard(now, afterHandler) {
  const emptyCard = {
    due: now ? TypeConvert.time(now) : /* @__PURE__ */ new Date(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    learning_steps: 0,
    state: State.New,
    last_review: void 0
  };
  if (afterHandler && typeof afterHandler === "function") {
    return afterHandler(emptyCard);
  } else {
    return emptyCard;
  }
}

const computeDecayFactor = (decayOrParams) => {
  const decay = typeof decayOrParams === "number" ? -decayOrParams : -decayOrParams[20];
  const factor = Math.exp(Math.pow(decay, -1) * Math.log(0.9)) - 1;
  return { decay, factor: roundTo(factor, 8) };
};
function forgetting_curve(decayOrParams, elapsed_days, stability) {
  const { decay, factor } = computeDecayFactor(decayOrParams);
  return roundTo(Math.pow(1 + factor * elapsed_days / stability, decay), 8);
}
class FSRSAlgorithm {
  param;
  intervalModifier;
  _seed;
  constructor(params) {
    this.param = new Proxy(
      generatorParameters(params),
      this.params_handler_proxy()
    );
    this.intervalModifier = this.calculate_interval_modifier(
      this.param.request_retention
    );
    this.forgetting_curve = forgetting_curve.bind(this, this.param.w);
  }
  get interval_modifier() {
    return this.intervalModifier;
  }
  set seed(seed) {
    this._seed = seed;
  }
  /**
   * @see https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm#fsrs-5
   *
   * The formula used is: $$I(r,s) = (r^{\frac{1}{DECAY}} - 1) / FACTOR \times s$$
   * @param request_retention 0<request_retention<=1,Requested retention rate
   * @throws {Error} Requested retention rate should be in the range (0,1]
   */
  calculate_interval_modifier(request_retention) {
    if (request_retention <= 0 || request_retention > 1) {
      throw new FSRSValidationError(
        "Requested retention rate should be in the range (0,1]"
      );
    }
    const { decay, factor } = computeDecayFactor(this.param.w);
    return roundTo((Math.pow(request_retention, 1 / decay) - 1) / factor, 8);
  }
  /**
   * Get the parameters of the algorithm.
   */
  get parameters() {
    return this.param;
  }
  /**
   * Set the parameters of the algorithm.
   * @param params Partial<FSRSParameters>
   */
  set parameters(params) {
    this.update_parameters(params);
  }
  params_handler_proxy() {
    const _this = this;
    return {
      set: function(target, prop, value) {
        if (prop === "request_retention" && Number.isFinite(value)) {
          _this.intervalModifier = _this.calculate_interval_modifier(
            Number(value)
          );
        } else if (prop === "w") {
          value = migrateParameters(
            value,
            target.relearning_steps.length,
            target.enable_short_term
          );
          _this.forgetting_curve = forgetting_curve.bind(this, value);
          _this.intervalModifier = _this.calculate_interval_modifier(
            Number(target.request_retention)
          );
        }
        Reflect.set(target, prop, value);
        return true;
      }
    };
  }
  update_parameters(params) {
    const _params = generatorParameters(params);
    for (const key in _params) {
      const paramKey = key;
      this.param[paramKey] = _params[paramKey];
    }
  }
  /**
     * The formula used is :
     * $$ S_0(G) = w_{G-1}$$
     * $$S_0 = \max \lbrace S_0,0.1\rbrace $$
  
     * @param g Grade (rating at Anki) [1.again,2.hard,3.good,4.easy]
     * @return Stability (interval when R=90%)
     */
  init_stability(g) {
    return Math.max(this.param.w[g - 1], 0.1);
  }
  /**
   * The formula used is :
   * $$D_0(G) = w_4 - e^{(G-1) \cdot w_5} + 1 $$
   * $$D_0 = \min \lbrace \max \lbrace D_0(G),1 \rbrace,10 \rbrace$$
   * where the $$D_0(1)=w_4$$ when the first rating is good.
   *
   * @param {Grade} g Grade (rating at Anki) [1.again,2.hard,3.good,4.easy]
   * @return {number} Difficulty $$D \in [1,10]$$
   */
  init_difficulty(g) {
    const w = this.param.w;
    const d = w[4] - Math.exp((g - 1) * w[5]) + 1;
    return roundTo(d, 8);
  }
  /**
   * If fuzzing is disabled or ivl is less than 2.5, it returns the original interval.
   * @param {number} ivl - The interval to be fuzzed.
   * @param {number} elapsed_days t days since the last review
   * @return {number} - The fuzzed interval.
   **/
  apply_fuzz(ivl, elapsed_days) {
    if (!this.param.enable_fuzz || ivl < 2.5) return Math.round(ivl);
    const generator = alea(this._seed);
    const fuzz_factor = generator();
    const { min_ivl, max_ivl } = get_fuzz_range(
      ivl,
      elapsed_days,
      this.param.maximum_interval
    );
    return Math.floor(fuzz_factor * (max_ivl - min_ivl + 1) + min_ivl);
  }
  /**
   *   @see The formula used is : {@link FSRSAlgorithm.calculate_interval_modifier}
   *   @param {number} s - Stability (interval when R=90%)
   *   @param {number} elapsed_days t days since the last review
   */
  next_interval(s, elapsed_days) {
    const newInterval = Math.min(
      Math.max(1, Math.round(s * this.intervalModifier)),
      this.param.maximum_interval
    );
    return this.apply_fuzz(newInterval, elapsed_days);
  }
  /**
   * @see https://github.com/open-spaced-repetition/fsrs4anki/issues/697
   */
  linear_damping(delta_d, old_d) {
    return roundTo(delta_d * (10 - old_d) / 9, 8);
  }
  /**
   * The formula used is :
   * $$\text{delta}_d = -w_6 \cdot (g - 3)$$
   * $$\text{next}_d = D + \text{linear damping}(\text{delta}_d , D)$$
   * $$D^\prime(D,R) = w_7 \cdot D_0(4) +(1 - w_7) \cdot \text{next}_d$$
   * @param {number} d Difficulty $$D \in [1,10]$$
   * @param {Grade} g Grade (rating at Anki) [1.again,2.hard,3.good,4.easy]
   * @return {number} $$\text{next}_D$$
   */
  next_difficulty(d, g) {
    const delta_d = -this.param.w[6] * (g - 3);
    const next_d = d + this.linear_damping(delta_d, d);
    return clamp(
      this.mean_reversion(this.init_difficulty(Rating.Easy), next_d),
      1,
      10
    );
  }
  /**
   * The formula used is :
   * $$w_7 \cdot \text{init} +(1 - w_7) \cdot \text{current}$$
   * @param {number} init $$w_2 : D_0(3) = w_2 + (R-2) \cdot w_3= w_2$$
   * @param {number} current $$D - w_6 \cdot (R - 2)$$
   * @return {number} difficulty
   */
  mean_reversion(init, current) {
    const w = this.param.w;
    return roundTo(w[7] * init + (1 - w[7]) * current, 8);
  }
  /**
   * The formula used is :
   * $$S^\prime_r(D,S,R,G) = S\cdot(e^{w_8}\cdot (11-D)\cdot S^{-w_9}\cdot(e^{w_{10}\cdot(1-R)}-1)\cdot w_{15}(\text{if} G=2) \cdot w_{16}(\text{if} G=4)+1)$$
   * @param {number} d Difficulty D \in [1,10]
   * @param {number} s Stability (interval when R=90%)
   * @param {number} r Retrievability (probability of recall)
   * @param {Grade} g Grade (Rating[0.again,1.hard,2.good,3.easy])
   * @return {number} S^\prime_r new stability after recall
   */
  next_recall_stability(d, s, r, g) {
    const w = this.param.w;
    const hard_penalty = Rating.Hard === g ? w[15] : 1;
    const easy_bound = Rating.Easy === g ? w[16] : 1;
    return roundTo(
      clamp(
        s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1) * hard_penalty * easy_bound),
        S_MIN,
        36500
      ),
      8
    );
  }
  /**
   * The formula used is :
   * $$S^\prime_f(D,S,R) = w_{11}\cdot D^{-w_{12}}\cdot ((S+1)^{w_{13}}-1) \cdot e^{w_{14}\cdot(1-R)}$$
   * enable_short_term = true : $$S^\prime_f \in \min \lbrace \max \lbrace S^\prime_f,0.01\rbrace, \frac{S}{e^{w_{17} \cdot w_{18}}} \rbrace$$
   * enable_short_term = false : $$S^\prime_f \in \min \lbrace \max \lbrace S^\prime_f,0.01\rbrace, S \rbrace$$
   * @param {number} d Difficulty D \in [1,10]
   * @param {number} s Stability (interval when R=90%)
   * @param {number} r Retrievability (probability of recall)
   * @return {number} S^\prime_f new stability after forgetting
   */
  next_forget_stability(d, s, r) {
    const w = this.param.w;
    return roundTo(
      clamp(
        w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]),
        S_MIN,
        36500
      ),
      8
    );
  }
  /**
   * The formula used is :
   * $$S^\prime_s(S,G) = S \cdot e^{w_{17} \cdot (G-3+w_{18})}$$
   * @param {number} s Stability (interval when R=90%)
   * @param {Grade} g Grade (Rating[0.again,1.hard,2.good,3.easy])
   */
  next_short_term_stability(s, g) {
    const w = this.param.w;
    const sinc = Math.pow(s, -w[19]) * Math.exp(w[17] * (g - 3 + w[18]));
    const maskedSinc = g >= Rating.Hard ? Math.max(sinc, 1) : sinc;
    return roundTo(clamp(s * maskedSinc, S_MIN, 36500), 8);
  }
  /**
   * The formula used is :
   * $$R(t,S) = (1 + \text{FACTOR} \times \frac{t}{9 \cdot S})^{\text{DECAY}}$$
   * @param {number} elapsed_days t days since the last review
   * @param {number} stability Stability (interval when R=90%)
   * @return {number} r Retrievability (probability of recall)
   */
  forgetting_curve;
  /**
   * Calculates the next state of memory based on the current state, time elapsed, and grade.
   *
   * @param memory_state - The current state of memory, which can be null.
   * @param t - The time elapsed since the last review.
   * @param {Rating} g Grade (Rating[0.Manual,1.Again,2.Hard,3.Good,4.Easy])
   * @param r - Optional retrievability value. If not provided, it will be calculated.
   * @returns The next state of memory with updated difficulty and stability.
   */
  next_state(memory_state, t, g, r) {
    const { difficulty: d, stability: s } = memory_state ?? {
      difficulty: 0,
      stability: 0
    };
    if (t < 0) {
      throw new FSRSValidationError(`Invalid delta_t "${t}"`);
    }
    if (g < 0 || g > 4) {
      throw new FSRSValidationError(`Invalid grade "${g}"`);
    }
    if (d === 0 && s === 0) {
      return {
        difficulty: clamp(this.init_difficulty(g), 1, 10),
        stability: this.init_stability(g)
      };
    }
    if (g === 0) {
      return {
        difficulty: d,
        stability: s
      };
    }
    if (d < 1 || s < S_MIN) {
      throw new FSRSValidationError(
        `Invalid memory state { difficulty: ${d}, stability: ${s} }`
      );
    }
    const w = this.param.w;
    r = typeof r === "number" ? r : this.forgetting_curve(t, s);
    let new_s;
    if (t === 0 && this.param.enable_short_term) {
      new_s = this.next_short_term_stability(s, g);
    } else if (g === 1) {
      const s_after_fail = this.next_forget_stability(d, s, r);
      let [w_17, w_18] = [0, 0];
      if (this.param.enable_short_term) {
        w_17 = w[17];
        w_18 = w[18];
      }
      const next_s_min = s / Math.exp(w_17 * w_18);
      new_s = clamp(roundTo(next_s_min, 8), S_MIN, s_after_fail);
    } else {
      new_s = this.next_recall_stability(d, s, r, g);
    }
    const new_d = this.next_difficulty(d, g);
    return { difficulty: new_d, stability: new_s };
  }
}

class BasicScheduler extends AbstractScheduler {
  learningStepsStrategy;
  constructor(card, now, algorithm, strategies) {
    super(card, now, algorithm, strategies);
    let learningStepStrategy = BasicLearningStepsStrategy;
    if (this.strategies) {
      const custom_strategy = this.strategies.get(StrategyMode.LEARNING_STEPS);
      if (custom_strategy) {
        learningStepStrategy = custom_strategy;
      }
    }
    this.learningStepsStrategy = learningStepStrategy;
  }
  getLearningInfo(card, grade) {
    const parameters = this.algorithm.parameters;
    card.learning_steps = card.learning_steps || 0;
    const steps_strategy = this.learningStepsStrategy(
      parameters,
      card.state,
      card.learning_steps
    );
    const scheduled_minutes = Math.max(
      0,
      steps_strategy[grade]?.scheduled_minutes ?? 0
    );
    const next_steps = Math.max(0, steps_strategy[grade]?.next_step ?? 0);
    return {
      scheduled_minutes,
      next_steps
    };
  }
  /**
   * @description This function applies the learning steps based on the current card's state and grade.
   */
  applyLearningSteps(nextCard, grade, to_state) {
    const { scheduled_minutes, next_steps } = this.getLearningInfo(
      this.current,
      grade
    );
    if (scheduled_minutes > 0 && scheduled_minutes < 1440) {
      nextCard.learning_steps = next_steps;
      nextCard.scheduled_days = 0;
      nextCard.state = to_state;
      nextCard.due = date_scheduler(
        this.review_time,
        Math.round(scheduled_minutes),
        false
        /** true:days false: minute */
      );
    } else {
      nextCard.state = State.Review;
      if (scheduled_minutes >= 1440) {
        nextCard.learning_steps = next_steps;
        nextCard.due = date_scheduler(
          this.review_time,
          Math.round(scheduled_minutes),
          false
          /** true:days false: minute */
        );
        nextCard.scheduled_days = Math.floor(scheduled_minutes / 1440);
      } else {
        nextCard.learning_steps = 0;
        const interval = this.algorithm.next_interval(
          nextCard.stability,
          this.elapsed_days
        );
        nextCard.scheduled_days = interval;
        nextCard.due = date_scheduler(this.review_time, interval, true);
      }
    }
  }
  newState(grade) {
    const exist = this.next.get(grade);
    if (exist) {
      return exist;
    }
    const next = this.next_ds(this.elapsed_days, grade);
    this.applyLearningSteps(next, grade, State.Learning);
    const item = {
      card: next,
      log: this.buildLog(grade)
    };
    this.next.set(grade, item);
    return item;
  }
  learningState(grade) {
    const exist = this.next.get(grade);
    if (exist) {
      return exist;
    }
    const next = this.next_ds(this.elapsed_days, grade);
    this.applyLearningSteps(
      next,
      grade,
      this.last.state
      /** Learning or Relearning */
    );
    const item = {
      card: next,
      log: this.buildLog(grade)
    };
    this.next.set(grade, item);
    return item;
  }
  reviewState(grade) {
    const exist = this.next.get(grade);
    if (exist) {
      return exist;
    }
    const interval = this.elapsed_days;
    const retrievability = this.algorithm.forgetting_curve(
      interval,
      this.current.stability
    );
    const next_again = this.next_ds(interval, Rating.Again, retrievability);
    const next_hard = this.next_ds(interval, Rating.Hard, retrievability);
    const next_good = this.next_ds(interval, Rating.Good, retrievability);
    const next_easy = this.next_ds(interval, Rating.Easy, retrievability);
    this.next_interval(next_hard, next_good, next_easy, interval);
    this.next_state(next_hard, next_good, next_easy);
    this.applyLearningSteps(next_again, Rating.Again, State.Relearning);
    next_again.lapses += 1;
    const item_again = {
      card: next_again,
      log: this.buildLog(Rating.Again)
    };
    const item_hard = {
      card: next_hard,
      log: super.buildLog(Rating.Hard)
    };
    const item_good = {
      card: next_good,
      log: super.buildLog(Rating.Good)
    };
    const item_easy = {
      card: next_easy,
      log: super.buildLog(Rating.Easy)
    };
    this.next.set(Rating.Again, item_again);
    this.next.set(Rating.Hard, item_hard);
    this.next.set(Rating.Good, item_good);
    this.next.set(Rating.Easy, item_easy);
    return this.next.get(grade);
  }
  /**
   * Review next_ds
   */
  next_ds(t, g, r) {
    const next_state = this.algorithm.next_state(
      {
        difficulty: this.current.difficulty,
        stability: this.current.stability
      },
      t,
      g,
      r
    );
    const card = TypeConvert.card(this.current);
    card.difficulty = next_state.difficulty;
    card.stability = next_state.stability;
    return card;
  }
  /**
   * Review next_interval
   */
  next_interval(next_hard, next_good, next_easy, interval) {
    let hard_interval, good_interval;
    hard_interval = this.algorithm.next_interval(next_hard.stability, interval);
    good_interval = this.algorithm.next_interval(next_good.stability, interval);
    hard_interval = Math.min(hard_interval, good_interval);
    good_interval = Math.max(good_interval, hard_interval + 1);
    const easy_interval = Math.max(
      this.algorithm.next_interval(next_easy.stability, interval),
      good_interval + 1
    );
    next_hard.scheduled_days = hard_interval;
    next_hard.due = date_scheduler(this.review_time, hard_interval, true);
    next_good.scheduled_days = good_interval;
    next_good.due = date_scheduler(this.review_time, good_interval, true);
    next_easy.scheduled_days = easy_interval;
    next_easy.due = date_scheduler(this.review_time, easy_interval, true);
  }
  /**
   * Review next_state
   */
  next_state(next_hard, next_good, next_easy) {
    next_hard.state = State.Review;
    next_hard.learning_steps = 0;
    next_good.state = State.Review;
    next_good.learning_steps = 0;
    next_easy.state = State.Review;
    next_easy.learning_steps = 0;
  }
}

class LongTermScheduler extends AbstractScheduler {
  newState(grade) {
    const exist = this.next.get(grade);
    if (exist) {
      return exist;
    }
    this.current.scheduled_days = 0;
    this.current.elapsed_days = 0;
    const first_interval = 0;
    const next_again = this.next_ds(first_interval, Rating.Again);
    const next_hard = this.next_ds(first_interval, Rating.Hard);
    const next_good = this.next_ds(first_interval, Rating.Good);
    const next_easy = this.next_ds(first_interval, Rating.Easy);
    this.next_interval(
      next_again,
      next_hard,
      next_good,
      next_easy,
      first_interval
    );
    this.next_state(next_again, next_hard, next_good, next_easy);
    this.update_next(next_again, next_hard, next_good, next_easy);
    return this.next.get(grade);
  }
  next_ds(t, g, r) {
    const next_state = this.algorithm.next_state(
      {
        difficulty: this.current.difficulty,
        stability: this.current.stability
      },
      t,
      g,
      r
    );
    const card = TypeConvert.card(this.current);
    card.difficulty = next_state.difficulty;
    card.stability = next_state.stability;
    return card;
  }
  /**
   * @see https://github.com/open-spaced-repetition/ts-fsrs/issues/98#issuecomment-2241923194
   */
  learningState(grade) {
    return this.reviewState(grade);
  }
  reviewState(grade) {
    const exist = this.next.get(grade);
    if (exist) {
      return exist;
    }
    const interval = this.elapsed_days;
    const retrievability = this.algorithm.forgetting_curve(
      interval,
      this.current.stability
    );
    const next_again = this.next_ds(interval, Rating.Again, retrievability);
    const next_hard = this.next_ds(interval, Rating.Hard, retrievability);
    const next_good = this.next_ds(interval, Rating.Good, retrievability);
    const next_easy = this.next_ds(interval, Rating.Easy, retrievability);
    this.next_interval(next_again, next_hard, next_good, next_easy, interval);
    this.next_state(next_again, next_hard, next_good, next_easy);
    next_again.lapses += 1;
    this.update_next(next_again, next_hard, next_good, next_easy);
    return this.next.get(grade);
  }
  /**
   * Review/New next_interval
   */
  next_interval(next_again, next_hard, next_good, next_easy, interval) {
    let again_interval, hard_interval, good_interval, easy_interval;
    again_interval = this.algorithm.next_interval(
      next_again.stability,
      interval
    );
    hard_interval = this.algorithm.next_interval(next_hard.stability, interval);
    good_interval = this.algorithm.next_interval(next_good.stability, interval);
    easy_interval = this.algorithm.next_interval(next_easy.stability, interval);
    again_interval = Math.min(again_interval, hard_interval);
    hard_interval = Math.max(hard_interval, again_interval + 1);
    good_interval = Math.max(good_interval, hard_interval + 1);
    easy_interval = Math.max(easy_interval, good_interval + 1);
    next_again.scheduled_days = again_interval;
    next_again.due = date_scheduler(this.review_time, again_interval, true);
    next_hard.scheduled_days = hard_interval;
    next_hard.due = date_scheduler(this.review_time, hard_interval, true);
    next_good.scheduled_days = good_interval;
    next_good.due = date_scheduler(this.review_time, good_interval, true);
    next_easy.scheduled_days = easy_interval;
    next_easy.due = date_scheduler(this.review_time, easy_interval, true);
  }
  /**
   * Review/New next_state
   */
  next_state(next_again, next_hard, next_good, next_easy) {
    next_again.state = State.Review;
    next_again.learning_steps = 0;
    next_hard.state = State.Review;
    next_hard.learning_steps = 0;
    next_good.state = State.Review;
    next_good.learning_steps = 0;
    next_easy.state = State.Review;
    next_easy.learning_steps = 0;
  }
  update_next(next_again, next_hard, next_good, next_easy) {
    const item_again = {
      card: next_again,
      log: this.buildLog(Rating.Again)
    };
    const item_hard = {
      card: next_hard,
      log: super.buildLog(Rating.Hard)
    };
    const item_good = {
      card: next_good,
      log: super.buildLog(Rating.Good)
    };
    const item_easy = {
      card: next_easy,
      log: super.buildLog(Rating.Easy)
    };
    this.next.set(Rating.Again, item_again);
    this.next.set(Rating.Hard, item_hard);
    this.next.set(Rating.Good, item_good);
    this.next.set(Rating.Easy, item_easy);
  }
}

class Reschedule {
  fsrs;
  /**
   * Creates an instance of the `Reschedule` class.
   * @param fsrs - An instance of the FSRS class used for scheduling.
   */
  constructor(fsrs) {
    this.fsrs = fsrs;
  }
  /**
   * Replays a review for a card and determines the next review date based on the given rating.
   * @param card - The card being reviewed.
   * @param reviewed - The date the card was reviewed.
   * @param rating - The grade given to the card during the review.
   * @returns A `RecordLogItem` containing the updated card and review log.
   */
  replay(card, reviewed, rating) {
    return this.fsrs.next(card, reviewed, rating);
  }
  /**
   * Processes a manual review for a card, allowing for custom state, stability, difficulty, and due date.
   * @param card - The card being reviewed.
   * @param state - The state of the card after the review.
   * @param reviewed - The date the card was reviewed.
   * @param elapsed_days - The number of days since the last review.
   * @param stability - (Optional) The stability of the card.
   * @param difficulty - (Optional) The difficulty of the card.
   * @param due - (Optional) The due date for the next review.
   * @returns A `RecordLogItem` containing the updated card and review log.
   * @throws Will throw an error if the state or due date is not provided when required.
   */
  handleManualRating(card, state, reviewed, elapsed_days, stability, difficulty, due) {
    if (typeof state === "undefined") {
      throw new FSRSValidationError(
        "reschedule: state is required for manual rating"
      );
    }
    let log;
    let next_card;
    if (state === State.New) {
      log = {
        rating: Rating.Manual,
        state,
        due: due ?? reviewed,
        stability: card.stability,
        difficulty: card.difficulty,
        elapsed_days,
        last_elapsed_days: card.elapsed_days,
        scheduled_days: card.scheduled_days,
        learning_steps: card.learning_steps,
        review: reviewed
      };
      next_card = createEmptyCard(reviewed);
      next_card.last_review = reviewed;
    } else {
      if (typeof due === "undefined") {
        throw new FSRSValidationError(
          "reschedule: due is required for manual rating"
        );
      }
      const scheduled_days = date_diff(due, reviewed, "days");
      log = {
        rating: Rating.Manual,
        state: card.state,
        due: card.last_review || card.due,
        stability: card.stability,
        difficulty: card.difficulty,
        elapsed_days,
        last_elapsed_days: card.elapsed_days,
        scheduled_days: card.scheduled_days,
        learning_steps: card.learning_steps,
        review: reviewed
      };
      next_card = {
        ...card,
        state,
        due,
        last_review: reviewed,
        stability: stability || card.stability,
        difficulty: difficulty || card.difficulty,
        elapsed_days,
        scheduled_days,
        reps: card.reps + 1
      };
    }
    return { card: next_card, log };
  }
  /**
   * Reschedules a card based on its review history.
   *
   * @param current_card - The card to be rescheduled.
   * @param reviews - An array of review history objects.
   * @returns An array of record log items representing the rescheduling process.
   */
  reschedule(current_card, reviews) {
    const collections = [];
    let cur_card = createEmptyCard(current_card.due);
    for (const review of reviews) {
      let item;
      review.review = TypeConvert.time(review.review);
      if (review.rating === Rating.Manual) {
        let interval = 0;
        if (cur_card.state !== State.New && cur_card.last_review) {
          interval = date_diff(review.review, cur_card.last_review, "days");
        }
        item = this.handleManualRating(
          cur_card,
          review.state,
          review.review,
          interval,
          review.stability,
          review.difficulty,
          review.due ? TypeConvert.time(review.due) : void 0
        );
      } else {
        item = this.replay(cur_card, review.review, review.rating);
      }
      collections.push(item);
      cur_card = item.card;
    }
    return collections;
  }
  calculateManualRecord(current_card, now, record_log_item, update_memory) {
    if (!record_log_item) {
      return null;
    }
    const { card: reschedule_card, log } = record_log_item;
    const cur_card = TypeConvert.card(current_card);
    if (cur_card.due.getTime() === reschedule_card.due.getTime()) {
      return null;
    }
    cur_card.scheduled_days = date_diff(
      reschedule_card.due,
      cur_card.due,
      "days"
    );
    return this.handleManualRating(
      cur_card,
      reschedule_card.state,
      TypeConvert.time(now),
      log.elapsed_days,
      update_memory ? reschedule_card.stability : void 0,
      update_memory ? reschedule_card.difficulty : void 0,
      reschedule_card.due
    );
  }
}

function applyAfterHandler(value, afterHandler) {
  return typeof afterHandler === "function" ? afterHandler(value) : value;
}
class FSRS extends FSRSAlgorithm {
  strategyHandler = /* @__PURE__ */ new Map();
  Scheduler;
  constructor(param) {
    super(param);
    const { enable_short_term } = this.parameters;
    this.Scheduler = enable_short_term ? BasicScheduler : LongTermScheduler;
  }
  params_handler_proxy() {
    const _this = this;
    return {
      set: function(target, prop, value) {
        if (prop === "request_retention" && Number.isFinite(value)) {
          _this.intervalModifier = _this.calculate_interval_modifier(
            Number(value)
          );
        } else if (prop === "enable_short_term") {
          _this.Scheduler = value === true ? BasicScheduler : LongTermScheduler;
        } else if (prop === "w") {
          value = migrateParameters(
            value,
            target.relearning_steps.length,
            target.enable_short_term
          );
          _this.forgetting_curve = forgetting_curve.bind(this, value);
          _this.intervalModifier = _this.calculate_interval_modifier(
            Number(target.request_retention)
          );
        }
        Reflect.set(target, prop, value);
        return true;
      }
    };
  }
  useStrategy(mode, handler) {
    this.strategyHandler.set(mode, handler);
    return this;
  }
  clearStrategy(mode) {
    if (mode) {
      this.strategyHandler.delete(mode);
    } else {
      this.strategyHandler.clear();
    }
    return this;
  }
  getScheduler(card, now) {
    const schedulerStrategy = this.strategyHandler.get(
      StrategyMode.SCHEDULER
    );
    const Scheduler = schedulerStrategy || this.Scheduler;
    const instance = new Scheduler(card, now, this, this.strategyHandler);
    return instance;
  }
  /**
   * Display the collection of cards and logs for the four scenarios after scheduling the card at the current time.
   * @param card Card to be processed
   * @param now Current time or scheduled time
   * @param afterHandler Convert the result to another type. (Optional)
   * @example
   * ```typescript
   * const card: Card = createEmptyCard(new Date());
   * const f = fsrs();
   * const recordLog = f.repeat(card, new Date());
   * ```
   * @example
   * ```typescript
   * interface RevLogUnchecked
   *   extends Omit<ReviewLog, "due" | "review" | "state" | "rating"> {
   *   cid: string;
   *   due: Date | number;
   *   state: StateType;
   *   review: Date | number;
   *   rating: RatingType;
   * }
   *
   * interface RepeatRecordLog {
   *   card: CardUnChecked; //see method: createEmptyCard
   *   log: RevLogUnchecked;
   * }
   *
   * function repeatAfterHandler(recordLog: RecordLog) {
   *     const record: { [key in Grade]: RepeatRecordLog } = {} as {
   *       [key in Grade]: RepeatRecordLog;
   *     };
   *     for (const grade of Grades) {
   *       record[grade] = {
   *         card: {
   *           ...(recordLog[grade].card as Card & { cid: string }),
   *           due: recordLog[grade].card.due.getTime(),
   *           state: State[recordLog[grade].card.state] as StateType,
   *           last_review: recordLog[grade].card.last_review
   *             ? recordLog[grade].card.last_review!.getTime()
   *             : null,
   *         },
   *         log: {
   *           ...recordLog[grade].log,
   *           cid: (recordLog[grade].card as Card & { cid: string }).cid,
   *           due: recordLog[grade].log.due.getTime(),
   *           review: recordLog[grade].log.review.getTime(),
   *           state: State[recordLog[grade].log.state] as StateType,
   *           rating: Rating[recordLog[grade].log.rating] as RatingType,
   *         },
   *       };
   *     }
   *     return record;
   * }
   * const card: Card = createEmptyCard(new Date(), cardAfterHandler); //see method:  createEmptyCard
   * const f = fsrs();
   * const recordLog = f.repeat(card, new Date(), repeatAfterHandler);
   * ```
   */
  repeat(card, now, afterHandler) {
    const instance = this.getScheduler(card, now);
    const recordLog = instance.preview();
    return applyAfterHandler(recordLog, afterHandler);
  }
  /**
   * Display the collection of cards and logs for the card scheduled at the current time, after applying a specific grade rating.
   * @param card Card to be processed
   * @param now Current time or scheduled time
   * @param grade Rating of the review (Again, Hard, Good, Easy)
   * @param afterHandler Convert the result to another type. (Optional)
   * @example
   * ```typescript
   * const card: Card = createEmptyCard(new Date());
   * const f = fsrs();
   * const recordLogItem = f.next(card, new Date(), Rating.Again);
   * ```
   * @example
   * ```typescript
   * interface RevLogUnchecked
   *   extends Omit<ReviewLog, "due" | "review" | "state" | "rating"> {
   *   cid: string;
   *   due: Date | number;
   *   state: StateType;
   *   review: Date | number;
   *   rating: RatingType;
   * }
   *
   * interface NextRecordLog {
   *   card: CardUnChecked; //see method: createEmptyCard
   *   log: RevLogUnchecked;
   * }
   *
  function nextAfterHandler(recordLogItem: RecordLogItem) {
    const recordItem = {
      card: {
        ...(recordLogItem.card as Card & { cid: string }),
        due: recordLogItem.card.due.getTime(),
        state: State[recordLogItem.card.state] as StateType,
        last_review: recordLogItem.card.last_review
          ? recordLogItem.card.last_review!.getTime()
          : null,
      },
      log: {
        ...recordLogItem.log,
        cid: (recordLogItem.card as Card & { cid: string }).cid,
        due: recordLogItem.log.due.getTime(),
        review: recordLogItem.log.review.getTime(),
        state: State[recordLogItem.log.state] as StateType,
        rating: Rating[recordLogItem.log.rating] as RatingType,
      },
    };
    return recordItem
  }
   * const card: Card = createEmptyCard(new Date(), cardAfterHandler); //see method:  createEmptyCard
   * const f = fsrs();
   * const recordLogItem = f.repeat(card, new Date(), Rating.Again, nextAfterHandler);
   * ```
   */
  next(card, now, grade, afterHandler) {
    const instance = this.getScheduler(card, now);
    const g = TypeConvert.rating(grade);
    if (g === Rating.Manual) {
      throw new FSRSValidationError("Cannot review a manual rating");
    }
    const recordLogItem = instance.review(g);
    return applyAfterHandler(recordLogItem, afterHandler);
  }
  /**
   * Get the retrievability of the card
   * @param card  Card to be processed
   * @param now  Current time or scheduled time
   * @param format  default:true , Convert the result to another type. (Optional)
   * @returns  The retrievability of the card,if format is true, the result is a string, otherwise it is a number
   */
  get_retrievability(card, now, format = true) {
    const processedCard = TypeConvert.card(card);
    now = now ? TypeConvert.time(now) : /* @__PURE__ */ new Date();
    const t = processedCard.state !== State.New ? Math.max(date_diff(now, processedCard.last_review, "days"), 0) : 0;
    const r = processedCard.state !== State.New ? this.forgetting_curve(t, +processedCard.stability.toFixed(8)) : 0;
    return format ? `${(r * 100).toFixed(2)}%` : r;
  }
  /**
   *
   * @param card Card to be processed
   * @param log last review log
   * @param afterHandler Convert the result to another type. (Optional)
   * @example
   * ```typescript
   * const now = new Date();
   * const f = fsrs();
   * const emptyCardFormAfterHandler = createEmptyCard(now);
   * const repeatFormAfterHandler = f.repeat(emptyCardFormAfterHandler, now);
   * const { card, log } = repeatFormAfterHandler[Rating.Hard];
   * const rollbackFromAfterHandler = f.rollback(card, log);
   * ```
   *
   * @example
   * ```typescript
   * const now = new Date();
   * const f = fsrs();
   * const emptyCardFormAfterHandler = createEmptyCard(now, cardAfterHandler);  //see method: createEmptyCard
   * const repeatFormAfterHandler = f.repeat(emptyCardFormAfterHandler, now, repeatAfterHandler); //see method: fsrs.repeat()
   * const { card, log } = repeatFormAfterHandler[Rating.Hard];
   * const rollbackFromAfterHandler = f.rollback(card, log, cardAfterHandler);
   * ```
   */
  rollback(card, log, afterHandler) {
    const processedCard = TypeConvert.card(card);
    const processedLog = TypeConvert.review_log(log);
    if (processedLog.rating === Rating.Manual) {
      throw new FSRSValidationError("Cannot rollback a manual rating");
    }
    let last_due;
    let last_review;
    let last_lapses;
    switch (processedLog.state) {
      case State.New:
        last_due = processedLog.due;
        last_review = void 0;
        last_lapses = 0;
        break;
      case State.Learning:
      case State.Relearning:
      case State.Review:
        last_due = processedLog.review;
        last_review = processedLog.due;
        last_lapses = processedCard.lapses - (processedLog.rating === Rating.Again && processedLog.state === State.Review ? 1 : 0);
        break;
    }
    const prevCard = {
      ...processedCard,
      due: last_due,
      stability: processedLog.stability,
      difficulty: processedLog.difficulty,
      elapsed_days: processedLog.last_elapsed_days,
      scheduled_days: processedLog.scheduled_days,
      reps: Math.max(0, processedCard.reps - 1),
      lapses: Math.max(0, last_lapses),
      learning_steps: processedLog.learning_steps,
      state: processedLog.state,
      last_review
    };
    return applyAfterHandler(prevCard, afterHandler);
  }
  /**
   *
   * @param card Card to be processed
   * @param now Current time or scheduled time
   * @param reset_count Should the review count information(reps,lapses) be reset. (Optional)
   * @param afterHandler Convert the result to another type. (Optional)
   * @example
   * ```typescript
   * const now = new Date();
   * const f = fsrs();
   * const emptyCard = createEmptyCard(now);
   * const scheduling_cards = f.repeat(emptyCard, now);
   * const { card, log } = scheduling_cards[Rating.Hard];
   * const forgetCard = f.forget(card, new Date(), true);
   * ```
   *
   * @example
   * ```typescript
   * interface RepeatRecordLog {
   *   card: CardUnChecked; //see method: createEmptyCard
   *   log: RevLogUnchecked; //see method: fsrs.repeat()
   * }
   *
   * function forgetAfterHandler(recordLogItem: RecordLogItem): RepeatRecordLog {
   *     return {
   *       card: {
   *         ...(recordLogItem.card as Card & { cid: string }),
   *         due: recordLogItem.card.due.getTime(),
   *         state: State[recordLogItem.card.state] as StateType,
   *         last_review: recordLogItem.card.last_review
   *           ? recordLogItem.card.last_review!.getTime()
   *           : null,
   *       },
   *       log: {
   *         ...recordLogItem.log,
   *         cid: (recordLogItem.card as Card & { cid: string }).cid,
   *         due: recordLogItem.log.due.getTime(),
   *         review: recordLogItem.log.review.getTime(),
   *         state: State[recordLogItem.log.state] as StateType,
   *         rating: Rating[recordLogItem.log.rating] as RatingType,
   *       },
   *     };
   * }
   * const now = new Date();
   * const f = fsrs();
   * const emptyCardFormAfterHandler = createEmptyCard(now, cardAfterHandler); //see method:  createEmptyCard
   * const repeatFormAfterHandler = f.repeat(emptyCardFormAfterHandler, now, repeatAfterHandler); //see method: fsrs.repeat()
   * const { card } = repeatFormAfterHandler[Rating.Hard];
   * const forgetFromAfterHandler = f.forget(card, date_scheduler(now, 1, true), false, forgetAfterHandler);
   * ```
   */
  forget(card, now, reset_count = false, afterHandler) {
    const processedCard = TypeConvert.card(card);
    now = TypeConvert.time(now);
    const scheduled_days = processedCard.state === State.New ? 0 : date_diff(now, processedCard.due, "days");
    const forget_log = {
      rating: Rating.Manual,
      state: processedCard.state,
      due: processedCard.due,
      stability: processedCard.stability,
      difficulty: processedCard.difficulty,
      elapsed_days: 0,
      last_elapsed_days: processedCard.elapsed_days,
      scheduled_days,
      learning_steps: processedCard.learning_steps,
      review: now
    };
    const forget_card = {
      ...processedCard,
      due: now,
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: reset_count ? 0 : processedCard.reps,
      lapses: reset_count ? 0 : processedCard.lapses,
      learning_steps: 0,
      state: State.New,
      last_review: processedCard.last_review
    };
    const recordLogItem = { card: forget_card, log: forget_log };
    return applyAfterHandler(recordLogItem, afterHandler);
  }
  /**
   * Reschedules the current card and returns the rescheduled collections and reschedule item.
   *
   * @template T - The type of the record log item.
   * @param {CardInput | Card} current_card - The current card to be rescheduled.
   * @param {Array<FSRSHistory>} reviews - The array of FSRSHistory objects representing the reviews.
   * @param {Partial<RescheduleOptions<T>>} options - The optional reschedule options.
   * @returns {IReschedule<T>} - The rescheduled collections and reschedule item.
   *
   * @example
   * ```typescript
   * const f = fsrs()
   * const grades: Grade[] = [Rating.Good, Rating.Good, Rating.Good, Rating.Good]
   * const reviews_at = [
   *   new Date(2024, 8, 13),
   *   new Date(2024, 8, 13),
   *   new Date(2024, 8, 17),
   *   new Date(2024, 8, 28),
   * ]
   *
   * const reviews: FSRSHistory[] = []
   * for (let i = 0; i < grades.length; i++) {
   *   reviews.push({
   *     rating: grades[i],
   *     review: reviews_at[i],
   *   })
   * }
   *
   * const results_short = scheduler.reschedule(
   *   createEmptyCard(),
   *   reviews,
   *   {
   *     skipManual: false,
   *   }
   * )
   * console.log(results_short)
   * ```
   */
  reschedule(current_card, reviews = [], options = {}) {
    const {
      recordLogHandler,
      reviewsOrderBy,
      skipManual = true,
      now = /* @__PURE__ */ new Date(),
      update_memory_state: updateMemoryState = false
    } = options;
    if (reviewsOrderBy && typeof reviewsOrderBy === "function") {
      reviews.sort(reviewsOrderBy);
    }
    if (skipManual) {
      reviews = reviews.filter((review) => review.rating !== Rating.Manual);
    }
    const rescheduleSvc = new Reschedule(this);
    const collections = rescheduleSvc.reschedule(
      options.first_card || createEmptyCard(),
      reviews
    );
    const len = collections.length;
    const cur_card = TypeConvert.card(current_card);
    const manual_item = rescheduleSvc.calculateManualRecord(
      cur_card,
      now,
      len ? collections[len - 1] : void 0,
      updateMemoryState
    );
    return {
      collections: typeof recordLogHandler === "function" ? collections.map(recordLogHandler) : collections,
      reschedule_item: manual_item ? applyAfterHandler(manual_item, recordLogHandler) : null
    };
  }
}
const fsrs = (params) => {
  return new FSRS(params || {});
};


//# sourceMappingURL=index.mjs.map


/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	const __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		const cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		const module = __webpack_module_cache__[moduleId] = {
/******/ 			id: moduleId,
/******/ 			loaded: false,
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		if (!(moduleId in __webpack_modules__)) {
/******/ 			delete __webpack_module_cache__[moduleId];
/******/ 			const e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter/value functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			if(Array.isArray(definition)) {
/******/ 				var i = 0;
/******/ 				while(i < definition.length) {
/******/ 					var key = definition[i++];
/******/ 					var binding = definition[i++];
/******/ 					if(!__webpack_require__.o(exports, key)) {
/******/ 						if(binding === 0) {
/******/ 							Object.defineProperty(exports, key, { enumerable: true, value: definition[i++] });
/******/ 						} else {
/******/ 							Object.defineProperty(exports, key, { enumerable: true, get: binding });
/******/ 						}
/******/ 					} else if(binding === 0) { i++; }
/******/ 				}
/******/ 			} else {
/******/ 				for(var key in definition) {
/******/ 					if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 						Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 					}
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/harmony module decorator */
/******/ 	(() => {
/******/ 		__webpack_require__.hmd = (module) => {
/******/ 			module = Object.create(module);
/******/ 			if (!module.children) module.children = [];
/******/ 			Object.defineProperty(module, 'exports', {
/******/ 				enumerable: true,
/******/ 				set() {
/******/ 					throw new Error('ES Modules may not assign module.exports or exports.*, Use ESM export syntax, instead: ' + module.id);
/******/ 				}
/******/ 			});
/******/ 			return module;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	let __webpack_exports__ = __webpack_require__("./features/tracker/scheduler/fsrsScheduler.js");
/******/ 	
/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlzdC9mc3JzU2NoZWR1bGVyLmJ1bmRsZS5qcyIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUUrRDs7QUFFL0Q7QUFDQSxzRUFBc0UsS0FBOEIsR0FBRyxtQkFBTyxDQUFDLGlFQUFnQixJQUFJLENBQVE7O0FBRTNJO0FBQ0E7QUFDQTtBQUNBLGVBQWUsYUFBYTtBQUM1QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxzQ0FBc0M7O0FBRXRDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLCtHQUErRywwQkFBMEI7QUFDekk7QUFDQTtBQUNBO0FBQ0EsMEJBQTBCLHdEQUFlO0FBQ3pDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSwyQkFBMkIsZ0NBQWdDO0FBQzNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsMkdBQTJHLG1CQUFtQixjQUFjLE9BQU87QUFDbkosd0JBQXdCO0FBQ3hCO0FBQ0E7QUFDQTtBQUNBLGtDQUFrQyxtQkFBbUI7O0FBRXJEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQSwwQkFBMEIsNkNBQUk7QUFDOUI7QUFDQTtBQUNBLFNBQVM7O0FBRVQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsMEJBQTBCLDZDQUFJO0FBQzlCO0FBQ0E7QUFDQSxTQUFTOztBQUVUO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7Ozs7QUFJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSxJQUFJLEtBQTZCO0FBQ2pDO0FBQ0EsRUFBRTtBQUNGO0FBQ0E7Ozs7Ozs7Ozs7O0FDek1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLGVBQWUsUUFBUTtBQUN2QixlQUFlLFFBQVE7QUFDdkIsZUFBZSxRQUFRO0FBQ3ZCLGVBQWUsUUFBUTtBQUN2QixlQUFlLFVBQVU7QUFDekIsaUJBQWlCLFFBQVE7QUFDekI7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLGVBQWUsUUFBUTtBQUN2QixlQUFlLFFBQVE7QUFDdkIsZUFBZSxlQUFlO0FBQzlCLGVBQWUsUUFBUTtBQUN2QixpQkFBaUIsUUFBUTtBQUN6QjtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsZUFBZSxRQUFRO0FBQ3ZCLGVBQWUsUUFBUTtBQUN2QixpQkFBaUIsUUFBUTtBQUN6QjtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsZUFBZSxRQUFRO0FBQ3ZCLGVBQWUsUUFBUTtBQUN2QixpQkFBaUIsUUFBUTtBQUN6QjtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsaUJBQWlCLFFBQVE7QUFDekI7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsZUFBZSxRQUFRO0FBQ3ZCLGlCQUFpQixTQUFTO0FBQzFCO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FB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VztBQUNYO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHlEQUF5RCxLQUFLO0FBQzlEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsOEJBQThCLEtBQUs7QUFDbkM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU07QUFDTjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVksS0FBSyxHQUFHLEtBQUssR0FBRyxJQUFJO0FBQ2hDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUMsb0JBQW9COztBQUVyQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHNEQUFzRCxNQUFNO0FBQzVEO0FBQ0E7QUFDQTtBQUNBLFlBQVkscUJBQXFCO0FBQ2pDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxZQUFZLFFBQVE7QUFDcEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVksaUNBQWlDO0FBQzdDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxvQkFBb0IsaUJBQWlCO0FBQ3JDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esd0JBQXdCLFNBQVM7QUFDakM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLCtDQUErQyxXQUFXO0FBQzFEO0FBQ0EsSUFBSTtBQUNKO0FBQ0EsbUNBQW1DLGtCQUFrQjtBQUNyRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUk7QUFDSjtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsV0FBVztBQUNYO0FBQ0E7QUFDQSxVQUFVLGdCQUFnQjtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHlDQUF5QyxNQUFNLEdBQUcsUUFBUTtBQUMxRDtBQUNBLGNBQWMsT0FBTztBQUNyQjtB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O0FBQ0EsWUFBWSw4QkFBOEI7QUFDMUM7QUFDQTtBQUNBO0FBQ0E7QUFDQSx3REFBd0QsRUFBRTtBQUMxRDtBQUNBO0FBQ0Esc0RBQXNELEVBQUU7QUFDeEQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZ0NBQWdDLGNBQWMsRUFBRSxlQUFlLElBQUk7QUFDbkU7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNO0FBQ047QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU07QUFDTjtBQUNBO0FBQ0E7QUFDQSxhQUFhO0FBQ2I7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBWSxnQ0FBZ0M7QUFDNUM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNO0FBQ047QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFRO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxPQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsT0FBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNO0FBQ047QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsYUFBYTtBQUNiO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBUTtBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxZQUFZLDZCQUE2QjtBQUN6QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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O1dBQ0E7V0FDQTtXQUNBO1dBQ0E7V0FDQSwyQ0FBMkMsMENBQTBDO1dBQ3JGLE1BQU07V0FDTiwyQ0FBMkMsZ0NBQWdDO1dBQzNFO1dBQ0EsS0FBSyx5QkFBeUI7V0FDOUI7V0FDQSxHQUFHO1dBQ0g7V0FDQTtXQUNBLDBDQUEwQyx3Q0FBd0M7V0FDbEY7V0FDQTtXQUNBO1dBQ0EsRTs7Ozs7V0N0QkE7V0FDQTtXQUNBO1dBQ0E7V0FDQTtXQUNBO1dBQ0E7V0FDQTtXQUNBLEVBQUU7V0FDRjtXQUNBLEU7Ozs7O1dDVkEsd0Y7Ozs7O1dDQUE7V0FDQTtXQUNBO1dBQ0EsdURBQXVELGlCQUFpQjtXQUN4RTtXQUNBLGdEQUFnRCxhQUFhO1dBQzdELEU7Ozs7O1VFTkE7VUFDQTtVQUNBO1VBQ0EiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9hbGdvbW9uc3Rlci1mc3JzLWV4dGVuc2lvbi8uL2ZlYXR1cmVzL3RyYWNrZXIvc2NoZWR1bGVyL2ZzcnNTY2hlZHVsZXIuanMiLCJ3ZWJwYWNrOi8vYWxnb21vbnN0ZXItZnNycy1leHRlbnNpb24vLi9mZWF0dXJlcy90cmFja2VyL3NjaGVkdWxlci9zY2hlZHVsZXIuanMiLCJ3ZWJwYWNrOi8vYWxnb21vbnN0ZXItZnNycy1leHRlbnNpb24vLi9ub2RlX21vZHVsZXMvdHMtZnNycy9kaXN0L2luZGV4Lm1qcyIsIndlYnBhY2s6Ly9hbGdvbW9uc3Rlci1mc3JzLWV4dGVuc2lvbi93ZWJwYWNrL2Jvb3RzdHJhcCIsIndlYnBhY2s6Ly9hbGdvbW9uc3Rlci1mc3JzLWV4dGVuc2lvbi93ZWJwYWNrL3J1bnRpbWUvZGVmaW5lIHByb3BlcnR5IGdldHRlcnMiLCJ3ZWJwYWNrOi8vYWxnb21vbnN0ZXItZnNycy1leHRlbnNpb24vd2VicGFjay9ydW50aW1lL2hhcm1vbnkgbW9kdWxlIGRlY29yYXRvciIsIndlYnBhY2s6Ly9hbGdvbW9uc3Rlci1mc3JzLWV4dGVuc2lvbi93ZWJwYWNrL3J1bnRpbWUvaGFzT3duUHJvcGVydHkgc2hvcnRoYW5kIiwid2VicGFjazovL2FsZ29tb25zdGVyLWZzcnMtZXh0ZW5zaW9uL3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vYWxnb21vbnN0ZXItZnNycy1leHRlbnNpb24vd2VicGFjay9iZWZvcmUtc3RhcnR1cCIsIndlYnBhY2s6Ly9hbGdvbW9uc3Rlci1mc3JzLWV4dGVuc2lvbi93ZWJwYWNrL3N0YXJ0dXAiLCJ3ZWJwYWNrOi8vYWxnb21vbnN0ZXItZnNycy1leHRlbnNpb24vd2VicGFjay9hZnRlci1zdGFydHVwIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGZpbGUgZmVhdHVyZXMvdHJhY2tlci9zY2hlZHVsZXIvZnNyc1NjaGVkdWxlci5qc1xuICogQGRlc2NyaXB0aW9uIENvbmNyZXRlIGltcGxlbWVudGF0aW9uIG9mIHRoZSBGcmVlIFNwYWNlZCBSZXBldGl0aW9uIFNjaGVkdWxlciAoRlNSUykgYWxnb3JpdGhtLlxuICogRXh0ZW5kcyB0aGUgYWJzdHJhY3QgU2NoZWR1bGVyIGJhc2UgY2xhc3MgdG8gcHJvdmlkZSBtYXRoZW1hdGljYWxseSBwcmVjaXNlIGNhcmRcbiAqIHN0YWJpbGl0eSwgZGlmZmljdWx0eSwgcmV0cmlldmFiaWxpdHksIGFuZCBzY2hlZHVsZWQgcmV2aWV3IGludGVydmFscyB1c2luZyB0cy1mc3JzLlxuICovXG5cbmltcG9ydCB7IGZzcnMsIGNyZWF0ZUVtcHR5Q2FyZCwgUmF0aW5nLCBTdGF0ZSB9IGZyb20gJ3RzLWZzcnMnO1xuXG4vLyBGYWxsYmFjayBsb2dpYyBpZiB3ZSBhcmUgcnVubmluZyBvdXRzaWRlIFdlYnBhY2sgYnVuZGxpbmcgY29udGV4dCAod2hpY2ggd2Ugc2hvdWxkbid0IGJlIG5vdylcbmNvbnN0IEJhc2VTY2hlZHVsZXIgPSB0eXBlb2YgU2NoZWR1bGVyICE9PSAndW5kZWZpbmVkJyA/IFNjaGVkdWxlciA6ICh0eXBlb2YgcmVxdWlyZSAhPT0gJ3VuZGVmaW5lZCcgPyByZXF1aXJlKCcuL3NjaGVkdWxlci5qcycpIDogY2xhc3Mge30pO1xuXG5jbGFzcyBGc3JzU2NoZWR1bGVyIGV4dGVuZHMgQmFzZVNjaGVkdWxlciB7XG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZXMgdGhlIEZTUlMgc2NoZWR1bGVyIHdpdGggc3RhbmRhcmQgRlNSUy00LjUgd2VpZ2h0cyBhbmQgY29uc3RhbnRzLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fG51bGx9IFtwYXJhbXM9bnVsbF0gLSBDb25maWd1cmF0aW9uIG92ZXJyaWRlcy5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihwYXJhbXMgPSBudWxsKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMudyA9IFswLjQsIDAuNiwgMi40LCA1LjgsIDQuOTMsIDAuOTQsIDAuODYsIDAuMDEsIDEuNDksIDAuMTQsIDAuOTQsIDIuMTgsIDAuMDUsIDAuMzQsIDEuMjYsIDAuMjksIDIuNjFdO1xuICAgICAgICB0aGlzLmRlY2F5ID0gLTAuNTtcbiAgICAgICAgdGhpcy5mYWN0b3IgPSAxOSAvIDgxO1xuICAgICAgICB0aGlzLnJlcXVlc3RSZXRlbnRpb24gPSAwLjkwOyAvLyBUYXJnZXQgbWVtb3J5IHJldGVudGlvbiByYXRlXG5cbiAgICAgICAgaWYgKHBhcmFtcykge1xuICAgICAgICAgICAgaWYgKHBhcmFtcy53ICYmIEFycmF5LmlzQXJyYXkocGFyYW1zLncpICYmIHBhcmFtcy53Lmxlbmd0aCA9PT0gMTcpIHtcbiAgICAgICAgICAgICAgICB0aGlzLncgPSBwYXJhbXMudztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChwYXJhbXMuZGVjYXkgIT09IHVuZGVmaW5lZCAmJiAhaXNOYU4ocGFyYW1zLmRlY2F5KSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGVjYXkgPSBwYXJzZUZsb2F0KHBhcmFtcy5kZWNheSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocGFyYW1zLmZhY3RvciAhPT0gdW5kZWZpbmVkICYmICFpc05hTihwYXJhbXMuZmFjdG9yKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZmFjdG9yID0gcGFyc2VGbG9hdChwYXJhbXMuZmFjdG9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChwYXJhbXMucmVxdWVzdFJldGVudGlvbiAhPT0gdW5kZWZpbmVkICYmICFpc05hTihwYXJhbXMucmVxdWVzdFJldGVudGlvbikpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlcXVlc3RSZXRlbnRpb24gPSBwYXJzZUZsb2F0KHBhcmFtcy5yZXF1ZXN0UmV0ZW50aW9uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNyZWF0ZUNhcmQocHJvYmxlbVRpdGxlLCBwcm9ibGVtVXJsLCB0ZXh0UmVhZCwgYXBwcm9hY2gsIHRhZ3MgPSBbXSkge1xuICAgICAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LkxvZ2dlcikgd2luZG93LkxvZ2dlci5kZWJ1ZygnRlNSUycsICdDcmVhdGluZyBuZXcgY2FyZCcsIHsgcHJvYmxlbVRpdGxlLCBwcm9ibGVtVXJsIH0pO1xuICAgICAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpO1xuICAgICAgICBcbiAgICAgICAgLy8gdHMtZnNycyBwcm92aWRlcyBjcmVhdGVFbXB0eUNhcmQoKSB3aGljaCBzY2FmZm9sZHMgdGhlIHN0YW5kYXJkIEZTUlMgc3RydWN0dXJlXG4gICAgICAgIGNvbnN0IGVtcHR5Q2FyZCA9IGNyZWF0ZUVtcHR5Q2FyZChub3cpO1xuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGlkOiBEYXRlLm5vdygpLnRvU3RyaW5nKCksXG4gICAgICAgICAgICBwcm9ibGVtVGl0bGUsXG4gICAgICAgICAgICBwcm9ibGVtVXJsLFxuICAgICAgICAgICAgdGV4dFJlYWQsXG4gICAgICAgICAgICBhcHByb2FjaCxcbiAgICAgICAgICAgIHRhZ3MsXG4gICAgICAgICAgICBoaXN0b3J5TG9nOiBbeyByYXRpbmc6IDAsIGRhdGU6IG5vdy5nZXRUaW1lKCkgfV0sIC8vIFRyYWNrIGV4YWN0bHkgd2hlbiB0aGlzIHdhcyBjcmVhdGVkL3Jldmlld2VkXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZTUlMgc3RhbmRhcmRpemVkIHNjaGVtYSBmaWVsZHM6XG4gICAgICAgICAgICBkdWU6IGVtcHR5Q2FyZC5kdWUuZ2V0VGltZSgpLFxuICAgICAgICAgICAgc3RhYmlsaXR5OiBlbXB0eUNhcmQuc3RhYmlsaXR5LFxuICAgICAgICAgICAgZGlmZmljdWx0eTogZW1wdHlDYXJkLmRpZmZpY3VsdHksXG4gICAgICAgICAgICBlbGFwc2VkX2RheXM6IGVtcHR5Q2FyZC5lbGFwc2VkX2RheXMsXG4gICAgICAgICAgICBzY2hlZHVsZWRfZGF5czogZW1wdHlDYXJkLnNjaGVkdWxlZF9kYXlzLFxuICAgICAgICAgICAgcmVwczogZW1wdHlDYXJkLnJlcHMsXG4gICAgICAgICAgICBsYXBzZXM6IGVtcHR5Q2FyZC5sYXBzZXMsXG4gICAgICAgICAgICBzdGF0ZTogZW1wdHlDYXJkLnN0YXRlLFxuICAgICAgICAgICAgbGFzdF9yZXZpZXc6IGVtcHR5Q2FyZC5sYXN0X3JldmlldyA/IGVtcHR5Q2FyZC5sYXN0X3Jldmlldy5nZXRUaW1lKCkgOiBudWxsXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcmV2aWV3Q2FyZChjYXJkLCByYXRpbmcsIGN1c3RvbVdlaWdodHMgPSBudWxsLCBub3cgPSBEYXRlLm5vdygpKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cuTG9nZ2VyKSB3aW5kb3cuTG9nZ2VyLmRlYnVnKCdGU1JTJywgYFJldmlld2luZyBjYXJkOiAke2NhcmQucHJvYmxlbVRpdGxlfSB3aXRoIHJhdGluZyAke3JhdGluZ31gKTtcbiAgICAgICAgbGV0IG5ld0NhcmQgPSB7IC4uLmNhcmQgfTtcbiAgICAgICAgXG4gICAgICAgIG5ld0NhcmQucHJldmlvdXNEdWUgPSBjYXJkLmR1ZTtcbiAgICAgICAgbmV3Q2FyZC5oaXN0b3J5TG9nID0gbmV3Q2FyZC5oaXN0b3J5TG9nIHx8IFtdO1xuICAgICAgICBuZXdDYXJkLmhpc3RvcnlMb2cucHVzaCh7IHJhdGluZywgZGF0ZTogbm93IH0pO1xuXG4gICAgICAgIGxldCBsYXN0UmV2aWV3ID0gY2FyZC5sYXN0X3JldmlldztcbiAgICAgICAgaWYgKCFsYXN0UmV2aWV3ICYmIGNhcmQuaGlzdG9yeUxvZyAmJiBjYXJkLmhpc3RvcnlMb2cubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgY29uc3QgbGFzdExvZyA9IGNhcmQuaGlzdG9yeUxvZ1tjYXJkLmhpc3RvcnlMb2cubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICBsYXN0UmV2aWV3ID0gdHlwZW9mIGxhc3RMb2cgPT09ICdvYmplY3QnID8gbGFzdExvZy5kYXRlIDogbGFzdExvZztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHcgPSAoY3VzdG9tV2VpZ2h0cyAmJiBjdXN0b21XZWlnaHRzLmxlbmd0aCA9PT0gMTcpID8gY3VzdG9tV2VpZ2h0cyA6IHRoaXMudztcblxuICAgICAgICAvLyBJbml0aWFsaXplIHRzLWZzcnMgc2NoZWR1bGVyIHdpdGggc3RhbmRhcmQgb3IgY3VzdG9tIHdlaWdodHNcbiAgICAgICAgY29uc3Qgc2NoZWR1bGVyID0gZnNycyh7XG4gICAgICAgICAgICB3OiB3LFxuICAgICAgICAgICAgcmVxdWVzdF9yZXRlbnRpb246IHRoaXMucmVxdWVzdFJldGVudGlvblxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBDb252ZXJ0IHBsYWluIG9iamVjdCBiYWNrIHRvIHRzLWZzcnMgQ2FyZCBpbnRlcmZhY2UgZm9ybWF0XG4gICAgICAgIGNvbnN0IHRzQ2FyZCA9IHtcbiAgICAgICAgICAgIGR1ZTogbmV3IERhdGUobmV3Q2FyZC5kdWUpLFxuICAgICAgICAgICAgc3RhYmlsaXR5OiBuZXdDYXJkLnN0YWJpbGl0eSxcbiAgICAgICAgICAgIGRpZmZpY3VsdHk6IG5ld0NhcmQuZGlmZmljdWx0eSxcbiAgICAgICAgICAgIGVsYXBzZWRfZGF5czogbmV3Q2FyZC5lbGFwc2VkX2RheXMsXG4gICAgICAgICAgICBzY2hlZHVsZWRfZGF5czogbmV3Q2FyZC5zY2hlZHVsZWRfZGF5cyxcbiAgICAgICAgICAgIHJlcHM6IG5ld0NhcmQucmVwcyxcbiAgICAgICAgICAgIGxhcHNlczogbmV3Q2FyZC5sYXBzZXMsXG4gICAgICAgICAgICBzdGF0ZTogbmV3Q2FyZC5zdGF0ZSxcbiAgICAgICAgICAgIGxhc3RfcmV2aWV3OiBsYXN0UmV2aWV3ID8gbmV3IERhdGUobGFzdFJldmlldykgOiB1bmRlZmluZWRcbiAgICAgICAgfTtcblxuICAgICAgICAvLyB0cy1mc3JzIHJhdGluZ3MgYXJlOiAxPUFnYWluLCAyPUhhcmQsIDM9R29vZCwgND1FYXN5XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHNjaGVkdWxlci5uZXh0KHRzQ2FyZCwgbmV3IERhdGUobm93KSwgcmF0aW5nKTtcbiAgICAgICAgXG4gICAgICAgIC8vIE1hcCBiYWNrIHRvIEpTT04tc2VyaWFsaXphYmxlIHN0cnVjdHVyZVxuICAgICAgICBuZXdDYXJkLmR1ZSA9IHJlc3VsdC5jYXJkLmR1ZS5nZXRUaW1lKCk7XG4gICAgICAgIG5ld0NhcmQuc3RhYmlsaXR5ID0gcmVzdWx0LmNhcmQuc3RhYmlsaXR5O1xuICAgICAgICBuZXdDYXJkLmRpZmZpY3VsdHkgPSByZXN1bHQuY2FyZC5kaWZmaWN1bHR5O1xuICAgICAgICBuZXdDYXJkLmVsYXBzZWRfZGF5cyA9IHJlc3VsdC5jYXJkLmVsYXBzZWRfZGF5cztcbiAgICAgICAgbmV3Q2FyZC5zY2hlZHVsZWRfZGF5cyA9IHJlc3VsdC5jYXJkLnNjaGVkdWxlZF9kYXlzO1xuICAgICAgICBuZXdDYXJkLnJlcHMgPSByZXN1bHQuY2FyZC5yZXBzO1xuICAgICAgICBuZXdDYXJkLmxhcHNlcyA9IHJlc3VsdC5jYXJkLmxhcHNlcztcbiAgICAgICAgbmV3Q2FyZC5zdGF0ZSA9IHJlc3VsdC5jYXJkLnN0YXRlO1xuICAgICAgICBuZXdDYXJkLmxhc3RfcmV2aWV3ID0gcmVzdWx0LmNhcmQubGFzdF9yZXZpZXcgPyByZXN1bHQuY2FyZC5sYXN0X3Jldmlldy5nZXRUaW1lKCkgOiBudWxsO1xuXG4gICAgICAgIHJldHVybiBuZXdDYXJkO1xuICAgIH1cblxuICAgIGdldFJldHJpZXZhYmlsaXR5KGNhcmQsIG5vdyA9IERhdGUubm93KCkpIHtcbiAgICAgICAgbGV0IGxhc3RSZXZpZXcgPSBjYXJkLmxhc3RfcmV2aWV3O1xuICAgICAgICBpZiAoIWxhc3RSZXZpZXcgJiYgY2FyZC5oaXN0b3J5TG9nICYmIGNhcmQuaGlzdG9yeUxvZy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBsYXN0TG9nID0gY2FyZC5oaXN0b3J5TG9nW2NhcmQuaGlzdG9yeUxvZy5sZW5ndGggLSAxXTtcbiAgICAgICAgICAgIGxhc3RSZXZpZXcgPSB0eXBlb2YgbGFzdExvZyA9PT0gJ29iamVjdCcgPyBsYXN0TG9nLmRhdGUgOiBsYXN0TG9nO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNhcmQuc3RhYmlsaXR5IDw9IDAgfHwgIWxhc3RSZXZpZXcpIHtcbiAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdHNDYXJkID0ge1xuICAgICAgICAgICAgZHVlOiBuZXcgRGF0ZShjYXJkLmR1ZSksXG4gICAgICAgICAgICBzdGFiaWxpdHk6IGNhcmQuc3RhYmlsaXR5LFxuICAgICAgICAgICAgZGlmZmljdWx0eTogY2FyZC5kaWZmaWN1bHR5LFxuICAgICAgICAgICAgZWxhcHNlZF9kYXlzOiBjYXJkLmVsYXBzZWRfZGF5cyxcbiAgICAgICAgICAgIHNjaGVkdWxlZF9kYXlzOiBjYXJkLnNjaGVkdWxlZF9kYXlzLFxuICAgICAgICAgICAgcmVwczogY2FyZC5yZXBzLFxuICAgICAgICAgICAgbGFwc2VzOiBjYXJkLmxhcHNlcyxcbiAgICAgICAgICAgIHN0YXRlOiBjYXJkLnN0YXRlLFxuICAgICAgICAgICAgbGFzdF9yZXZpZXc6IG5ldyBEYXRlKGxhc3RSZXZpZXcpXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gdHMtZnNycyBuYXRpdmUgcmV0cmlldmFiaWxpdHkgY29tcHV0YXRpb25cbiAgICAgICAgY29uc3Qgc2NoZWR1bGVyID0gZnNycyh7XG4gICAgICAgICAgICB3OiB0aGlzLncsXG4gICAgICAgICAgICByZXF1ZXN0X3JldGVudGlvbjogdGhpcy5yZXF1ZXN0UmV0ZW50aW9uXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIGdldF9yZXRyaWV2YWJpbGl0eSB0YWtlcyB0aGUgY2FyZCBzdGF0ZSBhbmQgY3VycmVudCBkYXRlLCByZXR1cm5zIHByb2JhYmlsaXR5ICgwLjAgdG8gMS4wKVxuICAgICAgICByZXR1cm4gc2NoZWR1bGVyLmdldF9yZXRyaWV2YWJpbGl0eSh0c0NhcmQsIG5ldyBEYXRlKG5vdyksIGZhbHNlKSB8fCAwO1xuICAgIH1cblxuICAgIGdldERlZmF1bHRSZXF1ZXN0UmV0ZW50aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5yZXF1ZXN0UmV0ZW50aW9uO1xuICAgIH1cblxuICAgIGlzSGlnaERpZmZpY3VsdHkoY2FyZCkge1xuICAgICAgICAvLyBJbiBGU1JTLCBkaWZmaWN1bHR5IHNjYWxlcyBmcm9tIDEgKGVhc2llc3QpIHRvIDEwIChoYXJkZXN0KS5cbiAgICAgICAgcmV0dXJuIGNhcmQuZGlmZmljdWx0eSA+PSA3O1xuICAgIH1cblxuICAgIGlzR3JhZHVhdGVkKGNhcmQpIHtcbiAgICAgICAgLy8gRlNSUyBncmFkdWF0ZWQgY3JpdGVyaWE6IHN0YXRlIGlzIFJldmlldyAoMikgYW5kIHN0YWJpbGl0eSBpbmRpY2F0ZXMgbG9uZy10ZXJtIHJldGVudGlvbi5cbiAgICAgICAgcmV0dXJuIGNhcmQuc3RhdGUgPT09IDIgJiYgY2FyZC5zdGFiaWxpdHkgPiA3O1xuICAgIH1cblxuXG5cbiAgICByZXNldENvbmZpZ3VyYXRpb24oKSB7XG4gICAgICAgIHRoaXMudyA9IFswLjQsIDAuNiwgMi40LCA1LjgsIDQuOTMsIDAuOTQsIDAuODYsIDAuMDEsIDEuNDksIDAuMTQsIDAuOTQsIDIuMTgsIDAuMDUsIDAuMzQsIDEuMjYsIDAuMjksIDIuNjFdO1xuICAgICAgICB0aGlzLmRlY2F5ID0gLTAuNTtcbiAgICAgICAgdGhpcy5mYWN0b3IgPSAxOSAvIDgxO1xuICAgICAgICB0aGlzLnJlcXVlc3RSZXRlbnRpb24gPSAwLjkwO1xuICAgIH1cblxuICAgIGV4cG9ydENvbmZpZ3VyYXRpb24oKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB3OiBbLi4udGhpcy53XSxcbiAgICAgICAgICAgIGRlY2F5OiB0aGlzLmRlY2F5LFxuICAgICAgICAgICAgZmFjdG9yOiB0aGlzLmZhY3RvcixcbiAgICAgICAgICAgIHJlcXVlc3RSZXRlbnRpb246IHRoaXMucmVxdWVzdFJldGVudGlvblxuICAgICAgICB9O1xuICAgIH1cblxuICAgIGltcG9ydENvbmZpZ3VyYXRpb24oY29uZmlnKSB7XG4gICAgICAgIGlmICghY29uZmlnKSByZXR1cm47XG4gICAgICAgIGlmIChjb25maWcudyAmJiBBcnJheS5pc0FycmF5KGNvbmZpZy53KSAmJiBjb25maWcudy5sZW5ndGggPT09IDE3KSB7XG4gICAgICAgICAgICB0aGlzLncgPSBjb25maWcudztcbiAgICAgICAgfVxuICAgICAgICBpZiAoY29uZmlnLmRlY2F5ICE9PSB1bmRlZmluZWQpIHRoaXMuZGVjYXkgPSBwYXJzZUZsb2F0KGNvbmZpZy5kZWNheSk7XG4gICAgICAgIGlmIChjb25maWcuZmFjdG9yICE9PSB1bmRlZmluZWQpIHRoaXMuZmFjdG9yID0gcGFyc2VGbG9hdChjb25maWcuZmFjdG9yKTtcbiAgICAgICAgaWYgKGNvbmZpZy5yZXF1ZXN0UmV0ZW50aW9uICE9PSB1bmRlZmluZWQpIHRoaXMucmVxdWVzdFJldGVudGlvbiA9IHBhcnNlRmxvYXQoY29uZmlnLnJlcXVlc3RSZXRlbnRpb24pO1xuICAgIH1cbn1cblxuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBGc3JzU2NoZWR1bGVyO1xufSBlbHNlIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgIHdpbmRvdy5Gc3JzU2NoZWR1bGVyID0gRnNyc1NjaGVkdWxlcjtcbn1cbiIsIi8qKlxuICogQGZpbGUgZmVhdHVyZXMvdHJhY2tlci9zY2hlZHVsZXIvc2NoZWR1bGVyLmpzXG4gKiBAZGVzY3JpcHRpb24gQWJzdHJhY3QgYmFzZSBjbGFzcyBkZWZpbmluZyB0aGUgc3RhbmRhcmQgaW50ZXJmYWNlIGZvciBzY2hlZHVsaW5nIGFsZ29yaXRobXMuXG4gKiBBbnkgc2NoZWR1bGluZyBhbGdvcml0aG0gKGUuZy4sIEZTUlMsIFNNLTIsIExlaXRuZXIpIG11c3QgZXh0ZW5kIHRoaXMgY2xhc3MgdG8gYmUgZnVsbHlcbiAqIHBsdWdnYWJsZSB3aXRoaW4gdGhlIGV4dGVuc2lvbiBhcmNoaXRlY3R1cmUuXG4gKi9cblxuY2xhc3MgU2NoZWR1bGVyIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgaWYgKG5ldy50YXJnZXQgPT09IFNjaGVkdWxlcikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCBjb25zdHJ1Y3QgU2NoZWR1bGVyIGluc3RhbmNlcyBkaXJlY3RseS5cIik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplcyBhIG5ldyBmbGFzaGNhcmQgc2NoZW1hIHdpdGggZGVmYXVsdCBzY2hlZHVsaW5nIHBhcmFtZXRlcnMuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHByb2JsZW1UaXRsZSAtIFRoZSB0aXRsZSBvZiB0aGUgcHJvYmxlbS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gcHJvYmxlbVVybCAtIFRoZSBjYW5vbmljYWwgVVJMIG9mIHRoZSBwcm9ibGVtLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0UmVhZCAtIFNhdmVkIG5vdGVzIGNvbnRleHQuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGFwcHJvYWNoIC0gVGV4dHVhbCBkZXNjcmlwdGlvbiBvZiB0aGUgcHJvYmxlbS1zb2x2aW5nIGFwcHJvYWNoLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nW119IFt0YWdzPVtdXSAtIENhdGVnb3J5IHRhZ3MgYXNzb2NpYXRlZCB3aXRoIHRoaXMgY2FyZC5cbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBOZXdseSBpbml0aWFsaXplZCBjYXJkIHNjaGVtYS5cbiAgICAgKi9cbiAgICBjcmVhdGVDYXJkKHByb2JsZW1UaXRsZSwgcHJvYmxlbVVybCwgdGV4dFJlYWQsIGFwcHJvYWNoLCB0YWdzID0gW10pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTWV0aG9kICdjcmVhdGVDYXJkKCknIG11c3QgYmUgaW1wbGVtZW50ZWQuXCIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRyYW5zaXRpb24gY2FyZCBwYXJhbWV0ZXJzIGJhc2VkIG9uIHJldmlldyByYXRpbmcuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGNhcmQgLSBUaGUgYWN0aXZlIGZsYXNoY2FyZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcmF0aW5nIC0gUmV2aWV3IHF1YWxpdHkgKDE9QWdhaW4sIDI9SGFyZCwgMz1Hb29kLCA0PUVhc3kpLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW118bnVsbH0gW2N1c3RvbVdlaWdodHM9bnVsbF0gLSBPcHRpb25hbCBvdmVycmlkZSB3ZWlnaHRzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbm93PURhdGUubm93KCldIC0gQ3VzdG9tIGJhc2VsaW5lIHRpbWVzdGFtcC5cbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBIGNvcHkgb2YgdGhlIGNhcmQgd2l0aCB1cGRhdGVkIHNjaGVkdWxpbmcgbWV0cmljcy5cbiAgICAgKi9cbiAgICByZXZpZXdDYXJkKGNhcmQsIHJhdGluZywgY3VzdG9tV2VpZ2h0cyA9IG51bGwsIG5vdyA9IERhdGUubm93KCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTWV0aG9kICdyZXZpZXdDYXJkKCknIG11c3QgYmUgaW1wbGVtZW50ZWQuXCIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbXB1dGVzIHRoZSBtYXRoZW1hdGljYWwgcmV0cmlldmFiaWxpdHkgcHJvYmFiaWxpdHkgKDAuMCB0byAxLjApIG9mIGEgY2FyZC5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gY2FyZCAtIFRoZSBhY3RpdmUgZmxhc2hjYXJkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbm93PURhdGUubm93KCldIC0gRXZhbHVhdGlvbiB0aW1lc3RhbXAuXG4gICAgICogQHJldHVybnMge251bWJlcn0gUmV0cmlldmFiaWxpdHkgcGVyY2VudGFnZSByZXByZXNlbnRhdGlvbi5cbiAgICAgKi9cbiAgICBnZXRSZXRyaWV2YWJpbGl0eShjYXJkLCBub3cgPSBEYXRlLm5vdygpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk1ldGhvZCAnZ2V0UmV0cmlldmFiaWxpdHkoKScgbXVzdCBiZSBpbXBsZW1lbnRlZC5cIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29tcHV0ZXMgcHJvamVjdGVkIHJldHJpZXZhYmlsaXR5IG92ZXIgYSBmdXR1cmUgdGltZSBzcGFuIGJhc2VkIG9uIGN1cnJlbnQgc3RhYmlsaXR5LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzdGFiaWxpdHkgLSBUaGUgY2FyZCBvciBhdmVyYWdlIHN0YWJpbGl0eSBtZXRyaWMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGVsYXBzZWREYXlzIC0gRnV0dXJlIGV2YWx1YXRpb24gcG9pbnQgaW4gZGF5cy5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBQcm9qZWN0ZWQgcmV0cmlldmFiaWxpdHkgcHJvYmFiaWxpdHkgKDAuMCB0byAxLjApLlxuICAgICAqL1xuICAgIGdldFByb2plY3RlZFJldHJpZXZhYmlsaXR5KHN0YWJpbGl0eSwgZWxhcHNlZERheXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTWV0aG9kICdnZXRQcm9qZWN0ZWRSZXRyaWV2YWJpbGl0eSgpJyBtdXN0IGJlIGltcGxlbWVudGVkLlwiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIGJhc2VsaW5lIHRhcmdldCBtZW1vcnkgcmV0ZW50aW9uIHJhdGUgZm9yIHRoZSBzY2hlZHVsaW5nIGFsZ29yaXRobS5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBEZWZhdWx0IHJlcXVlc3QgcmV0ZW50aW9uIHRhcmdldCAoZS5nLiwgMC45MCBmb3IgOTAlKS5cbiAgICAgKi9cbiAgICBnZXREZWZhdWx0UmVxdWVzdFJldGVudGlvbigpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTWV0aG9kICdnZXREZWZhdWx0UmVxdWVzdFJldGVudGlvbigpJyBtdXN0IGJlIGltcGxlbWVudGVkLlwiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXRlcm1pbmVzIHdoZXRoZXIgdGhlIGNhcmQgaXMgY29uc2lkZXJlZCB0byBoYXZlIGEgaGlnaGx5IGRpZmZpY3VsdCByYXRpbmdcbiAgICAgKiBiYXNlZCBvbiB0aGUgYWxnb3JpdGhtJ3Mgc3BlY2lmaWMgZGlmZmljdWx0eSBzY2FsZS5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gY2FyZCAtIFRoZSBhY3RpdmUgZmxhc2hjYXJkLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBjYXJkIGRpZmZpY3VsdHkgaXMgc3RyaWN0bHkgJ2hpZ2gnLlxuICAgICAqL1xuICAgIGlzSGlnaERpZmZpY3VsdHkoY2FyZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJNZXRob2QgJ2lzSGlnaERpZmZpY3VsdHkoKScgbXVzdCBiZSBpbXBsZW1lbnRlZC5cIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRXZhbHVhdGVzIHdoZXRoZXIgYSBjYXJkIGhhcyBwYXNzZWQgdGhlIGxlYXJuaW5nIHBoYXNlIGludG8gJ2dyYWR1YXRlZCcgcmV2aWV3LlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBjYXJkIC0gVGhlIGFjdGl2ZSBmbGFzaGNhcmQuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgZ3JhZHVhdGVkLlxuICAgICAqL1xuICAgIGlzR3JhZHVhdGVkKGNhcmQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTWV0aG9kICdpc0dyYWR1YXRlZCgpJyBtdXN0IGJlIGltcGxlbWVudGVkLlwiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXRlcm1pbmVzIHdoZXRoZXIgdGhlIGN1cnJlbnQgc2NoZWR1bGVyIGltcGxlbWVudGF0aW9uIHN1cHBvcnRzIHBlcnNvbmFsaXplZCBvcHRpbWl6YXRpb24uXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgb3B0aW1pemF0aW9uIGlzIHN1cHBvcnRlZC5cbiAgICAgKi9cbiAgICBzdXBwb3J0c09wdGltaXphdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRyYWlucyBhbmQgYXBwbGllcyBvcHRpbWl6ZWQgc2NoZWR1bGluZyBwYXJhbWV0ZXJzIGJhc2VkIG9uIGhpc3RvcmljYWwgcmV2aWV3IGRhdGEuXG4gICAgICogQHBhcmFtIHtPYmplY3RbXX0gcmV2aWV3SGlzdG9yeSAtIEhpc3RvcmljYWwgcmV2aWV3IGxvZyBkYXRhLlxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPE9iamVjdD59IFRoZSBvcHRpbWl6YXRpb24gcmVzdWx0cyBhbmQgbWV0YWRhdGEuXG4gICAgICovXG4gICAgYXN5bmMgb3B0aW1pemUocmV2aWV3SGlzdG9yeSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJNZXRob2QgJ29wdGltaXplKCknIGlzIG5vdCBzdXBwb3J0ZWQgYnkgdGhpcyBzY2hlZHVsZXIuXCIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc2V0cyB0aGUgc2NoZWR1bGluZyBwYXJhbWV0ZXJzIHRvIHRoZWlyIGFsZ29yaXRobWljIGRlZmF1bHRzLlxuICAgICAqL1xuICAgIHJlc2V0Q29uZmlndXJhdGlvbigpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTWV0aG9kICdyZXNldENvbmZpZ3VyYXRpb24oKScgaXMgbm90IHN1cHBvcnRlZCBieSB0aGlzIHNjaGVkdWxlci5cIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRXhwb3J0cyB0aGUgY3VycmVudCBzY2hlZHVsaW5nIHBhcmFtZXRlcnMuXG4gICAgICogQHJldHVybnMge09iamVjdH0gQ3VycmVudCBjb25maWd1cmF0aW9uIHBhcmFtZXRlcnMuXG4gICAgICovXG4gICAgZXhwb3J0Q29uZmlndXJhdGlvbigpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTWV0aG9kICdleHBvcnRDb25maWd1cmF0aW9uKCknIGlzIG5vdCBzdXBwb3J0ZWQgYnkgdGhpcyBzY2hlZHVsZXIuXCIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEltcG9ydHMgYW5kIGFwcGxpZXMgc2NoZWR1bGluZyBwYXJhbWV0ZXJzLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgLSBDb25maWd1cmF0aW9uIHBhcmFtZXRlcnMuXG4gICAgICovXG4gICAgaW1wb3J0Q29uZmlndXJhdGlvbihjb25maWcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTWV0aG9kICdpbXBvcnRDb25maWd1cmF0aW9uKCknIGlzIG5vdCBzdXBwb3J0ZWQgYnkgdGhpcyBzY2hlZHVsZXIuXCIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEhlbHBlciB0byBleHBvcnQgdG8gQ29tbW9uSlMgaWYgcnVubmluZyBpbiBOb2RlIGVudmlyb25tZW50IGZvciB0ZXN0aW5nLlxuICAgICAqL1xufVxuXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IFNjaGVkdWxlcjtcbn1cbiIsImNsYXNzIEZTUlNFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IobWVzc2FnZSA9IFwiRlNSUyBFcnJvclwiKSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gICAgdGhpcy5uYW1lID0gXCJGU1JTRXJyb3JcIjtcbiAgICBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZT8uKHRoaXMsIEZTUlNFcnJvcik7XG4gIH1cbn1cbmNsYXNzIEZTUlNWYWxpZGF0aW9uRXJyb3IgZXh0ZW5kcyBGU1JTRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihtZXNzYWdlKSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gICAgdGhpcy5uYW1lID0gXCJGU1JTVmFsaWRhdGlvbkVycm9yXCI7XG4gICAgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2U/Lih0aGlzLCBGU1JTVmFsaWRhdGlvbkVycm9yKTtcbiAgfVxufVxuXG52YXIgU3RhdGUgPSAvKiBAX19QVVJFX18gKi8gKChTdGF0ZTIpID0+IHtcbiAgU3RhdGUyW1N0YXRlMltcIk5ld1wiXSA9IDBdID0gXCJOZXdcIjtcbiAgU3RhdGUyW1N0YXRlMltcIkxlYXJuaW5nXCJdID0gMV0gPSBcIkxlYXJuaW5nXCI7XG4gIFN0YXRlMltTdGF0ZTJbXCJSZXZpZXdcIl0gPSAyXSA9IFwiUmV2aWV3XCI7XG4gIFN0YXRlMltTdGF0ZTJbXCJSZWxlYXJuaW5nXCJdID0gM10gPSBcIlJlbGVhcm5pbmdcIjtcbiAgcmV0dXJuIFN0YXRlMjtcbn0pKFN0YXRlIHx8IHt9KTtcbnZhciBSYXRpbmcgPSAvKiBAX19QVVJFX18gKi8gKChSYXRpbmcyKSA9PiB7XG4gIFJhdGluZzJbUmF0aW5nMltcIk1hbnVhbFwiXSA9IDBdID0gXCJNYW51YWxcIjtcbiAgUmF0aW5nMltSYXRpbmcyW1wiQWdhaW5cIl0gPSAxXSA9IFwiQWdhaW5cIjtcbiAgUmF0aW5nMltSYXRpbmcyW1wiSGFyZFwiXSA9IDJdID0gXCJIYXJkXCI7XG4gIFJhdGluZzJbUmF0aW5nMltcIkdvb2RcIl0gPSAzXSA9IFwiR29vZFwiO1xuICBSYXRpbmcyW1JhdGluZzJbXCJFYXN5XCJdID0gNF0gPSBcIkVhc3lcIjtcbiAgcmV0dXJuIFJhdGluZzI7XG59KShSYXRpbmcgfHwge30pO1xuXG5jbGFzcyBUeXBlQ29udmVydCB7XG4gIHN0YXRpYyBjYXJkKGNhcmQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgLi4uY2FyZCxcbiAgICAgIHN0YXRlOiBUeXBlQ29udmVydC5zdGF0ZShjYXJkLnN0YXRlKSxcbiAgICAgIGR1ZTogVHlwZUNvbnZlcnQudGltZShjYXJkLmR1ZSksXG4gICAgICBsYXN0X3JldmlldzogY2FyZC5sYXN0X3JldmlldyA/IFR5cGVDb252ZXJ0LnRpbWUoY2FyZC5sYXN0X3JldmlldykgOiB2b2lkIDBcbiAgICB9O1xuICB9XG4gIHN0YXRpYyByYXRpbmcodmFsdWUpIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiKSB7XG4gICAgICBjb25zdCBmaXJzdExldHRlciA9IHZhbHVlLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpO1xuICAgICAgY29uc3QgcmVzdE9mU3RyaW5nID0gdmFsdWUuc2xpY2UoMSkudG9Mb3dlckNhc2UoKTtcbiAgICAgIGNvbnN0IHJldCA9IFJhdGluZ1tgJHtmaXJzdExldHRlcn0ke3Jlc3RPZlN0cmluZ31gXTtcbiAgICAgIGlmIChyZXQgPT09IHZvaWQgMCkge1xuICAgICAgICB0aHJvdyBuZXcgRlNSU1ZhbGlkYXRpb25FcnJvcihgSW52YWxpZCByYXRpbmc6WyR7dmFsdWV9XWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJldDtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJudW1iZXJcIikge1xuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgRlNSU1ZhbGlkYXRpb25FcnJvcihgSW52YWxpZCByYXRpbmc6WyR7dmFsdWV9XWApO1xuICB9XG4gIHN0YXRpYyBzdGF0ZSh2YWx1ZSkge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIGNvbnN0IGZpcnN0TGV0dGVyID0gdmFsdWUuY2hhckF0KDApLnRvVXBwZXJDYXNlKCk7XG4gICAgICBjb25zdCByZXN0T2ZTdHJpbmcgPSB2YWx1ZS5zbGljZSgxKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgY29uc3QgcmV0ID0gU3RhdGVbYCR7Zmlyc3RMZXR0ZXJ9JHtyZXN0T2ZTdHJpbmd9YF07XG4gICAgICBpZiAocmV0ID09PSB2b2lkIDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEZTUlNWYWxpZGF0aW9uRXJyb3IoYEludmFsaWQgc3RhdGU6WyR7dmFsdWV9XWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJldDtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJudW1iZXJcIikge1xuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgRlNSU1ZhbGlkYXRpb25FcnJvcihgSW52YWxpZCBzdGF0ZTpbJHt2YWx1ZX1dYCk7XG4gIH1cbiAgc3RhdGljIHRpbWUodmFsdWUpIHtcbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZSh2YWx1ZSk7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJvYmplY3RcIiAmJiB2YWx1ZSAhPT0gbnVsbCAmJiAhTnVtYmVyLmlzTmFOKERhdGUucGFyc2UodmFsdWUpIHx8ICtkYXRlKSkge1xuICAgICAgcmV0dXJuIGRhdGU7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIGNvbnN0IHRpbWVzdGFtcCA9IERhdGUucGFyc2UodmFsdWUpO1xuICAgICAgaWYgKCFOdW1iZXIuaXNOYU4odGltZXN0YW1wKSkge1xuICAgICAgICByZXR1cm4gbmV3IERhdGUodGltZXN0YW1wKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBGU1JTVmFsaWRhdGlvbkVycm9yKGBJbnZhbGlkIGRhdGU6WyR7dmFsdWV9XWApO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSBcIm51bWJlclwiKSB7XG4gICAgICByZXR1cm4gbmV3IERhdGUodmFsdWUpO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgRlNSU1ZhbGlkYXRpb25FcnJvcihgSW52YWxpZCBkYXRlOlske3ZhbHVlfV1gKTtcbiAgfVxuICBzdGF0aWMgcmV2aWV3X2xvZyhsb2cpIHtcbiAgICByZXR1cm4ge1xuICAgICAgLi4ubG9nLFxuICAgICAgZHVlOiBUeXBlQ29udmVydC50aW1lKGxvZy5kdWUpLFxuICAgICAgcmF0aW5nOiBUeXBlQ29udmVydC5yYXRpbmcobG9nLnJhdGluZyksXG4gICAgICBzdGF0ZTogVHlwZUNvbnZlcnQuc3RhdGUobG9nLnN0YXRlKSxcbiAgICAgIHJldmlldzogVHlwZUNvbnZlcnQudGltZShsb2cucmV2aWV3KVxuICAgIH07XG4gIH1cbn1cblxuLyogaXN0YW5idWwgaWdub3JlIG5leHQgLS0gQHByZXNlcnZlICovXG5EYXRlLnByb3RvdHlwZS5zY2hlZHVsZXIgPSBmdW5jdGlvbih0LCBpc0RheSkge1xuICByZXR1cm4gZGF0ZV9zY2hlZHVsZXIodGhpcywgdCwgaXNEYXkpO1xufTtcbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0IC0tIEBwcmVzZXJ2ZSAqL1xuRGF0ZS5wcm90b3R5cGUuZGlmZiA9IGZ1bmN0aW9uKHByZSwgdW5pdCkge1xuICByZXR1cm4gZGF0ZV9kaWZmKHRoaXMsIHByZSwgdW5pdCk7XG59O1xuLyogaXN0YW5idWwgaWdub3JlIG5leHQgLS0gQHByZXNlcnZlICovXG5EYXRlLnByb3RvdHlwZS5mb3JtYXQgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIGZvcm1hdERhdGUodGhpcyk7XG59O1xuLyogaXN0YW5idWwgaWdub3JlIG5leHQgLS0gQHByZXNlcnZlICovXG5EYXRlLnByb3RvdHlwZS5kdWVGb3JtYXQgPSBmdW5jdGlvbihsYXN0X3JldmlldywgdW5pdCwgdGltZVVuaXQpIHtcbiAgcmV0dXJuIHNob3dfZGlmZl9tZXNzYWdlKHRoaXMsIGxhc3RfcmV2aWV3LCB1bml0LCB0aW1lVW5pdCk7XG59O1xuZnVuY3Rpb24gZGF0ZV9zY2hlZHVsZXIobm93LCB0LCBpc0RheSkge1xuICByZXR1cm4gbmV3IERhdGUoXG4gICAgaXNEYXkgPyBUeXBlQ29udmVydC50aW1lKG5vdykuZ2V0VGltZSgpICsgdCAqIDI0ICogNjAgKiA2MCAqIDFlMyA6IFR5cGVDb252ZXJ0LnRpbWUobm93KS5nZXRUaW1lKCkgKyB0ICogNjAgKiAxZTNcbiAgKTtcbn1cbmZ1bmN0aW9uIGRhdGVfZGlmZihub3csIHByZSwgdW5pdCkge1xuICBpZiAoIW5vdyB8fCAhcHJlKSB7XG4gICAgdGhyb3cgbmV3IEZTUlNWYWxpZGF0aW9uRXJyb3IoXCJJbnZhbGlkIGRhdGVcIik7XG4gIH1cbiAgY29uc3QgZGlmZiA9IFR5cGVDb252ZXJ0LnRpbWUobm93KS5nZXRUaW1lKCkgLSBUeXBlQ29udmVydC50aW1lKHByZSkuZ2V0VGltZSgpO1xuICBsZXQgciA9IDA7XG4gIHN3aXRjaCAodW5pdCkge1xuICAgIGNhc2UgXCJkYXlzXCI6XG4gICAgICByID0gTWF0aC5mbG9vcihkaWZmIC8gKDI0ICogNjAgKiA2MCAqIDFlMykpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcIm1pbnV0ZXNcIjpcbiAgICAgIHIgPSBNYXRoLmZsb29yKGRpZmYgLyAoNjAgKiAxZTMpKTtcbiAgICAgIGJyZWFrO1xuICB9XG4gIHJldHVybiByO1xufVxuZnVuY3Rpb24gZm9ybWF0RGF0ZShkYXRlSW5wdXQpIHtcbiAgY29uc3QgZGF0ZSA9IFR5cGVDb252ZXJ0LnRpbWUoZGF0ZUlucHV0KTtcbiAgY29uc3QgeWVhciA9IGRhdGUuZ2V0RnVsbFllYXIoKTtcbiAgY29uc3QgbW9udGggPSBkYXRlLmdldE1vbnRoKCkgKyAxO1xuICBjb25zdCBkYXkgPSBkYXRlLmdldERhdGUoKTtcbiAgY29uc3QgaG91cnMgPSBkYXRlLmdldEhvdXJzKCk7XG4gIGNvbnN0IG1pbnV0ZXMgPSBkYXRlLmdldE1pbnV0ZXMoKTtcbiAgY29uc3Qgc2Vjb25kcyA9IGRhdGUuZ2V0U2Vjb25kcygpO1xuICByZXR1cm4gYCR7eWVhcn0tJHtwYWRaZXJvKG1vbnRoKX0tJHtwYWRaZXJvKGRheSl9ICR7cGFkWmVybyhob3Vycyl9OiR7cGFkWmVybyhcbiAgICBtaW51dGVzXG4gICl9OiR7cGFkWmVybyhzZWNvbmRzKX1gO1xufVxuZnVuY3Rpb24gcGFkWmVybyhudW0pIHtcbiAgcmV0dXJuIG51bSA8IDEwID8gYDAke251bX1gIDogYCR7bnVtfWA7XG59XG5jb25zdCBUSU1FVU5JVCA9IFs2MCwgNjAsIDI0LCAzMSwgMTJdO1xuY29uc3QgVElNRVVOSVRGT1JNQVQgPSBbXCJzZWNvbmRcIiwgXCJtaW5cIiwgXCJob3VyXCIsIFwiZGF5XCIsIFwibW9udGhcIiwgXCJ5ZWFyXCJdO1xuZnVuY3Rpb24gc2hvd19kaWZmX21lc3NhZ2UoZHVlLCBsYXN0X3JldmlldywgdW5pdCwgdGltZVVuaXQgPSBUSU1FVU5JVEZPUk1BVCkge1xuICBkdWUgPSBUeXBlQ29udmVydC50aW1lKGR1ZSk7XG4gIGxhc3RfcmV2aWV3ID0gVHlwZUNvbnZlcnQudGltZShsYXN0X3Jldmlldyk7XG4gIGlmICh0aW1lVW5pdC5sZW5ndGggIT09IFRJTUVVTklURk9STUFULmxlbmd0aCkge1xuICAgIHRpbWVVbml0ID0gVElNRVVOSVRGT1JNQVQ7XG4gIH1cbiAgbGV0IGRpZmYgPSBkdWUuZ2V0VGltZSgpIC0gbGFzdF9yZXZpZXcuZ2V0VGltZSgpO1xuICBsZXQgaSA9IDA7XG4gIGRpZmYgLz0gMWUzO1xuICBmb3IgKGkgPSAwOyBpIDwgVElNRVVOSVQubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoZGlmZiA8IFRJTUVVTklUW2ldKSB7XG4gICAgICBicmVhaztcbiAgICB9IGVsc2Uge1xuICAgICAgZGlmZiAvPSBUSU1FVU5JVFtpXTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGAke01hdGguZmxvb3IoZGlmZil9JHt1bml0ID8gdGltZVVuaXRbaV0gOiBcIlwifWA7XG59XG4vKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAtLSBAcHJlc2VydmUgKi9cbmZ1bmN0aW9uIGZpeERhdGUodmFsdWUpIHtcbiAgcmV0dXJuIFR5cGVDb252ZXJ0LnRpbWUodmFsdWUpO1xufVxuLyogaXN0YW5idWwgaWdub3JlIG5leHQgLS0gQHByZXNlcnZlICovXG5mdW5jdGlvbiBmaXhTdGF0ZSh2YWx1ZSkge1xuICByZXR1cm4gVHlwZUNvbnZlcnQuc3RhdGUodmFsdWUpO1xufVxuLyogaXN0YW5idWwgaWdub3JlIG5leHQgLS0gQHByZXNlcnZlICovXG5mdW5jdGlvbiBmaXhSYXRpbmcodmFsdWUpIHtcbiAgcmV0dXJuIFR5cGVDb252ZXJ0LnJhdGluZyh2YWx1ZSk7XG59XG5jb25zdCBHcmFkZXMgPSBPYmplY3QuZnJlZXplKFtcbiAgUmF0aW5nLkFnYWluLFxuICBSYXRpbmcuSGFyZCxcbiAgUmF0aW5nLkdvb2QsXG4gIFJhdGluZy5FYXN5XG5dKTtcbmNvbnN0IEZVWlpfUkFOR0VTID0gW1xuICB7XG4gICAgc3RhcnQ6IDIuNSxcbiAgICBlbmQ6IDcsXG4gICAgZmFjdG9yOiAwLjE1XG4gIH0sXG4gIHtcbiAgICBzdGFydDogNyxcbiAgICBlbmQ6IDIwLFxuICAgIGZhY3RvcjogMC4xXG4gIH0sXG4gIHtcbiAgICBzdGFydDogMjAsXG4gICAgZW5kOiBJbmZpbml0eSxcbiAgICBmYWN0b3I6IDAuMDVcbiAgfVxuXTtcbmZ1bmN0aW9uIGdldF9mdXp6X3JhbmdlKGludGVydmFsLCBlbGFwc2VkX2RheXMsIG1heGltdW1faW50ZXJ2YWwpIHtcbiAgbGV0IGRlbHRhID0gMTtcbiAgZm9yIChjb25zdCByYW5nZSBvZiBGVVpaX1JBTkdFUykge1xuICAgIGRlbHRhICs9IHJhbmdlLmZhY3RvciAqIE1hdGgubWF4KE1hdGgubWluKGludGVydmFsLCByYW5nZS5lbmQpIC0gcmFuZ2Uuc3RhcnQsIDApO1xuICB9XG4gIGludGVydmFsID0gTWF0aC5taW4oaW50ZXJ2YWwsIG1heGltdW1faW50ZXJ2YWwpO1xuICBsZXQgbWluX2l2bCA9IE1hdGgubWF4KDIsIE1hdGgucm91bmQoaW50ZXJ2YWwgLSBkZWx0YSkpO1xuICBjb25zdCBtYXhfaXZsID0gTWF0aC5taW4oTWF0aC5yb3VuZChpbnRlcnZhbCArIGRlbHRhKSwgbWF4aW11bV9pbnRlcnZhbCk7XG4gIGlmIChpbnRlcnZhbCA+IGVsYXBzZWRfZGF5cykge1xuICAgIG1pbl9pdmwgPSBNYXRoLm1heChtaW5faXZsLCBlbGFwc2VkX2RheXMgKyAxKTtcbiAgfVxuICBtaW5faXZsID0gTWF0aC5taW4obWluX2l2bCwgbWF4X2l2bCk7XG4gIHJldHVybiB7IG1pbl9pdmwsIG1heF9pdmwgfTtcbn1cbmZ1bmN0aW9uIGNsYW1wKHZhbHVlLCBtaW4sIG1heCkge1xuICByZXR1cm4gTWF0aC5taW4oTWF0aC5tYXgodmFsdWUsIG1pbiksIG1heCk7XG59XG5mdW5jdGlvbiByb3VuZFRvKG51bSwgZGVjaW1hbHMpIHtcbiAgY29uc3QgZmFjdG9yID0gMTAgKiogZGVjaW1hbHM7XG4gIHJldHVybiBNYXRoLnJvdW5kKG51bSAqIGZhY3RvcikgLyBmYWN0b3I7XG59XG5mdW5jdGlvbiBkYXRlRGlmZkluRGF5cyhsYXN0LCBjdXIpIHtcbiAgY29uc3QgdXRjMSA9IERhdGUuVVRDKFxuICAgIGxhc3QuZ2V0VVRDRnVsbFllYXIoKSxcbiAgICBsYXN0LmdldFVUQ01vbnRoKCksXG4gICAgbGFzdC5nZXRVVENEYXRlKClcbiAgKTtcbiAgY29uc3QgdXRjMiA9IERhdGUuVVRDKFxuICAgIGN1ci5nZXRVVENGdWxsWWVhcigpLFxuICAgIGN1ci5nZXRVVENNb250aCgpLFxuICAgIGN1ci5nZXRVVENEYXRlKClcbiAgKTtcbiAgcmV0dXJuIE1hdGguZmxvb3IoXG4gICAgKHV0YzIgLSB1dGMxKSAvIDg2NGU1XG4gICAgLyoqIDEwMDAgKiA2MCAqIDYwICogMjQqL1xuICApO1xufVxuXG5jb25zdCBDb252ZXJ0U3RlcFVuaXRUb01pbnV0ZXMgPSAoc3RlcCkgPT4ge1xuICBjb25zdCB1bml0ID0gc3RlcC5zbGljZSgtMSk7XG4gIGNvbnN0IHZhbHVlID0gcGFyc2VJbnQoc3RlcC5zbGljZSgwLCAtMSksIDEwKTtcbiAgaWYgKE51bWJlci5pc05hTih2YWx1ZSkgfHwgIU51bWJlci5pc0Zpbml0ZSh2YWx1ZSkgfHwgdmFsdWUgPCAwKSB7XG4gICAgdGhyb3cgbmV3IEZTUlNWYWxpZGF0aW9uRXJyb3IoYEludmFsaWQgc3RlcCB2YWx1ZTogJHtzdGVwfWApO1xuICB9XG4gIHN3aXRjaCAodW5pdCkge1xuICAgIGNhc2UgXCJtXCI6XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgY2FzZSBcImhcIjpcbiAgICAgIHJldHVybiB2YWx1ZSAqIDYwO1xuICAgIGNhc2UgXCJkXCI6XG4gICAgICByZXR1cm4gdmFsdWUgKiAxNDQwO1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRlNSU1ZhbGlkYXRpb25FcnJvcihcbiAgICAgICAgYEludmFsaWQgc3RlcCB1bml0OiAke3N0ZXB9LCBleHBlY3RlZCBtL2gvZGBcbiAgICAgICk7XG4gIH1cbn07XG5jb25zdCBCYXNpY0xlYXJuaW5nU3RlcHNTdHJhdGVneSA9IChwYXJhbXMsIHN0YXRlLCBjdXJfc3RlcCkgPT4ge1xuICBjb25zdCBsZWFybmluZ19zdGVwcyA9IHN0YXRlID09PSBTdGF0ZS5SZWxlYXJuaW5nIHx8IHN0YXRlID09PSBTdGF0ZS5SZXZpZXcgPyBwYXJhbXMucmVsZWFybmluZ19zdGVwcyA6IHBhcmFtcy5sZWFybmluZ19zdGVwcztcbiAgY29uc3Qgc3RlcHNfbGVuZ3RoID0gbGVhcm5pbmdfc3RlcHMubGVuZ3RoO1xuICBpZiAoc3RlcHNfbGVuZ3RoID09PSAwIHx8IGN1cl9zdGVwID49IHN0ZXBzX2xlbmd0aCkgcmV0dXJuIHt9O1xuICBjb25zdCBmaXJzdFN0ZXAgPSBsZWFybmluZ19zdGVwc1swXTtcbiAgY29uc3QgdG9NaW51dGVzID0gQ29udmVydFN0ZXBVbml0VG9NaW51dGVzO1xuICBjb25zdCBnZXRBZ2FpbkludGVydmFsID0gKCkgPT4ge1xuICAgIHJldHVybiB0b01pbnV0ZXMoZmlyc3RTdGVwKTtcbiAgfTtcbiAgY29uc3QgZ2V0SGFyZEludGVydmFsID0gKCkgPT4ge1xuICAgIGlmIChzdGVwc19sZW5ndGggPT09IDEpIHJldHVybiBNYXRoLnJvdW5kKHRvTWludXRlcyhmaXJzdFN0ZXApICogMS41KTtcbiAgICBjb25zdCBuZXh0U3RlcCA9IGxlYXJuaW5nX3N0ZXBzWzFdO1xuICAgIHJldHVybiBNYXRoLnJvdW5kKCh0b01pbnV0ZXMoZmlyc3RTdGVwKSArIHRvTWludXRlcyhuZXh0U3RlcCkpIC8gMik7XG4gIH07XG4gIGNvbnN0IGdldFN0ZXBJbmZvID0gKGluZGV4KSA9PiB7XG4gICAgaWYgKGluZGV4IDwgMCB8fCBpbmRleCA+PSBzdGVwc19sZW5ndGgpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbGVhcm5pbmdfc3RlcHNbaW5kZXhdO1xuICAgIH1cbiAgfTtcbiAgY29uc3QgZ2V0R29vZE1pbnV0ZXMgPSAoc3RlcCkgPT4ge1xuICAgIHJldHVybiB0b01pbnV0ZXMoc3RlcCk7XG4gIH07XG4gIGNvbnN0IHJlc3VsdCA9IHt9O1xuICBjb25zdCBzdGVwX2luZm8gPSBnZXRTdGVwSW5mbyhNYXRoLm1heCgwLCBjdXJfc3RlcCkpO1xuICBpZiAoc3RhdGUgPT09IFN0YXRlLlJldmlldykge1xuICAgIHJlc3VsdFtSYXRpbmcuQWdhaW5dID0ge1xuICAgICAgc2NoZWR1bGVkX21pbnV0ZXM6IHRvTWludXRlcyhzdGVwX2luZm8pLFxuICAgICAgbmV4dF9zdGVwOiAwXG4gICAgfTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9IGVsc2Uge1xuICAgIHJlc3VsdFtSYXRpbmcuQWdhaW5dID0ge1xuICAgICAgc2NoZWR1bGVkX21pbnV0ZXM6IGdldEFnYWluSW50ZXJ2YWwoKSxcbiAgICAgIG5leHRfc3RlcDogMFxuICAgIH07XG4gICAgcmVzdWx0W1JhdGluZy5IYXJkXSA9IHtcbiAgICAgIHNjaGVkdWxlZF9taW51dGVzOiBnZXRIYXJkSW50ZXJ2YWwoKSxcbiAgICAgIG5leHRfc3RlcDogY3VyX3N0ZXBcbiAgICB9O1xuICAgIGNvbnN0IG5leHRfaW5mbyA9IGdldFN0ZXBJbmZvKGN1cl9zdGVwICsgMSk7XG4gICAgaWYgKG5leHRfaW5mbykge1xuICAgICAgY29uc3QgbmV4dE1pbiA9IGdldEdvb2RNaW51dGVzKG5leHRfaW5mbyk7XG4gICAgICBpZiAobmV4dE1pbikge1xuICAgICAgICByZXN1bHRbUmF0aW5nLkdvb2RdID0ge1xuICAgICAgICAgIHNjaGVkdWxlZF9taW51dGVzOiBNYXRoLnJvdW5kKG5leHRNaW4pLFxuICAgICAgICAgIG5leHRfc3RlcDogY3VyX3N0ZXAgKyAxXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHQ7XG59O1xuXG5mdW5jdGlvbiBEZWZhdWx0SW5pdFNlZWRTdHJhdGVneSgpIHtcbiAgY29uc3QgdGltZSA9IHRoaXMucmV2aWV3X3RpbWUuZ2V0VGltZSgpO1xuICBjb25zdCByZXBzID0gdGhpcy5jdXJyZW50LnJlcHM7XG4gIGNvbnN0IG11bCA9IHRoaXMuY3VycmVudC5kaWZmaWN1bHR5ICogdGhpcy5jdXJyZW50LnN0YWJpbGl0eTtcbiAgcmV0dXJuIGAke3RpbWV9XyR7cmVwc31fJHttdWx9YDtcbn1cbmZ1bmN0aW9uIEdlblNlZWRTdHJhdGVneVdpdGhDYXJkSWQoY2FyZF9pZF9maWVsZCkge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgY2FyZF9pZCA9IFJlZmxlY3QuZ2V0KHRoaXMuY3VycmVudCwgY2FyZF9pZF9maWVsZCkgPz8gMDtcbiAgICBjb25zdCByZXBzID0gdGhpcy5jdXJyZW50LnJlcHM7XG4gICAgcmV0dXJuIFN0cmluZyhjYXJkX2lkICsgcmVwcyB8fCAwKTtcbiAgfTtcbn1cblxudmFyIFN0cmF0ZWd5TW9kZSA9IC8qIEBfX1BVUkVfXyAqLyAoKFN0cmF0ZWd5TW9kZTIpID0+IHtcbiAgU3RyYXRlZ3lNb2RlMltcIlNDSEVEVUxFUlwiXSA9IFwiU2NoZWR1bGVyXCI7XG4gIFN0cmF0ZWd5TW9kZTJbXCJMRUFSTklOR19TVEVQU1wiXSA9IFwiTGVhcm5pbmdTdGVwc1wiO1xuICBTdHJhdGVneU1vZGUyW1wiU0VFRFwiXSA9IFwiU2VlZFwiO1xuICByZXR1cm4gU3RyYXRlZ3lNb2RlMjtcbn0pKFN0cmF0ZWd5TW9kZSB8fCB7fSk7XG5cbmNsYXNzIEFic3RyYWN0U2NoZWR1bGVyIHtcbiAgbGFzdDtcbiAgY3VycmVudDtcbiAgcmV2aWV3X3RpbWU7XG4gIG5leHQgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xuICBhbGdvcml0aG07XG4gIHN0cmF0ZWdpZXM7XG4gIGVsYXBzZWRfZGF5cyA9IDA7XG4gIC8vIGluaXRcbiAgY29uc3RydWN0b3IoY2FyZCwgbm93LCBhbGdvcml0aG0sIHN0cmF0ZWdpZXMpIHtcbiAgICB0aGlzLmFsZ29yaXRobSA9IGFsZ29yaXRobTtcbiAgICB0aGlzLmxhc3QgPSBUeXBlQ29udmVydC5jYXJkKGNhcmQpO1xuICAgIHRoaXMuY3VycmVudCA9IFR5cGVDb252ZXJ0LmNhcmQoY2FyZCk7XG4gICAgdGhpcy5yZXZpZXdfdGltZSA9IFR5cGVDb252ZXJ0LnRpbWUobm93KTtcbiAgICB0aGlzLnN0cmF0ZWdpZXMgPSBzdHJhdGVnaWVzO1xuICAgIHRoaXMuaW5pdCgpO1xuICB9XG4gIGNoZWNrR3JhZGUoZ3JhZGUpIHtcbiAgICBpZiAoIU51bWJlci5pc0Zpbml0ZShncmFkZSkgfHwgZ3JhZGUgPCAxIHx8IGdyYWRlID4gNCkge1xuICAgICAgdGhyb3cgbmV3IEZTUlNWYWxpZGF0aW9uRXJyb3IoYEludmFsaWQgZ3JhZGUgXCIke2dyYWRlfVwiLGV4cGVjdGVkIDEtNGApO1xuICAgIH1cbiAgfVxuICBpbml0KCkge1xuICAgIGNvbnN0IHsgc3RhdGUsIGxhc3RfcmV2aWV3IH0gPSB0aGlzLmN1cnJlbnQ7XG4gICAgbGV0IGludGVydmFsID0gMDtcbiAgICBpZiAoc3RhdGUgIT09IFN0YXRlLk5ldyAmJiBsYXN0X3Jldmlldykge1xuICAgICAgaW50ZXJ2YWwgPSBkYXRlRGlmZkluRGF5cyhsYXN0X3JldmlldywgdGhpcy5yZXZpZXdfdGltZSk7XG4gICAgfVxuICAgIHRoaXMuY3VycmVudC5sYXN0X3JldmlldyA9IHRoaXMucmV2aWV3X3RpbWU7XG4gICAgdGhpcy5lbGFwc2VkX2RheXMgPSBpbnRlcnZhbDtcbiAgICB0aGlzLmN1cnJlbnQuZWxhcHNlZF9kYXlzID0gaW50ZXJ2YWw7XG4gICAgdGhpcy5jdXJyZW50LnJlcHMgKz0gMTtcbiAgICBsZXQgc2VlZF9zdHJhdGVneSA9IERlZmF1bHRJbml0U2VlZFN0cmF0ZWd5O1xuICAgIGlmICh0aGlzLnN0cmF0ZWdpZXMpIHtcbiAgICAgIGNvbnN0IGN1c3RvbV9zdHJhdGVneSA9IHRoaXMuc3RyYXRlZ2llcy5nZXQoU3RyYXRlZ3lNb2RlLlNFRUQpO1xuICAgICAgaWYgKGN1c3RvbV9zdHJhdGVneSkge1xuICAgICAgICBzZWVkX3N0cmF0ZWd5ID0gY3VzdG9tX3N0cmF0ZWd5O1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmFsZ29yaXRobS5zZWVkID0gc2VlZF9zdHJhdGVneS5jYWxsKHRoaXMpO1xuICB9XG4gIHByZXZpZXcoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIFtSYXRpbmcuQWdhaW5dOiB0aGlzLnJldmlldyhSYXRpbmcuQWdhaW4pLFxuICAgICAgW1JhdGluZy5IYXJkXTogdGhpcy5yZXZpZXcoUmF0aW5nLkhhcmQpLFxuICAgICAgW1JhdGluZy5Hb29kXTogdGhpcy5yZXZpZXcoUmF0aW5nLkdvb2QpLFxuICAgICAgW1JhdGluZy5FYXN5XTogdGhpcy5yZXZpZXcoUmF0aW5nLkVhc3kpLFxuICAgICAgW1N5bWJvbC5pdGVyYXRvcl06IHRoaXMucHJldmlld0l0ZXJhdG9yLmJpbmQodGhpcylcbiAgICB9O1xuICB9XG4gICpwcmV2aWV3SXRlcmF0b3IoKSB7XG4gICAgZm9yIChjb25zdCBncmFkZSBvZiBHcmFkZXMpIHtcbiAgICAgIHlpZWxkIHRoaXMucmV2aWV3KGdyYWRlKTtcbiAgICB9XG4gIH1cbiAgcmV2aWV3KGdyYWRlKSB7XG4gICAgY29uc3QgeyBzdGF0ZSB9ID0gdGhpcy5sYXN0O1xuICAgIGxldCBpdGVtO1xuICAgIHRoaXMuY2hlY2tHcmFkZShncmFkZSk7XG4gICAgc3dpdGNoIChzdGF0ZSkge1xuICAgICAgY2FzZSBTdGF0ZS5OZXc6XG4gICAgICAgIGl0ZW0gPSB0aGlzLm5ld1N0YXRlKGdyYWRlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLkxlYXJuaW5nOlxuICAgICAgY2FzZSBTdGF0ZS5SZWxlYXJuaW5nOlxuICAgICAgICBpdGVtID0gdGhpcy5sZWFybmluZ1N0YXRlKGdyYWRlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLlJldmlldzpcbiAgICAgICAgaXRlbSA9IHRoaXMucmV2aWV3U3RhdGUoZ3JhZGUpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIGl0ZW07XG4gIH1cbiAgYnVpbGRMb2cocmF0aW5nKSB7XG4gICAgY29uc3QgeyBsYXN0X3JldmlldywgZHVlLCBlbGFwc2VkX2RheXMgfSA9IHRoaXMubGFzdDtcbiAgICByZXR1cm4ge1xuICAgICAgcmF0aW5nLFxuICAgICAgc3RhdGU6IHRoaXMuY3VycmVudC5zdGF0ZSxcbiAgICAgIGR1ZTogbGFzdF9yZXZpZXcgfHwgZHVlLFxuICAgICAgc3RhYmlsaXR5OiB0aGlzLmN1cnJlbnQuc3RhYmlsaXR5LFxuICAgICAgZGlmZmljdWx0eTogdGhpcy5jdXJyZW50LmRpZmZpY3VsdHksXG4gICAgICBlbGFwc2VkX2RheXM6IHRoaXMuZWxhcHNlZF9kYXlzLFxuICAgICAgbGFzdF9lbGFwc2VkX2RheXM6IGVsYXBzZWRfZGF5cyxcbiAgICAgIHNjaGVkdWxlZF9kYXlzOiB0aGlzLmN1cnJlbnQuc2NoZWR1bGVkX2RheXMsXG4gICAgICBsZWFybmluZ19zdGVwczogdGhpcy5jdXJyZW50LmxlYXJuaW5nX3N0ZXBzLFxuICAgICAgcmV2aWV3OiB0aGlzLnJldmlld190aW1lXG4gICAgfTtcbiAgfVxufVxuXG5jbGFzcyBBbGVhIHtcbiAgYztcbiAgczA7XG4gIHMxO1xuICBzMjtcbiAgY29uc3RydWN0b3Ioc2VlZCkge1xuICAgIGNvbnN0IG1hc2ggPSBNYXNoKCk7XG4gICAgdGhpcy5jID0gMTtcbiAgICB0aGlzLnMwID0gbWFzaChcIiBcIik7XG4gICAgdGhpcy5zMSA9IG1hc2goXCIgXCIpO1xuICAgIHRoaXMuczIgPSBtYXNoKFwiIFwiKTtcbiAgICBpZiAoc2VlZCA9PSBudWxsKSBzZWVkID0gRGF0ZS5ub3coKTtcbiAgICB0aGlzLnMwIC09IG1hc2goc2VlZCk7XG4gICAgaWYgKHRoaXMuczAgPCAwKSB0aGlzLnMwICs9IDE7XG4gICAgdGhpcy5zMSAtPSBtYXNoKHNlZWQpO1xuICAgIGlmICh0aGlzLnMxIDwgMCkgdGhpcy5zMSArPSAxO1xuICAgIHRoaXMuczIgLT0gbWFzaChzZWVkKTtcbiAgICBpZiAodGhpcy5zMiA8IDApIHRoaXMuczIgKz0gMTtcbiAgfVxuICBuZXh0KCkge1xuICAgIGNvbnN0IHQgPSAyMDkxNjM5ICogdGhpcy5zMCArIHRoaXMuYyAqIDIzMjgzMDY0MzY1Mzg2OTYzZS0yNjtcbiAgICB0aGlzLnMwID0gdGhpcy5zMTtcbiAgICB0aGlzLnMxID0gdGhpcy5zMjtcbiAgICB0aGlzLmMgPSB0IHwgMDtcbiAgICB0aGlzLnMyID0gdCAtIHRoaXMuYztcbiAgICByZXR1cm4gdGhpcy5zMjtcbiAgfVxuICBzZXQgc3RhdGUoc3RhdGUpIHtcbiAgICB0aGlzLmMgPSBzdGF0ZS5jO1xuICAgIHRoaXMuczAgPSBzdGF0ZS5zMDtcbiAgICB0aGlzLnMxID0gc3RhdGUuczE7XG4gICAgdGhpcy5zMiA9IHN0YXRlLnMyO1xuICB9XG4gIGdldCBzdGF0ZSgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgYzogdGhpcy5jLFxuICAgICAgczA6IHRoaXMuczAsXG4gICAgICBzMTogdGhpcy5zMSxcbiAgICAgIHMyOiB0aGlzLnMyXG4gICAgfTtcbiAgfVxufVxuZnVuY3Rpb24gTWFzaCgpIHtcbiAgbGV0IG4gPSA0MDIyODcxMTk3O1xuICByZXR1cm4gZnVuY3Rpb24gbWFzaChkYXRhKSB7XG4gICAgZGF0YSA9IFN0cmluZyhkYXRhKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgIG4gKz0gZGF0YS5jaGFyQ29kZUF0KGkpO1xuICAgICAgbGV0IGggPSAwLjAyNTE5NjAzMjgyNDE2OTM4ICogbjtcbiAgICAgIG4gPSBoID4+PiAwO1xuICAgICAgaCAtPSBuO1xuICAgICAgaCAqPSBuO1xuICAgICAgbiA9IGggPj4+IDA7XG4gICAgICBoIC09IG47XG4gICAgICBuICs9IGggKiA0Mjk0OTY3Mjk2O1xuICAgIH1cbiAgICByZXR1cm4gKG4gPj4+IDApICogMjMyODMwNjQzNjUzODY5NjNlLTI2O1xuICB9O1xufVxuZnVuY3Rpb24gYWxlYShzZWVkKSB7XG4gIGNvbnN0IHhnID0gbmV3IEFsZWEoc2VlZCk7XG4gIGNvbnN0IHBybmcgPSAoKSA9PiB4Zy5uZXh0KCk7XG4gIHBybmcuaW50MzIgPSAoKSA9PiB4Zy5uZXh0KCkgKiA0Mjk0OTY3Mjk2IHwgMDtcbiAgcHJuZy5kb3VibGUgPSAoKSA9PiBwcm5nKCkgKyAocHJuZygpICogMjA5NzE1MiB8IDApICogMTExMDIyMzAyNDYyNTE1NjVlLTMyO1xuICBwcm5nLnN0YXRlID0gKCkgPT4geGcuc3RhdGU7XG4gIHBybmcuaW1wb3J0U3RhdGUgPSAoc3RhdGUpID0+IHtcbiAgICB4Zy5zdGF0ZSA9IHN0YXRlO1xuICAgIHJldHVybiBwcm5nO1xuICB9O1xuICByZXR1cm4gcHJuZztcbn1cblxuY29uc3QgdmVyc2lvbj1cIjUuNC4xXCI7XG5cbmNvbnN0IGRlZmF1bHRfcmVxdWVzdF9yZXRlbnRpb24gPSAwLjk7XG5jb25zdCBkZWZhdWx0X21heGltdW1faW50ZXJ2YWwgPSAzNjUwMDtcbmNvbnN0IGRlZmF1bHRfZW5hYmxlX2Z1enogPSBmYWxzZTtcbmNvbnN0IGRlZmF1bHRfZW5hYmxlX3Nob3J0X3Rlcm0gPSB0cnVlO1xuY29uc3QgZGVmYXVsdF9sZWFybmluZ19zdGVwcyA9IE9iamVjdC5mcmVlemUoW1xuICBcIjFtXCIsXG4gIFwiMTBtXCJcbl0pO1xuY29uc3QgZGVmYXVsdF9yZWxlYXJuaW5nX3N0ZXBzID0gT2JqZWN0LmZyZWV6ZShbXG4gIFwiMTBtXCJcbl0pO1xuY29uc3QgRlNSU1ZlcnNpb24gPSBgdiR7dmVyc2lvbn0gdXNpbmcgRlNSUy02LjBgO1xuY29uc3QgU19NSU4gPSAxZS0zO1xuY29uc3QgU19NQVggPSAzNjUwMDtcbmNvbnN0IElOSVRfU19NQVggPSAxMDA7XG5jb25zdCBGU1JTNV9ERUZBVUxUX0RFQ0FZID0gMC41O1xuY29uc3QgRlNSUzZfREVGQVVMVF9ERUNBWSA9IDAuMTU0MjtcbmNvbnN0IGRlZmF1bHRfdyA9IE9iamVjdC5mcmVlemUoW1xuICAwLjIxMixcbiAgMS4yOTMxLFxuICAyLjMwNjUsXG4gIDguMjk1NixcbiAgNi40MTMzLFxuICAwLjgzMzQsXG4gIDMuMDE5NCxcbiAgMWUtMyxcbiAgMS44NzIyLFxuICAwLjE2NjYsXG4gIDAuNzk2LFxuICAxLjQ4MzUsXG4gIDAuMDYxNCxcbiAgMC4yNjI5LFxuICAxLjY0ODMsXG4gIDAuNjAxNCxcbiAgMS44NzI5LFxuICAwLjU0MjUsXG4gIDAuMDkxMixcbiAgMC4wNjU4LFxuICBGU1JTNl9ERUZBVUxUX0RFQ0FZXG5dKTtcbmNvbnN0IFcxN19XMThfQ2VpbGluZyA9IDI7XG5jb25zdCBDTEFNUF9QQVJBTUVURVJTID0gKHcxN193MThfY2VpbGluZywgZW5hYmxlX3Nob3J0X3Rlcm0gPSBkZWZhdWx0X2VuYWJsZV9zaG9ydF90ZXJtKSA9PiBbXG4gIFtTX01JTiwgSU5JVF9TX01BWF0sXG4gIFtTX01JTiwgSU5JVF9TX01BWF0sXG4gIFtTX01JTiwgSU5JVF9TX01BWF0sXG4gIFtTX01JTiwgSU5JVF9TX01BWF0sXG4gIFsxLCAxMF0sXG4gIFsxZS0zLCA0XSxcbiAgWzFlLTMsIDRdLFxuICBbMWUtMywgMC43NV0sXG4gIFswLCA0LjVdLFxuICBbMCwgMC44XSxcbiAgWzFlLTMsIDMuNV0sXG4gIFsxZS0zLCA1XSxcbiAgWzFlLTMsIDAuMjVdLFxuICBbMWUtMywgMC45XSxcbiAgWzAsIDRdLFxuICBbMCwgMV0sXG4gIFsxLCA2XSxcbiAgWzAsIHcxN193MThfY2VpbGluZ10sXG4gIFswLCB3MTdfdzE4X2NlaWxpbmddLFxuICBbXG4gICAgZW5hYmxlX3Nob3J0X3Rlcm0gPyAwLjAxIDogMCxcbiAgICAwLjhcbiAgXSxcbiAgWzAuMSwgMC44XVxuXTtcblxuY29uc3QgY2xpcFBhcmFtZXRlcnMgPSAocGFyYW1ldGVycywgbnVtUmVsZWFybmluZ1N0ZXBzLCBlbmFibGVTaG9ydFRlcm0gPSBkZWZhdWx0X2VuYWJsZV9zaG9ydF90ZXJtKSA9PiB7XG4gIGNvbnN0IGNsaXAgPSBDTEFNUF9QQVJBTUVURVJTKFcxN19XMThfQ2VpbGluZywgZW5hYmxlU2hvcnRUZXJtKS5zbGljZShcbiAgICAwLFxuICAgIHBhcmFtZXRlcnMubGVuZ3RoXG4gICk7XG4gIGlmIChNYXRoLm1heCgwLCBudW1SZWxlYXJuaW5nU3RlcHMpID4gMSkge1xuICAgIGNvbnN0IHcxMSA9IGNsYW1wKHBhcmFtZXRlcnNbMTFdIHx8IDAsIGNsaXBbMTFdWzBdLCBjbGlwWzExXVsxXSk7XG4gICAgY29uc3QgdzEzID0gY2xhbXAocGFyYW1ldGVyc1sxM10gfHwgMCwgY2xpcFsxM11bMF0sIGNsaXBbMTNdWzFdKTtcbiAgICBjb25zdCB3MTQgPSBjbGFtcChwYXJhbWV0ZXJzWzE0XSB8fCAwLCBjbGlwWzE0XVswXSwgY2xpcFsxNF1bMV0pO1xuICAgIGNvbnN0IHZhbHVlID0gLShNYXRoLmxvZyh3MTEpICsgTWF0aC5sb2coTWF0aC5wb3coMiwgdzEzKSAtIDEpICsgdzE0ICogMC4zKSAvIG51bVJlbGVhcm5pbmdTdGVwcztcbiAgICBjb25zdCB3MTdfdzE4X2NlaWxpbmcgPSBjbGFtcChcbiAgICAgIHJvdW5kVG8oTWF0aC5zcXJ0KE1hdGgubWF4KHZhbHVlLCAwKSksIDgpLFxuICAgICAgMC4wMSxcbiAgICAgIFcxN19XMThfQ2VpbGluZ1xuICAgICk7XG4gICAgaWYgKGNsaXBbMTddKSBjbGlwWzE3XSA9IFtjbGlwWzE3XVswXSwgdzE3X3cxOF9jZWlsaW5nXTtcbiAgICBpZiAoY2xpcFsxOF0pIGNsaXBbMThdID0gW2NsaXBbMThdWzBdLCB3MTdfdzE4X2NlaWxpbmddO1xuICB9XG4gIHJldHVybiBjbGlwLm1hcChcbiAgICAoW21pbiwgbWF4XSwgaW5kZXgpID0+IGNsYW1wKHBhcmFtZXRlcnNbaW5kZXhdIHx8IDAsIG1pbiwgbWF4KVxuICApO1xufTtcbmNvbnN0IGNoZWNrUGFyYW1ldGVycyA9IChwYXJhbWV0ZXJzKSA9PiB7XG4gIGNvbnN0IGludmFsaWQgPSBwYXJhbWV0ZXJzLmZpbmQoKHBhcmFtKSA9PiAhTnVtYmVyLmlzRmluaXRlKHBhcmFtKSk7XG4gIGlmIChpbnZhbGlkICE9PSB2b2lkIDApIHtcbiAgICB0aHJvdyBuZXcgRlNSU1ZhbGlkYXRpb25FcnJvcihcbiAgICAgIGBOb24tZmluaXRlIG9yIE5hTiB2YWx1ZSBpbiBwYXJhbWV0ZXJzICR7cGFyYW1ldGVyc31gXG4gICAgKTtcbiAgfSBlbHNlIGlmICghWzE3LCAxOSwgMjFdLmluY2x1ZGVzKHBhcmFtZXRlcnMubGVuZ3RoKSkge1xuICAgIHRocm93IG5ldyBGU1JTVmFsaWRhdGlvbkVycm9yKFxuICAgICAgYEludmFsaWQgcGFyYW1ldGVyIGxlbmd0aDogJHtwYXJhbWV0ZXJzLmxlbmd0aH0uIE11c3QgYmUgMTcsIDE5IG9yIDIxIGZvciBGU1JTdjQsIDUgYW5kIDYgcmVzcGVjdGl2ZWx5LmBcbiAgICApO1xuICB9XG4gIHJldHVybiBwYXJhbWV0ZXJzO1xufTtcbmNvbnN0IG1pZ3JhdGVQYXJhbWV0ZXJzID0gKHBhcmFtZXRlcnMsIG51bVJlbGVhcm5pbmdTdGVwcyA9IDAsIGVuYWJsZVNob3J0VGVybSA9IGRlZmF1bHRfZW5hYmxlX3Nob3J0X3Rlcm0pID0+IHtcbiAgaWYgKHBhcmFtZXRlcnMgPT09IHZvaWQgMCkge1xuICAgIHJldHVybiBbLi4uZGVmYXVsdF93XTtcbiAgfVxuICBzd2l0Y2ggKHBhcmFtZXRlcnMubGVuZ3RoKSB7XG4gICAgY2FzZSAyMTpcbiAgICAgIHJldHVybiBjbGlwUGFyYW1ldGVycyhcbiAgICAgICAgQXJyYXkuZnJvbShwYXJhbWV0ZXJzKSxcbiAgICAgICAgbnVtUmVsZWFybmluZ1N0ZXBzLFxuICAgICAgICBlbmFibGVTaG9ydFRlcm1cbiAgICAgICk7XG4gICAgY2FzZSAxOTpcbiAgICAgIGNvbnNvbGUuZGVidWcoXCJbRlNSUy02XWF1dG8gZmlsbCB3IGZyb20gMTkgdG8gMjEgbGVuZ3RoXCIpO1xuICAgICAgcmV0dXJuIGNsaXBQYXJhbWV0ZXJzKFxuICAgICAgICBBcnJheS5mcm9tKHBhcmFtZXRlcnMpLFxuICAgICAgICBudW1SZWxlYXJuaW5nU3RlcHMsXG4gICAgICAgIGVuYWJsZVNob3J0VGVybVxuICAgICAgKS5jb25jYXQoWzAsIEZTUlM1X0RFRkFVTFRfREVDQVldKTtcbiAgICBjYXNlIDE3OiB7XG4gICAgICBjb25zdCB3ID0gY2xpcFBhcmFtZXRlcnMoXG4gICAgICAgIEFycmF5LmZyb20ocGFyYW1ldGVycyksXG4gICAgICAgIG51bVJlbGVhcm5pbmdTdGVwcyxcbiAgICAgICAgZW5hYmxlU2hvcnRUZXJtXG4gICAgICApO1xuICAgICAgd1s0XSA9ICsod1s1XSAqIDIgKyB3WzRdKS50b0ZpeGVkKDgpO1xuICAgICAgd1s1XSA9ICsoTWF0aC5sb2cod1s1XSAqIDMgKyAxKSAvIDMpLnRvRml4ZWQoOCk7XG4gICAgICB3WzZdID0gKyh3WzZdICsgMC41KS50b0ZpeGVkKDgpO1xuICAgICAgY29uc29sZS5kZWJ1ZyhcIltGU1JTLTZdYXV0byBmaWxsIHcgZnJvbSAxNyB0byAyMSBsZW5ndGhcIik7XG4gICAgICByZXR1cm4gdy5jb25jYXQoWzAsIDAsIDAsIEZTUlM1X0RFRkFVTFRfREVDQVldKTtcbiAgICB9XG4gICAgZGVmYXVsdDpcbiAgICAgIGNvbnNvbGUud2FybihcIltGU1JTXUludmFsaWQgcGFyYW1ldGVycyBsZW5ndGgsIHVzaW5nIGRlZmF1bHQgcGFyYW1ldGVyc1wiKTtcbiAgICAgIHJldHVybiBbLi4uZGVmYXVsdF93XTtcbiAgfVxufTtcbmNvbnN0IGdlbmVyYXRvclBhcmFtZXRlcnMgPSAocHJvcHMpID0+IHtcbiAgY29uc3QgbGVhcm5pbmdfc3RlcHMgPSBBcnJheS5pc0FycmF5KHByb3BzPy5sZWFybmluZ19zdGVwcykgPyBwcm9wcy5sZWFybmluZ19zdGVwcyA6IGRlZmF1bHRfbGVhcm5pbmdfc3RlcHM7XG4gIGNvbnN0IHJlbGVhcm5pbmdfc3RlcHMgPSBBcnJheS5pc0FycmF5KHByb3BzPy5yZWxlYXJuaW5nX3N0ZXBzKSA/IHByb3BzLnJlbGVhcm5pbmdfc3RlcHMgOiBkZWZhdWx0X3JlbGVhcm5pbmdfc3RlcHM7XG4gIGNvbnN0IGVuYWJsZV9zaG9ydF90ZXJtID0gcHJvcHM/LmVuYWJsZV9zaG9ydF90ZXJtID8/IGRlZmF1bHRfZW5hYmxlX3Nob3J0X3Rlcm07XG4gIGNvbnN0IHcgPSBtaWdyYXRlUGFyYW1ldGVycyhcbiAgICBwcm9wcz8udyxcbiAgICByZWxlYXJuaW5nX3N0ZXBzLmxlbmd0aCxcbiAgICBlbmFibGVfc2hvcnRfdGVybVxuICApO1xuICByZXR1cm4ge1xuICAgIHJlcXVlc3RfcmV0ZW50aW9uOiBwcm9wcz8ucmVxdWVzdF9yZXRlbnRpb24gfHwgZGVmYXVsdF9yZXF1ZXN0X3JldGVudGlvbixcbiAgICBtYXhpbXVtX2ludGVydmFsOiBwcm9wcz8ubWF4aW11bV9pbnRlcnZhbCB8fCBkZWZhdWx0X21heGltdW1faW50ZXJ2YWwsXG4gICAgdyxcbiAgICBlbmFibGVfZnV6ejogcHJvcHM/LmVuYWJsZV9mdXp6ID8/IGRlZmF1bHRfZW5hYmxlX2Z1enosXG4gICAgZW5hYmxlX3Nob3J0X3Rlcm0sXG4gICAgbGVhcm5pbmdfc3RlcHMsXG4gICAgcmVsZWFybmluZ19zdGVwc1xuICB9O1xufTtcbmZ1bmN0aW9uIGNyZWF0ZUVtcHR5Q2FyZChub3csIGFmdGVySGFuZGxlcikge1xuICBjb25zdCBlbXB0eUNhcmQgPSB7XG4gICAgZHVlOiBub3cgPyBUeXBlQ29udmVydC50aW1lKG5vdykgOiAvKiBAX19QVVJFX18gKi8gbmV3IERhdGUoKSxcbiAgICBzdGFiaWxpdHk6IDAsXG4gICAgZGlmZmljdWx0eTogMCxcbiAgICBlbGFwc2VkX2RheXM6IDAsXG4gICAgc2NoZWR1bGVkX2RheXM6IDAsXG4gICAgcmVwczogMCxcbiAgICBsYXBzZXM6IDAsXG4gICAgbGVhcm5pbmdfc3RlcHM6IDAsXG4gICAgc3RhdGU6IFN0YXRlLk5ldyxcbiAgICBsYXN0X3Jldmlldzogdm9pZCAwXG4gIH07XG4gIGlmIChhZnRlckhhbmRsZXIgJiYgdHlwZW9mIGFmdGVySGFuZGxlciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgcmV0dXJuIGFmdGVySGFuZGxlcihlbXB0eUNhcmQpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBlbXB0eUNhcmQ7XG4gIH1cbn1cblxuY29uc3QgY29tcHV0ZURlY2F5RmFjdG9yID0gKGRlY2F5T3JQYXJhbXMpID0+IHtcbiAgY29uc3QgZGVjYXkgPSB0eXBlb2YgZGVjYXlPclBhcmFtcyA9PT0gXCJudW1iZXJcIiA/IC1kZWNheU9yUGFyYW1zIDogLWRlY2F5T3JQYXJhbXNbMjBdO1xuICBjb25zdCBmYWN0b3IgPSBNYXRoLmV4cChNYXRoLnBvdyhkZWNheSwgLTEpICogTWF0aC5sb2coMC45KSkgLSAxO1xuICByZXR1cm4geyBkZWNheSwgZmFjdG9yOiByb3VuZFRvKGZhY3RvciwgOCkgfTtcbn07XG5mdW5jdGlvbiBmb3JnZXR0aW5nX2N1cnZlKGRlY2F5T3JQYXJhbXMsIGVsYXBzZWRfZGF5cywgc3RhYmlsaXR5KSB7XG4gIGNvbnN0IHsgZGVjYXksIGZhY3RvciB9ID0gY29tcHV0ZURlY2F5RmFjdG9yKGRlY2F5T3JQYXJhbXMpO1xuICByZXR1cm4gcm91bmRUbyhNYXRoLnBvdygxICsgZmFjdG9yICogZWxhcHNlZF9kYXlzIC8gc3RhYmlsaXR5LCBkZWNheSksIDgpO1xufVxuY2xhc3MgRlNSU0FsZ29yaXRobSB7XG4gIHBhcmFtO1xuICBpbnRlcnZhbE1vZGlmaWVyO1xuICBfc2VlZDtcbiAgY29uc3RydWN0b3IocGFyYW1zKSB7XG4gICAgdGhpcy5wYXJhbSA9IG5ldyBQcm94eShcbiAgICAgIGdlbmVyYXRvclBhcmFtZXRlcnMocGFyYW1zKSxcbiAgICAgIHRoaXMucGFyYW1zX2hhbmRsZXJfcHJveHkoKVxuICAgICk7XG4gICAgdGhpcy5pbnRlcnZhbE1vZGlmaWVyID0gdGhpcy5jYWxjdWxhdGVfaW50ZXJ2YWxfbW9kaWZpZXIoXG4gICAgICB0aGlzLnBhcmFtLnJlcXVlc3RfcmV0ZW50aW9uXG4gICAgKTtcbiAgICB0aGlzLmZvcmdldHRpbmdfY3VydmUgPSBmb3JnZXR0aW5nX2N1cnZlLmJpbmQodGhpcywgdGhpcy5wYXJhbS53KTtcbiAgfVxuICBnZXQgaW50ZXJ2YWxfbW9kaWZpZXIoKSB7XG4gICAgcmV0dXJuIHRoaXMuaW50ZXJ2YWxNb2RpZmllcjtcbiAgfVxuICBzZXQgc2VlZChzZWVkKSB7XG4gICAgdGhpcy5fc2VlZCA9IHNlZWQ7XG4gIH1cbiAgLyoqXG4gICAqIEBzZWUgaHR0cHM6Ly9naXRodWIuY29tL29wZW4tc3BhY2VkLXJlcGV0aXRpb24vZnNyczRhbmtpL3dpa2kvVGhlLUFsZ29yaXRobSNmc3JzLTVcbiAgICpcbiAgICogVGhlIGZvcm11bGEgdXNlZCBpczogJCRJKHIscykgPSAocl57XFxmcmFjezF9e0RFQ0FZfX0gLSAxKSAvIEZBQ1RPUiBcXHRpbWVzIHMkJFxuICAgKiBAcGFyYW0gcmVxdWVzdF9yZXRlbnRpb24gMDxyZXF1ZXN0X3JldGVudGlvbjw9MSxSZXF1ZXN0ZWQgcmV0ZW50aW9uIHJhdGVcbiAgICogQHRocm93cyB7RXJyb3J9IFJlcXVlc3RlZCByZXRlbnRpb24gcmF0ZSBzaG91bGQgYmUgaW4gdGhlIHJhbmdlICgwLDFdXG4gICAqL1xuICBjYWxjdWxhdGVfaW50ZXJ2YWxfbW9kaWZpZXIocmVxdWVzdF9yZXRlbnRpb24pIHtcbiAgICBpZiAocmVxdWVzdF9yZXRlbnRpb24gPD0gMCB8fCByZXF1ZXN0X3JldGVudGlvbiA+IDEpIHtcbiAgICAgIHRocm93IG5ldyBGU1JTVmFsaWRhdGlvbkVycm9yKFxuICAgICAgICBcIlJlcXVlc3RlZCByZXRlbnRpb24gcmF0ZSBzaG91bGQgYmUgaW4gdGhlIHJhbmdlICgwLDFdXCJcbiAgICAgICk7XG4gICAgfVxuICAgIGNvbnN0IHsgZGVjYXksIGZhY3RvciB9ID0gY29tcHV0ZURlY2F5RmFjdG9yKHRoaXMucGFyYW0udyk7XG4gICAgcmV0dXJuIHJvdW5kVG8oKE1hdGgucG93KHJlcXVlc3RfcmV0ZW50aW9uLCAxIC8gZGVjYXkpIC0gMSkgLyBmYWN0b3IsIDgpO1xuICB9XG4gIC8qKlxuICAgKiBHZXQgdGhlIHBhcmFtZXRlcnMgb2YgdGhlIGFsZ29yaXRobS5cbiAgICovXG4gIGdldCBwYXJhbWV0ZXJzKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmFtO1xuICB9XG4gIC8qKlxuICAgKiBTZXQgdGhlIHBhcmFtZXRlcnMgb2YgdGhlIGFsZ29yaXRobS5cbiAgICogQHBhcmFtIHBhcmFtcyBQYXJ0aWFsPEZTUlNQYXJhbWV0ZXJzPlxuICAgKi9cbiAgc2V0IHBhcmFtZXRlcnMocGFyYW1zKSB7XG4gICAgdGhpcy51cGRhdGVfcGFyYW1ldGVycyhwYXJhbXMpO1xuICB9XG4gIHBhcmFtc19oYW5kbGVyX3Byb3h5KCkge1xuICAgIGNvbnN0IF90aGlzID0gdGhpcztcbiAgICByZXR1cm4ge1xuICAgICAgc2V0OiBmdW5jdGlvbih0YXJnZXQsIHByb3AsIHZhbHVlKSB7XG4gICAgICAgIGlmIChwcm9wID09PSBcInJlcXVlc3RfcmV0ZW50aW9uXCIgJiYgTnVtYmVyLmlzRmluaXRlKHZhbHVlKSkge1xuICAgICAgICAgIF90aGlzLmludGVydmFsTW9kaWZpZXIgPSBfdGhpcy5jYWxjdWxhdGVfaW50ZXJ2YWxfbW9kaWZpZXIoXG4gICAgICAgICAgICBOdW1iZXIodmFsdWUpXG4gICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIGlmIChwcm9wID09PSBcIndcIikge1xuICAgICAgICAgIHZhbHVlID0gbWlncmF0ZVBhcmFtZXRlcnMoXG4gICAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgICAgIHRhcmdldC5yZWxlYXJuaW5nX3N0ZXBzLmxlbmd0aCxcbiAgICAgICAgICAgIHRhcmdldC5lbmFibGVfc2hvcnRfdGVybVxuICAgICAgICAgICk7XG4gICAgICAgICAgX3RoaXMuZm9yZ2V0dGluZ19jdXJ2ZSA9IGZvcmdldHRpbmdfY3VydmUuYmluZCh0aGlzLCB2YWx1ZSk7XG4gICAgICAgICAgX3RoaXMuaW50ZXJ2YWxNb2RpZmllciA9IF90aGlzLmNhbGN1bGF0ZV9pbnRlcnZhbF9tb2RpZmllcihcbiAgICAgICAgICAgIE51bWJlcih0YXJnZXQucmVxdWVzdF9yZXRlbnRpb24pXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICBSZWZsZWN0LnNldCh0YXJnZXQsIHByb3AsIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuICB1cGRhdGVfcGFyYW1ldGVycyhwYXJhbXMpIHtcbiAgICBjb25zdCBfcGFyYW1zID0gZ2VuZXJhdG9yUGFyYW1ldGVycyhwYXJhbXMpO1xuICAgIGZvciAoY29uc3Qga2V5IGluIF9wYXJhbXMpIHtcbiAgICAgIGNvbnN0IHBhcmFtS2V5ID0ga2V5O1xuICAgICAgdGhpcy5wYXJhbVtwYXJhbUtleV0gPSBfcGFyYW1zW3BhcmFtS2V5XTtcbiAgICB9XG4gIH1cbiAgLyoqXG4gICAgICogVGhlIGZvcm11bGEgdXNlZCBpcyA6XG4gICAgICogJCQgU18wKEcpID0gd197Ry0xfSQkXG4gICAgICogJCRTXzAgPSBcXG1heCBcXGxicmFjZSBTXzAsMC4xXFxyYnJhY2UgJCRcbiAgXG4gICAgICogQHBhcmFtIGcgR3JhZGUgKHJhdGluZyBhdCBBbmtpKSBbMS5hZ2FpbiwyLmhhcmQsMy5nb29kLDQuZWFzeV1cbiAgICAgKiBAcmV0dXJuIFN0YWJpbGl0eSAoaW50ZXJ2YWwgd2hlbiBSPTkwJSlcbiAgICAgKi9cbiAgaW5pdF9zdGFiaWxpdHkoZykge1xuICAgIHJldHVybiBNYXRoLm1heCh0aGlzLnBhcmFtLndbZyAtIDFdLCAwLjEpO1xuICB9XG4gIC8qKlxuICAgKiBUaGUgZm9ybXVsYSB1c2VkIGlzIDpcbiAgICogJCREXzAoRykgPSB3XzQgLSBlXnsoRy0xKSBcXGNkb3Qgd181fSArIDEgJCRcbiAgICogJCREXzAgPSBcXG1pbiBcXGxicmFjZSBcXG1heCBcXGxicmFjZSBEXzAoRyksMSBcXHJicmFjZSwxMCBcXHJicmFjZSQkXG4gICAqIHdoZXJlIHRoZSAkJERfMCgxKT13XzQkJCB3aGVuIHRoZSBmaXJzdCByYXRpbmcgaXMgZ29vZC5cbiAgICpcbiAgICogQHBhcmFtIHtHcmFkZX0gZyBHcmFkZSAocmF0aW5nIGF0IEFua2kpIFsxLmFnYWluLDIuaGFyZCwzLmdvb2QsNC5lYXN5XVxuICAgKiBAcmV0dXJuIHtudW1iZXJ9IERpZmZpY3VsdHkgJCREIFxcaW4gWzEsMTBdJCRcbiAgICovXG4gIGluaXRfZGlmZmljdWx0eShnKSB7XG4gICAgY29uc3QgdyA9IHRoaXMucGFyYW0udztcbiAgICBjb25zdCBkID0gd1s0XSAtIE1hdGguZXhwKChnIC0gMSkgKiB3WzVdKSArIDE7XG4gICAgcmV0dXJuIHJvdW5kVG8oZCwgOCk7XG4gIH1cbiAgLyoqXG4gICAqIElmIGZ1enppbmcgaXMgZGlzYWJsZWQgb3IgaXZsIGlzIGxlc3MgdGhhbiAyLjUsIGl0IHJldHVybnMgdGhlIG9yaWdpbmFsIGludGVydmFsLlxuICAgKiBAcGFyYW0ge251bWJlcn0gaXZsIC0gVGhlIGludGVydmFsIHRvIGJlIGZ1enplZC5cbiAgICogQHBhcmFtIHtudW1iZXJ9IGVsYXBzZWRfZGF5cyB0IGRheXMgc2luY2UgdGhlIGxhc3QgcmV2aWV3XG4gICAqIEByZXR1cm4ge251bWJlcn0gLSBUaGUgZnV6emVkIGludGVydmFsLlxuICAgKiovXG4gIGFwcGx5X2Z1enooaXZsLCBlbGFwc2VkX2RheXMpIHtcbiAgICBpZiAoIXRoaXMucGFyYW0uZW5hYmxlX2Z1enogfHwgaXZsIDwgMi41KSByZXR1cm4gTWF0aC5yb3VuZChpdmwpO1xuICAgIGNvbnN0IGdlbmVyYXRvciA9IGFsZWEodGhpcy5fc2VlZCk7XG4gICAgY29uc3QgZnV6el9mYWN0b3IgPSBnZW5lcmF0b3IoKTtcbiAgICBjb25zdCB7IG1pbl9pdmwsIG1heF9pdmwgfSA9IGdldF9mdXp6X3JhbmdlKFxuICAgICAgaXZsLFxuICAgICAgZWxhcHNlZF9kYXlzLFxuICAgICAgdGhpcy5wYXJhbS5tYXhpbXVtX2ludGVydmFsXG4gICAgKTtcbiAgICByZXR1cm4gTWF0aC5mbG9vcihmdXp6X2ZhY3RvciAqIChtYXhfaXZsIC0gbWluX2l2bCArIDEpICsgbWluX2l2bCk7XG4gIH1cbiAgLyoqXG4gICAqICAgQHNlZSBUaGUgZm9ybXVsYSB1c2VkIGlzIDoge0BsaW5rIEZTUlNBbGdvcml0aG0uY2FsY3VsYXRlX2ludGVydmFsX21vZGlmaWVyfVxuICAgKiAgIEBwYXJhbSB7bnVtYmVyfSBzIC0gU3RhYmlsaXR5IChpbnRlcnZhbCB3aGVuIFI9OTAlKVxuICAgKiAgIEBwYXJhbSB7bnVtYmVyfSBlbGFwc2VkX2RheXMgdCBkYXlzIHNpbmNlIHRoZSBsYXN0IHJldmlld1xuICAgKi9cbiAgbmV4dF9pbnRlcnZhbChzLCBlbGFwc2VkX2RheXMpIHtcbiAgICBjb25zdCBuZXdJbnRlcnZhbCA9IE1hdGgubWluKFxuICAgICAgTWF0aC5tYXgoMSwgTWF0aC5yb3VuZChzICogdGhpcy5pbnRlcnZhbE1vZGlmaWVyKSksXG4gICAgICB0aGlzLnBhcmFtLm1heGltdW1faW50ZXJ2YWxcbiAgICApO1xuICAgIHJldHVybiB0aGlzLmFwcGx5X2Z1enoobmV3SW50ZXJ2YWwsIGVsYXBzZWRfZGF5cyk7XG4gIH1cbiAgLyoqXG4gICAqIEBzZWUgaHR0cHM6Ly9naXRodWIuY29tL29wZW4tc3BhY2VkLXJlcGV0aXRpb24vZnNyczRhbmtpL2lzc3Vlcy82OTdcbiAgICovXG4gIGxpbmVhcl9kYW1waW5nKGRlbHRhX2QsIG9sZF9kKSB7XG4gICAgcmV0dXJuIHJvdW5kVG8oZGVsdGFfZCAqICgxMCAtIG9sZF9kKSAvIDksIDgpO1xuICB9XG4gIC8qKlxuICAgKiBUaGUgZm9ybXVsYSB1c2VkIGlzIDpcbiAgICogJCRcXHRleHR7ZGVsdGF9X2QgPSAtd182IFxcY2RvdCAoZyAtIDMpJCRcbiAgICogJCRcXHRleHR7bmV4dH1fZCA9IEQgKyBcXHRleHR7bGluZWFyIGRhbXBpbmd9KFxcdGV4dHtkZWx0YX1fZCAsIEQpJCRcbiAgICogJCREXlxccHJpbWUoRCxSKSA9IHdfNyBcXGNkb3QgRF8wKDQpICsoMSAtIHdfNykgXFxjZG90IFxcdGV4dHtuZXh0fV9kJCRcbiAgICogQHBhcmFtIHtudW1iZXJ9IGQgRGlmZmljdWx0eSAkJEQgXFxpbiBbMSwxMF0kJFxuICAgKiBAcGFyYW0ge0dyYWRlfSBnIEdyYWRlIChyYXRpbmcgYXQgQW5raSkgWzEuYWdhaW4sMi5oYXJkLDMuZ29vZCw0LmVhc3ldXG4gICAqIEByZXR1cm4ge251bWJlcn0gJCRcXHRleHR7bmV4dH1fRCQkXG4gICAqL1xuICBuZXh0X2RpZmZpY3VsdHkoZCwgZykge1xuICAgIGNvbnN0IGRlbHRhX2QgPSAtdGhpcy5wYXJhbS53WzZdICogKGcgLSAzKTtcbiAgICBjb25zdCBuZXh0X2QgPSBkICsgdGhpcy5saW5lYXJfZGFtcGluZyhkZWx0YV9kLCBkKTtcbiAgICByZXR1cm4gY2xhbXAoXG4gICAgICB0aGlzLm1lYW5fcmV2ZXJzaW9uKHRoaXMuaW5pdF9kaWZmaWN1bHR5KFJhdGluZy5FYXN5KSwgbmV4dF9kKSxcbiAgICAgIDEsXG4gICAgICAxMFxuICAgICk7XG4gIH1cbiAgLyoqXG4gICAqIFRoZSBmb3JtdWxhIHVzZWQgaXMgOlxuICAgKiAkJHdfNyBcXGNkb3QgXFx0ZXh0e2luaXR9ICsoMSAtIHdfNykgXFxjZG90IFxcdGV4dHtjdXJyZW50fSQkXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBpbml0ICQkd18yIDogRF8wKDMpID0gd18yICsgKFItMikgXFxjZG90IHdfMz0gd18yJCRcbiAgICogQHBhcmFtIHtudW1iZXJ9IGN1cnJlbnQgJCREIC0gd182IFxcY2RvdCAoUiAtIDIpJCRcbiAgICogQHJldHVybiB7bnVtYmVyfSBkaWZmaWN1bHR5XG4gICAqL1xuICBtZWFuX3JldmVyc2lvbihpbml0LCBjdXJyZW50KSB7XG4gICAgY29uc3QgdyA9IHRoaXMucGFyYW0udztcbiAgICByZXR1cm4gcm91bmRUbyh3WzddICogaW5pdCArICgxIC0gd1s3XSkgKiBjdXJyZW50LCA4KTtcbiAgfVxuICAvKipcbiAgICogVGhlIGZvcm11bGEgdXNlZCBpcyA6XG4gICAqICQkU15cXHByaW1lX3IoRCxTLFIsRykgPSBTXFxjZG90KGVee3dfOH1cXGNkb3QgKDExLUQpXFxjZG90IFNeey13Xzl9XFxjZG90KGVee3dfezEwfVxcY2RvdCgxLVIpfS0xKVxcY2RvdCB3X3sxNX0oXFx0ZXh0e2lmfSBHPTIpIFxcY2RvdCB3X3sxNn0oXFx0ZXh0e2lmfSBHPTQpKzEpJCRcbiAgICogQHBhcmFtIHtudW1iZXJ9IGQgRGlmZmljdWx0eSBEIFxcaW4gWzEsMTBdXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBzIFN0YWJpbGl0eSAoaW50ZXJ2YWwgd2hlbiBSPTkwJSlcbiAgICogQHBhcmFtIHtudW1iZXJ9IHIgUmV0cmlldmFiaWxpdHkgKHByb2JhYmlsaXR5IG9mIHJlY2FsbClcbiAgICogQHBhcmFtIHtHcmFkZX0gZyBHcmFkZSAoUmF0aW5nWzAuYWdhaW4sMS5oYXJkLDIuZ29vZCwzLmVhc3ldKVxuICAgKiBAcmV0dXJuIHtudW1iZXJ9IFNeXFxwcmltZV9yIG5ldyBzdGFiaWxpdHkgYWZ0ZXIgcmVjYWxsXG4gICAqL1xuICBuZXh0X3JlY2FsbF9zdGFiaWxpdHkoZCwgcywgciwgZykge1xuICAgIGNvbnN0IHcgPSB0aGlzLnBhcmFtLnc7XG4gICAgY29uc3QgaGFyZF9wZW5hbHR5ID0gUmF0aW5nLkhhcmQgPT09IGcgPyB3WzE1XSA6IDE7XG4gICAgY29uc3QgZWFzeV9ib3VuZCA9IFJhdGluZy5FYXN5ID09PSBnID8gd1sxNl0gOiAxO1xuICAgIHJldHVybiByb3VuZFRvKFxuICAgICAgY2xhbXAoXG4gICAgICAgIHMgKiAoMSArIE1hdGguZXhwKHdbOF0pICogKDExIC0gZCkgKiBNYXRoLnBvdyhzLCAtd1s5XSkgKiAoTWF0aC5leHAoKDEgLSByKSAqIHdbMTBdKSAtIDEpICogaGFyZF9wZW5hbHR5ICogZWFzeV9ib3VuZCksXG4gICAgICAgIFNfTUlOLFxuICAgICAgICAzNjUwMFxuICAgICAgKSxcbiAgICAgIDhcbiAgICApO1xuICB9XG4gIC8qKlxuICAgKiBUaGUgZm9ybXVsYSB1c2VkIGlzIDpcbiAgICogJCRTXlxccHJpbWVfZihELFMsUikgPSB3X3sxMX1cXGNkb3QgRF57LXdfezEyfX1cXGNkb3QgKChTKzEpXnt3X3sxM319LTEpIFxcY2RvdCBlXnt3X3sxNH1cXGNkb3QoMS1SKX0kJFxuICAgKiBlbmFibGVfc2hvcnRfdGVybSA9IHRydWUgOiAkJFNeXFxwcmltZV9mIFxcaW4gXFxtaW4gXFxsYnJhY2UgXFxtYXggXFxsYnJhY2UgU15cXHByaW1lX2YsMC4wMVxccmJyYWNlLCBcXGZyYWN7U317ZV57d197MTd9IFxcY2RvdCB3X3sxOH19fSBcXHJicmFjZSQkXG4gICAqIGVuYWJsZV9zaG9ydF90ZXJtID0gZmFsc2UgOiAkJFNeXFxwcmltZV9mIFxcaW4gXFxtaW4gXFxsYnJhY2UgXFxtYXggXFxsYnJhY2UgU15cXHByaW1lX2YsMC4wMVxccmJyYWNlLCBTIFxccmJyYWNlJCRcbiAgICogQHBhcmFtIHtudW1iZXJ9IGQgRGlmZmljdWx0eSBEIFxcaW4gWzEsMTBdXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBzIFN0YWJpbGl0eSAoaW50ZXJ2YWwgd2hlbiBSPTkwJSlcbiAgICogQHBhcmFtIHtudW1iZXJ9IHIgUmV0cmlldmFiaWxpdHkgKHByb2JhYmlsaXR5IG9mIHJlY2FsbClcbiAgICogQHJldHVybiB7bnVtYmVyfSBTXlxccHJpbWVfZiBuZXcgc3RhYmlsaXR5IGFmdGVyIGZvcmdldHRpbmdcbiAgICovXG4gIG5leHRfZm9yZ2V0X3N0YWJpbGl0eShkLCBzLCByKSB7XG4gICAgY29uc3QgdyA9IHRoaXMucGFyYW0udztcbiAgICByZXR1cm4gcm91bmRUbyhcbiAgICAgIGNsYW1wKFxuICAgICAgICB3WzExXSAqIE1hdGgucG93KGQsIC13WzEyXSkgKiAoTWF0aC5wb3cocyArIDEsIHdbMTNdKSAtIDEpICogTWF0aC5leHAoKDEgLSByKSAqIHdbMTRdKSxcbiAgICAgICAgU19NSU4sXG4gICAgICAgIDM2NTAwXG4gICAgICApLFxuICAgICAgOFxuICAgICk7XG4gIH1cbiAgLyoqXG4gICAqIFRoZSBmb3JtdWxhIHVzZWQgaXMgOlxuICAgKiAkJFNeXFxwcmltZV9zKFMsRykgPSBTIFxcY2RvdCBlXnt3X3sxN30gXFxjZG90IChHLTMrd197MTh9KX0kJFxuICAgKiBAcGFyYW0ge251bWJlcn0gcyBTdGFiaWxpdHkgKGludGVydmFsIHdoZW4gUj05MCUpXG4gICAqIEBwYXJhbSB7R3JhZGV9IGcgR3JhZGUgKFJhdGluZ1swLmFnYWluLDEuaGFyZCwyLmdvb2QsMy5lYXN5XSlcbiAgICovXG4gIG5leHRfc2hvcnRfdGVybV9zdGFiaWxpdHkocywgZykge1xuICAgIGNvbnN0IHcgPSB0aGlzLnBhcmFtLnc7XG4gICAgY29uc3Qgc2luYyA9IE1hdGgucG93KHMsIC13WzE5XSkgKiBNYXRoLmV4cCh3WzE3XSAqIChnIC0gMyArIHdbMThdKSk7XG4gICAgY29uc3QgbWFza2VkU2luYyA9IGcgPj0gUmF0aW5nLkhhcmQgPyBNYXRoLm1heChzaW5jLCAxKSA6IHNpbmM7XG4gICAgcmV0dXJuIHJvdW5kVG8oY2xhbXAocyAqIG1hc2tlZFNpbmMsIFNfTUlOLCAzNjUwMCksIDgpO1xuICB9XG4gIC8qKlxuICAgKiBUaGUgZm9ybXVsYSB1c2VkIGlzIDpcbiAgICogJCRSKHQsUykgPSAoMSArIFxcdGV4dHtGQUNUT1J9IFxcdGltZXMgXFxmcmFje3R9ezkgXFxjZG90IFN9KV57XFx0ZXh0e0RFQ0FZfX0kJFxuICAgKiBAcGFyYW0ge251bWJlcn0gZWxhcHNlZF9kYXlzIHQgZGF5cyBzaW5jZSB0aGUgbGFzdCByZXZpZXdcbiAgICogQHBhcmFtIHtudW1iZXJ9IHN0YWJpbGl0eSBTdGFiaWxpdHkgKGludGVydmFsIHdoZW4gUj05MCUpXG4gICAqIEByZXR1cm4ge251bWJlcn0gciBSZXRyaWV2YWJpbGl0eSAocHJvYmFiaWxpdHkgb2YgcmVjYWxsKVxuICAgKi9cbiAgZm9yZ2V0dGluZ19jdXJ2ZTtcbiAgLyoqXG4gICAqIENhbGN1bGF0ZXMgdGhlIG5leHQgc3RhdGUgb2YgbWVtb3J5IGJhc2VkIG9uIHRoZSBjdXJyZW50IHN0YXRlLCB0aW1lIGVsYXBzZWQsIGFuZCBncmFkZS5cbiAgICpcbiAgICogQHBhcmFtIG1lbW9yeV9zdGF0ZSAtIFRoZSBjdXJyZW50IHN0YXRlIG9mIG1lbW9yeSwgd2hpY2ggY2FuIGJlIG51bGwuXG4gICAqIEBwYXJhbSB0IC0gVGhlIHRpbWUgZWxhcHNlZCBzaW5jZSB0aGUgbGFzdCByZXZpZXcuXG4gICAqIEBwYXJhbSB7UmF0aW5nfSBnIEdyYWRlIChSYXRpbmdbMC5NYW51YWwsMS5BZ2FpbiwyLkhhcmQsMy5Hb29kLDQuRWFzeV0pXG4gICAqIEBwYXJhbSByIC0gT3B0aW9uYWwgcmV0cmlldmFiaWxpdHkgdmFsdWUuIElmIG5vdCBwcm92aWRlZCwgaXQgd2lsbCBiZSBjYWxjdWxhdGVkLlxuICAgKiBAcmV0dXJucyBUaGUgbmV4dCBzdGF0ZSBvZiBtZW1vcnkgd2l0aCB1cGRhdGVkIGRpZmZpY3VsdHkgYW5kIHN0YWJpbGl0eS5cbiAgICovXG4gIG5leHRfc3RhdGUobWVtb3J5X3N0YXRlLCB0LCBnLCByKSB7XG4gICAgY29uc3QgeyBkaWZmaWN1bHR5OiBkLCBzdGFiaWxpdHk6IHMgfSA9IG1lbW9yeV9zdGF0ZSA/PyB7XG4gICAgICBkaWZmaWN1bHR5OiAwLFxuICAgICAgc3RhYmlsaXR5OiAwXG4gICAgfTtcbiAgICBpZiAodCA8IDApIHtcbiAgICAgIHRocm93IG5ldyBGU1JTVmFsaWRhdGlvbkVycm9yKGBJbnZhbGlkIGRlbHRhX3QgXCIke3R9XCJgKTtcbiAgICB9XG4gICAgaWYgKGcgPCAwIHx8IGcgPiA0KSB7XG4gICAgICB0aHJvdyBuZXcgRlNSU1ZhbGlkYXRpb25FcnJvcihgSW52YWxpZCBncmFkZSBcIiR7Z31cImApO1xuICAgIH1cbiAgICBpZiAoZCA9PT0gMCAmJiBzID09PSAwKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBkaWZmaWN1bHR5OiBjbGFtcCh0aGlzLmluaXRfZGlmZmljdWx0eShnKSwgMSwgMTApLFxuICAgICAgICBzdGFiaWxpdHk6IHRoaXMuaW5pdF9zdGFiaWxpdHkoZylcbiAgICAgIH07XG4gICAgfVxuICAgIGlmIChnID09PSAwKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBkaWZmaWN1bHR5OiBkLFxuICAgICAgICBzdGFiaWxpdHk6IHNcbiAgICAgIH07XG4gICAgfVxuICAgIGlmIChkIDwgMSB8fCBzIDwgU19NSU4pIHtcbiAgICAgIHRocm93IG5ldyBGU1JTVmFsaWRhdGlvbkVycm9yKFxuICAgICAgICBgSW52YWxpZCBtZW1vcnkgc3RhdGUgeyBkaWZmaWN1bHR5OiAke2R9LCBzdGFiaWxpdHk6ICR7c30gfWBcbiAgICAgICk7XG4gICAgfVxuICAgIGNvbnN0IHcgPSB0aGlzLnBhcmFtLnc7XG4gICAgciA9IHR5cGVvZiByID09PSBcIm51bWJlclwiID8gciA6IHRoaXMuZm9yZ2V0dGluZ19jdXJ2ZSh0LCBzKTtcbiAgICBsZXQgbmV3X3M7XG4gICAgaWYgKHQgPT09IDAgJiYgdGhpcy5wYXJhbS5lbmFibGVfc2hvcnRfdGVybSkge1xuICAgICAgbmV3X3MgPSB0aGlzLm5leHRfc2hvcnRfdGVybV9zdGFiaWxpdHkocywgZyk7XG4gICAgfSBlbHNlIGlmIChnID09PSAxKSB7XG4gICAgICBjb25zdCBzX2FmdGVyX2ZhaWwgPSB0aGlzLm5leHRfZm9yZ2V0X3N0YWJpbGl0eShkLCBzLCByKTtcbiAgICAgIGxldCBbd18xNywgd18xOF0gPSBbMCwgMF07XG4gICAgICBpZiAodGhpcy5wYXJhbS5lbmFibGVfc2hvcnRfdGVybSkge1xuICAgICAgICB3XzE3ID0gd1sxN107XG4gICAgICAgIHdfMTggPSB3WzE4XTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IG5leHRfc19taW4gPSBzIC8gTWF0aC5leHAod18xNyAqIHdfMTgpO1xuICAgICAgbmV3X3MgPSBjbGFtcChyb3VuZFRvKG5leHRfc19taW4sIDgpLCBTX01JTiwgc19hZnRlcl9mYWlsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV3X3MgPSB0aGlzLm5leHRfcmVjYWxsX3N0YWJpbGl0eShkLCBzLCByLCBnKTtcbiAgICB9XG4gICAgY29uc3QgbmV3X2QgPSB0aGlzLm5leHRfZGlmZmljdWx0eShkLCBnKTtcbiAgICByZXR1cm4geyBkaWZmaWN1bHR5OiBuZXdfZCwgc3RhYmlsaXR5OiBuZXdfcyB9O1xuICB9XG59XG5cbmNsYXNzIEJhc2ljU2NoZWR1bGVyIGV4dGVuZHMgQWJzdHJhY3RTY2hlZHVsZXIge1xuICBsZWFybmluZ1N0ZXBzU3RyYXRlZ3k7XG4gIGNvbnN0cnVjdG9yKGNhcmQsIG5vdywgYWxnb3JpdGhtLCBzdHJhdGVnaWVzKSB7XG4gICAgc3VwZXIoY2FyZCwgbm93LCBhbGdvcml0aG0sIHN0cmF0ZWdpZXMpO1xuICAgIGxldCBsZWFybmluZ1N0ZXBTdHJhdGVneSA9IEJhc2ljTGVhcm5pbmdTdGVwc1N0cmF0ZWd5O1xuICAgIGlmICh0aGlzLnN0cmF0ZWdpZXMpIHtcbiAgICAgIGNvbnN0IGN1c3RvbV9zdHJhdGVneSA9IHRoaXMuc3RyYXRlZ2llcy5nZXQoU3RyYXRlZ3lNb2RlLkxFQVJOSU5HX1NURVBTKTtcbiAgICAgIGlmIChjdXN0b21fc3RyYXRlZ3kpIHtcbiAgICAgICAgbGVhcm5pbmdTdGVwU3RyYXRlZ3kgPSBjdXN0b21fc3RyYXRlZ3k7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMubGVhcm5pbmdTdGVwc1N0cmF0ZWd5ID0gbGVhcm5pbmdTdGVwU3RyYXRlZ3k7XG4gIH1cbiAgZ2V0TGVhcm5pbmdJbmZvKGNhcmQsIGdyYWRlKSB7XG4gICAgY29uc3QgcGFyYW1ldGVycyA9IHRoaXMuYWxnb3JpdGhtLnBhcmFtZXRlcnM7XG4gICAgY2FyZC5sZWFybmluZ19zdGVwcyA9IGNhcmQubGVhcm5pbmdfc3RlcHMgfHwgMDtcbiAgICBjb25zdCBzdGVwc19zdHJhdGVneSA9IHRoaXMubGVhcm5pbmdTdGVwc1N0cmF0ZWd5KFxuICAgICAgcGFyYW1ldGVycyxcbiAgICAgIGNhcmQuc3RhdGUsXG4gICAgICBjYXJkLmxlYXJuaW5nX3N0ZXBzXG4gICAgKTtcbiAgICBjb25zdCBzY2hlZHVsZWRfbWludXRlcyA9IE1hdGgubWF4KFxuICAgICAgMCxcbiAgICAgIHN0ZXBzX3N0cmF0ZWd5W2dyYWRlXT8uc2NoZWR1bGVkX21pbnV0ZXMgPz8gMFxuICAgICk7XG4gICAgY29uc3QgbmV4dF9zdGVwcyA9IE1hdGgubWF4KDAsIHN0ZXBzX3N0cmF0ZWd5W2dyYWRlXT8ubmV4dF9zdGVwID8/IDApO1xuICAgIHJldHVybiB7XG4gICAgICBzY2hlZHVsZWRfbWludXRlcyxcbiAgICAgIG5leHRfc3RlcHNcbiAgICB9O1xuICB9XG4gIC8qKlxuICAgKiBAZGVzY3JpcHRpb24gVGhpcyBmdW5jdGlvbiBhcHBsaWVzIHRoZSBsZWFybmluZyBzdGVwcyBiYXNlZCBvbiB0aGUgY3VycmVudCBjYXJkJ3Mgc3RhdGUgYW5kIGdyYWRlLlxuICAgKi9cbiAgYXBwbHlMZWFybmluZ1N0ZXBzKG5leHRDYXJkLCBncmFkZSwgdG9fc3RhdGUpIHtcbiAgICBjb25zdCB7IHNjaGVkdWxlZF9taW51dGVzLCBuZXh0X3N0ZXBzIH0gPSB0aGlzLmdldExlYXJuaW5nSW5mbyhcbiAgICAgIHRoaXMuY3VycmVudCxcbiAgICAgIGdyYWRlXG4gICAgKTtcbiAgICBpZiAoc2NoZWR1bGVkX21pbnV0ZXMgPiAwICYmIHNjaGVkdWxlZF9taW51dGVzIDwgMTQ0MCkge1xuICAgICAgbmV4dENhcmQubGVhcm5pbmdfc3RlcHMgPSBuZXh0X3N0ZXBzO1xuICAgICAgbmV4dENhcmQuc2NoZWR1bGVkX2RheXMgPSAwO1xuICAgICAgbmV4dENhcmQuc3RhdGUgPSB0b19zdGF0ZTtcbiAgICAgIG5leHRDYXJkLmR1ZSA9IGRhdGVfc2NoZWR1bGVyKFxuICAgICAgICB0aGlzLnJldmlld190aW1lLFxuICAgICAgICBNYXRoLnJvdW5kKHNjaGVkdWxlZF9taW51dGVzKSxcbiAgICAgICAgZmFsc2VcbiAgICAgICAgLyoqIHRydWU6ZGF5cyBmYWxzZTogbWludXRlICovXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICBuZXh0Q2FyZC5zdGF0ZSA9IFN0YXRlLlJldmlldztcbiAgICAgIGlmIChzY2hlZHVsZWRfbWludXRlcyA+PSAxNDQwKSB7XG4gICAgICAgIG5leHRDYXJkLmxlYXJuaW5nX3N0ZXBzID0gbmV4dF9zdGVwcztcbiAgICAgICAgbmV4dENhcmQuZHVlID0gZGF0ZV9zY2hlZHVsZXIoXG4gICAgICAgICAgdGhpcy5yZXZpZXdfdGltZSxcbiAgICAgICAgICBNYXRoLnJvdW5kKHNjaGVkdWxlZF9taW51dGVzKSxcbiAgICAgICAgICBmYWxzZVxuICAgICAgICAgIC8qKiB0cnVlOmRheXMgZmFsc2U6IG1pbnV0ZSAqL1xuICAgICAgICApO1xuICAgICAgICBuZXh0Q2FyZC5zY2hlZHVsZWRfZGF5cyA9IE1hdGguZmxvb3Ioc2NoZWR1bGVkX21pbnV0ZXMgLyAxNDQwKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5leHRDYXJkLmxlYXJuaW5nX3N0ZXBzID0gMDtcbiAgICAgICAgY29uc3QgaW50ZXJ2YWwgPSB0aGlzLmFsZ29yaXRobS5uZXh0X2ludGVydmFsKFxuICAgICAgICAgIG5leHRDYXJkLnN0YWJpbGl0eSxcbiAgICAgICAgICB0aGlzLmVsYXBzZWRfZGF5c1xuICAgICAgICApO1xuICAgICAgICBuZXh0Q2FyZC5zY2hlZHVsZWRfZGF5cyA9IGludGVydmFsO1xuICAgICAgICBuZXh0Q2FyZC5kdWUgPSBkYXRlX3NjaGVkdWxlcih0aGlzLnJldmlld190aW1lLCBpbnRlcnZhbCwgdHJ1ZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIG5ld1N0YXRlKGdyYWRlKSB7XG4gICAgY29uc3QgZXhpc3QgPSB0aGlzLm5leHQuZ2V0KGdyYWRlKTtcbiAgICBpZiAoZXhpc3QpIHtcbiAgICAgIHJldHVybiBleGlzdDtcbiAgICB9XG4gICAgY29uc3QgbmV4dCA9IHRoaXMubmV4dF9kcyh0aGlzLmVsYXBzZWRfZGF5cywgZ3JhZGUpO1xuICAgIHRoaXMuYXBwbHlMZWFybmluZ1N0ZXBzKG5leHQsIGdyYWRlLCBTdGF0ZS5MZWFybmluZyk7XG4gICAgY29uc3QgaXRlbSA9IHtcbiAgICAgIGNhcmQ6IG5leHQsXG4gICAgICBsb2c6IHRoaXMuYnVpbGRMb2coZ3JhZGUpXG4gICAgfTtcbiAgICB0aGlzLm5leHQuc2V0KGdyYWRlLCBpdGVtKTtcbiAgICByZXR1cm4gaXRlbTtcbiAgfVxuICBsZWFybmluZ1N0YXRlKGdyYWRlKSB7XG4gICAgY29uc3QgZXhpc3QgPSB0aGlzLm5leHQuZ2V0KGdyYWRlKTtcbiAgICBpZiAoZXhpc3QpIHtcbiAgICAgIHJldHVybiBleGlzdDtcbiAgICB9XG4gICAgY29uc3QgbmV4dCA9IHRoaXMubmV4dF9kcyh0aGlzLmVsYXBzZWRfZGF5cywgZ3JhZGUpO1xuICAgIHRoaXMuYXBwbHlMZWFybmluZ1N0ZXBzKFxuICAgICAgbmV4dCxcbiAgICAgIGdyYWRlLFxuICAgICAgdGhpcy5sYXN0LnN0YXRlXG4gICAgICAvKiogTGVhcm5pbmcgb3IgUmVsZWFybmluZyAqL1xuICAgICk7XG4gICAgY29uc3QgaXRlbSA9IHtcbiAgICAgIGNhcmQ6IG5leHQsXG4gICAgICBsb2c6IHRoaXMuYnVpbGRMb2coZ3JhZGUpXG4gICAgfTtcbiAgICB0aGlzLm5leHQuc2V0KGdyYWRlLCBpdGVtKTtcbiAgICByZXR1cm4gaXRlbTtcbiAgfVxuICByZXZpZXdTdGF0ZShncmFkZSkge1xuICAgIGNvbnN0IGV4aXN0ID0gdGhpcy5uZXh0LmdldChncmFkZSk7XG4gICAgaWYgKGV4aXN0KSB7XG4gICAgICByZXR1cm4gZXhpc3Q7XG4gICAgfVxuICAgIGNvbnN0IGludGVydmFsID0gdGhpcy5lbGFwc2VkX2RheXM7XG4gICAgY29uc3QgcmV0cmlldmFiaWxpdHkgPSB0aGlzLmFsZ29yaXRobS5mb3JnZXR0aW5nX2N1cnZlKFxuICAgICAgaW50ZXJ2YWwsXG4gICAgICB0aGlzLmN1cnJlbnQuc3RhYmlsaXR5XG4gICAgKTtcbiAgICBjb25zdCBuZXh0X2FnYWluID0gdGhpcy5uZXh0X2RzKGludGVydmFsLCBSYXRpbmcuQWdhaW4sIHJldHJpZXZhYmlsaXR5KTtcbiAgICBjb25zdCBuZXh0X2hhcmQgPSB0aGlzLm5leHRfZHMoaW50ZXJ2YWwsIFJhdGluZy5IYXJkLCByZXRyaWV2YWJpbGl0eSk7XG4gICAgY29uc3QgbmV4dF9nb29kID0gdGhpcy5uZXh0X2RzKGludGVydmFsLCBSYXRpbmcuR29vZCwgcmV0cmlldmFiaWxpdHkpO1xuICAgIGNvbnN0IG5leHRfZWFzeSA9IHRoaXMubmV4dF9kcyhpbnRlcnZhbCwgUmF0aW5nLkVhc3ksIHJldHJpZXZhYmlsaXR5KTtcbiAgICB0aGlzLm5leHRfaW50ZXJ2YWwobmV4dF9oYXJkLCBuZXh0X2dvb2QsIG5leHRfZWFzeSwgaW50ZXJ2YWwpO1xuICAgIHRoaXMubmV4dF9zdGF0ZShuZXh0X2hhcmQsIG5leHRfZ29vZCwgbmV4dF9lYXN5KTtcbiAgICB0aGlzLmFwcGx5TGVhcm5pbmdTdGVwcyhuZXh0X2FnYWluLCBSYXRpbmcuQWdhaW4sIFN0YXRlLlJlbGVhcm5pbmcpO1xuICAgIG5leHRfYWdhaW4ubGFwc2VzICs9IDE7XG4gICAgY29uc3QgaXRlbV9hZ2FpbiA9IHtcbiAgICAgIGNhcmQ6IG5leHRfYWdhaW4sXG4gICAgICBsb2c6IHRoaXMuYnVpbGRMb2coUmF0aW5nLkFnYWluKVxuICAgIH07XG4gICAgY29uc3QgaXRlbV9oYXJkID0ge1xuICAgICAgY2FyZDogbmV4dF9oYXJkLFxuICAgICAgbG9nOiBzdXBlci5idWlsZExvZyhSYXRpbmcuSGFyZClcbiAgICB9O1xuICAgIGNvbnN0IGl0ZW1fZ29vZCA9IHtcbiAgICAgIGNhcmQ6IG5leHRfZ29vZCxcbiAgICAgIGxvZzogc3VwZXIuYnVpbGRMb2coUmF0aW5nLkdvb2QpXG4gICAgfTtcbiAgICBjb25zdCBpdGVtX2Vhc3kgPSB7XG4gICAgICBjYXJkOiBuZXh0X2Vhc3ksXG4gICAgICBsb2c6IHN1cGVyLmJ1aWxkTG9nKFJhdGluZy5FYXN5KVxuICAgIH07XG4gICAgdGhpcy5uZXh0LnNldChSYXRpbmcuQWdhaW4sIGl0ZW1fYWdhaW4pO1xuICAgIHRoaXMubmV4dC5zZXQoUmF0aW5nLkhhcmQsIGl0ZW1faGFyZCk7XG4gICAgdGhpcy5uZXh0LnNldChSYXRpbmcuR29vZCwgaXRlbV9nb29kKTtcbiAgICB0aGlzLm5leHQuc2V0KFJhdGluZy5FYXN5LCBpdGVtX2Vhc3kpO1xuICAgIHJldHVybiB0aGlzLm5leHQuZ2V0KGdyYWRlKTtcbiAgfVxuICAvKipcbiAgICogUmV2aWV3IG5leHRfZHNcbiAgICovXG4gIG5leHRfZHModCwgZywgcikge1xuICAgIGNvbnN0IG5leHRfc3RhdGUgPSB0aGlzLmFsZ29yaXRobS5uZXh0X3N0YXRlKFxuICAgICAge1xuICAgICAgICBkaWZmaWN1bHR5OiB0aGlzLmN1cnJlbnQuZGlmZmljdWx0eSxcbiAgICAgICAgc3RhYmlsaXR5OiB0aGlzLmN1cnJlbnQuc3RhYmlsaXR5XG4gICAgICB9LFxuICAgICAgdCxcbiAgICAgIGcsXG4gICAgICByXG4gICAgKTtcbiAgICBjb25zdCBjYXJkID0gVHlwZUNvbnZlcnQuY2FyZCh0aGlzLmN1cnJlbnQpO1xuICAgIGNhcmQuZGlmZmljdWx0eSA9IG5leHRfc3RhdGUuZGlmZmljdWx0eTtcbiAgICBjYXJkLnN0YWJpbGl0eSA9IG5leHRfc3RhdGUuc3RhYmlsaXR5O1xuICAgIHJldHVybiBjYXJkO1xuICB9XG4gIC8qKlxuICAgKiBSZXZpZXcgbmV4dF9pbnRlcnZhbFxuICAgKi9cbiAgbmV4dF9pbnRlcnZhbChuZXh0X2hhcmQsIG5leHRfZ29vZCwgbmV4dF9lYXN5LCBpbnRlcnZhbCkge1xuICAgIGxldCBoYXJkX2ludGVydmFsLCBnb29kX2ludGVydmFsO1xuICAgIGhhcmRfaW50ZXJ2YWwgPSB0aGlzLmFsZ29yaXRobS5uZXh0X2ludGVydmFsKG5leHRfaGFyZC5zdGFiaWxpdHksIGludGVydmFsKTtcbiAgICBnb29kX2ludGVydmFsID0gdGhpcy5hbGdvcml0aG0ubmV4dF9pbnRlcnZhbChuZXh0X2dvb2Quc3RhYmlsaXR5LCBpbnRlcnZhbCk7XG4gICAgaGFyZF9pbnRlcnZhbCA9IE1hdGgubWluKGhhcmRfaW50ZXJ2YWwsIGdvb2RfaW50ZXJ2YWwpO1xuICAgIGdvb2RfaW50ZXJ2YWwgPSBNYXRoLm1heChnb29kX2ludGVydmFsLCBoYXJkX2ludGVydmFsICsgMSk7XG4gICAgY29uc3QgZWFzeV9pbnRlcnZhbCA9IE1hdGgubWF4KFxuICAgICAgdGhpcy5hbGdvcml0aG0ubmV4dF9pbnRlcnZhbChuZXh0X2Vhc3kuc3RhYmlsaXR5LCBpbnRlcnZhbCksXG4gICAgICBnb29kX2ludGVydmFsICsgMVxuICAgICk7XG4gICAgbmV4dF9oYXJkLnNjaGVkdWxlZF9kYXlzID0gaGFyZF9pbnRlcnZhbDtcbiAgICBuZXh0X2hhcmQuZHVlID0gZGF0ZV9zY2hlZHVsZXIodGhpcy5yZXZpZXdfdGltZSwgaGFyZF9pbnRlcnZhbCwgdHJ1ZSk7XG4gICAgbmV4dF9nb29kLnNjaGVkdWxlZF9kYXlzID0gZ29vZF9pbnRlcnZhbDtcbiAgICBuZXh0X2dvb2QuZHVlID0gZGF0ZV9zY2hlZHVsZXIodGhpcy5yZXZpZXdfdGltZSwgZ29vZF9pbnRlcnZhbCwgdHJ1ZSk7XG4gICAgbmV4dF9lYXN5LnNjaGVkdWxlZF9kYXlzID0gZWFzeV9pbnRlcnZhbDtcbiAgICBuZXh0X2Vhc3kuZHVlID0gZGF0ZV9zY2hlZHVsZXIodGhpcy5yZXZpZXdfdGltZSwgZWFzeV9pbnRlcnZhbCwgdHJ1ZSk7XG4gIH1cbiAgLyoqXG4gICAqIFJldmlldyBuZXh0X3N0YXRlXG4gICAqL1xuICBuZXh0X3N0YXRlKG5leHRfaGFyZCwgbmV4dF9nb29kLCBuZXh0X2Vhc3kpIHtcbiAgICBuZXh0X2hhcmQuc3RhdGUgPSBTdGF0ZS5SZXZpZXc7XG4gICAgbmV4dF9oYXJkLmxlYXJuaW5nX3N0ZXBzID0gMDtcbiAgICBuZXh0X2dvb2Quc3RhdGUgPSBTdGF0ZS5SZXZpZXc7XG4gICAgbmV4dF9nb29kLmxlYXJuaW5nX3N0ZXBzID0gMDtcbiAgICBuZXh0X2Vhc3kuc3RhdGUgPSBTdGF0ZS5SZXZpZXc7XG4gICAgbmV4dF9lYXN5LmxlYXJuaW5nX3N0ZXBzID0gMDtcbiAgfVxufVxuXG5jbGFzcyBMb25nVGVybVNjaGVkdWxlciBleHRlbmRzIEFic3RyYWN0U2NoZWR1bGVyIHtcbiAgbmV3U3RhdGUoZ3JhZGUpIHtcbiAgICBjb25zdCBleGlzdCA9IHRoaXMubmV4dC5nZXQoZ3JhZGUpO1xuICAgIGlmIChleGlzdCkge1xuICAgICAgcmV0dXJuIGV4aXN0O1xuICAgIH1cbiAgICB0aGlzLmN1cnJlbnQuc2NoZWR1bGVkX2RheXMgPSAwO1xuICAgIHRoaXMuY3VycmVudC5lbGFwc2VkX2RheXMgPSAwO1xuICAgIGNvbnN0IGZpcnN0X2ludGVydmFsID0gMDtcbiAgICBjb25zdCBuZXh0X2FnYWluID0gdGhpcy5uZXh0X2RzKGZpcnN0X2ludGVydmFsLCBSYXRpbmcuQWdhaW4pO1xuICAgIGNvbnN0IG5leHRfaGFyZCA9IHRoaXMubmV4dF9kcyhmaXJzdF9pbnRlcnZhbCwgUmF0aW5nLkhhcmQpO1xuICAgIGNvbnN0IG5leHRfZ29vZCA9IHRoaXMubmV4dF9kcyhmaXJzdF9pbnRlcnZhbCwgUmF0aW5nLkdvb2QpO1xuICAgIGNvbnN0IG5leHRfZWFzeSA9IHRoaXMubmV4dF9kcyhmaXJzdF9pbnRlcnZhbCwgUmF0aW5nLkVhc3kpO1xuICAgIHRoaXMubmV4dF9pbnRlcnZhbChcbiAgICAgIG5leHRfYWdhaW4sXG4gICAgICBuZXh0X2hhcmQsXG4gICAgICBuZXh0X2dvb2QsXG4gICAgICBuZXh0X2Vhc3ksXG4gICAgICBmaXJzdF9pbnRlcnZhbFxuICAgICk7XG4gICAgdGhpcy5uZXh0X3N0YXRlKG5leHRfYWdhaW4sIG5leHRfaGFyZCwgbmV4dF9nb29kLCBuZXh0X2Vhc3kpO1xuICAgIHRoaXMudXBkYXRlX25leHQobmV4dF9hZ2FpbiwgbmV4dF9oYXJkLCBuZXh0X2dvb2QsIG5leHRfZWFzeSk7XG4gICAgcmV0dXJuIHRoaXMubmV4dC5nZXQoZ3JhZGUpO1xuICB9XG4gIG5leHRfZHModCwgZywgcikge1xuICAgIGNvbnN0IG5leHRfc3RhdGUgPSB0aGlzLmFsZ29yaXRobS5uZXh0X3N0YXRlKFxuICAgICAge1xuICAgICAgICBkaWZmaWN1bHR5OiB0aGlzLmN1cnJlbnQuZGlmZmljdWx0eSxcbiAgICAgICAgc3RhYmlsaXR5OiB0aGlzLmN1cnJlbnQuc3RhYmlsaXR5XG4gICAgICB9LFxuICAgICAgdCxcbiAgICAgIGcsXG4gICAgICByXG4gICAgKTtcbiAgICBjb25zdCBjYXJkID0gVHlwZUNvbnZlcnQuY2FyZCh0aGlzLmN1cnJlbnQpO1xuICAgIGNhcmQuZGlmZmljdWx0eSA9IG5leHRfc3RhdGUuZGlmZmljdWx0eTtcbiAgICBjYXJkLnN0YWJpbGl0eSA9IG5leHRfc3RhdGUuc3RhYmlsaXR5O1xuICAgIHJldHVybiBjYXJkO1xuICB9XG4gIC8qKlxuICAgKiBAc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9vcGVuLXNwYWNlZC1yZXBldGl0aW9uL3RzLWZzcnMvaXNzdWVzLzk4I2lzc3VlY29tbWVudC0yMjQxOTIzMTk0XG4gICAqL1xuICBsZWFybmluZ1N0YXRlKGdyYWRlKSB7XG4gICAgcmV0dXJuIHRoaXMucmV2aWV3U3RhdGUoZ3JhZGUpO1xuICB9XG4gIHJldmlld1N0YXRlKGdyYWRlKSB7XG4gICAgY29uc3QgZXhpc3QgPSB0aGlzLm5leHQuZ2V0KGdyYWRlKTtcbiAgICBpZiAoZXhpc3QpIHtcbiAgICAgIHJldHVybiBleGlzdDtcbiAgICB9XG4gICAgY29uc3QgaW50ZXJ2YWwgPSB0aGlzLmVsYXBzZWRfZGF5cztcbiAgICBjb25zdCByZXRyaWV2YWJpbGl0eSA9IHRoaXMuYWxnb3JpdGhtLmZvcmdldHRpbmdfY3VydmUoXG4gICAgICBpbnRlcnZhbCxcbiAgICAgIHRoaXMuY3VycmVudC5zdGFiaWxpdHlcbiAgICApO1xuICAgIGNvbnN0IG5leHRfYWdhaW4gPSB0aGlzLm5leHRfZHMoaW50ZXJ2YWwsIFJhdGluZy5BZ2FpbiwgcmV0cmlldmFiaWxpdHkpO1xuICAgIGNvbnN0IG5leHRfaGFyZCA9IHRoaXMubmV4dF9kcyhpbnRlcnZhbCwgUmF0aW5nLkhhcmQsIHJldHJpZXZhYmlsaXR5KTtcbiAgICBjb25zdCBuZXh0X2dvb2QgPSB0aGlzLm5leHRfZHMoaW50ZXJ2YWwsIFJhdGluZy5Hb29kLCByZXRyaWV2YWJpbGl0eSk7XG4gICAgY29uc3QgbmV4dF9lYXN5ID0gdGhpcy5uZXh0X2RzKGludGVydmFsLCBSYXRpbmcuRWFzeSwgcmV0cmlldmFiaWxpdHkpO1xuICAgIHRoaXMubmV4dF9pbnRlcnZhbChuZXh0X2FnYWluLCBuZXh0X2hhcmQsIG5leHRfZ29vZCwgbmV4dF9lYXN5LCBpbnRlcnZhbCk7XG4gICAgdGhpcy5uZXh0X3N0YXRlKG5leHRfYWdhaW4sIG5leHRfaGFyZCwgbmV4dF9nb29kLCBuZXh0X2Vhc3kpO1xuICAgIG5leHRfYWdhaW4ubGFwc2VzICs9IDE7XG4gICAgdGhpcy51cGRhdGVfbmV4dChuZXh0X2FnYWluLCBuZXh0X2hhcmQsIG5leHRfZ29vZCwgbmV4dF9lYXN5KTtcbiAgICByZXR1cm4gdGhpcy5uZXh0LmdldChncmFkZSk7XG4gIH1cbiAgLyoqXG4gICAqIFJldmlldy9OZXcgbmV4dF9pbnRlcnZhbFxuICAgKi9cbiAgbmV4dF9pbnRlcnZhbChuZXh0X2FnYWluLCBuZXh0X2hhcmQsIG5leHRfZ29vZCwgbmV4dF9lYXN5LCBpbnRlcnZhbCkge1xuICAgIGxldCBhZ2Fpbl9pbnRlcnZhbCwgaGFyZF9pbnRlcnZhbCwgZ29vZF9pbnRlcnZhbCwgZWFzeV9pbnRlcnZhbDtcbiAgICBhZ2Fpbl9pbnRlcnZhbCA9IHRoaXMuYWxnb3JpdGhtLm5leHRfaW50ZXJ2YWwoXG4gICAgICBuZXh0X2FnYWluLnN0YWJpbGl0eSxcbiAgICAgIGludGVydmFsXG4gICAgKTtcbiAgICBoYXJkX2ludGVydmFsID0gdGhpcy5hbGdvcml0aG0ubmV4dF9pbnRlcnZhbChuZXh0X2hhcmQuc3RhYmlsaXR5LCBpbnRlcnZhbCk7XG4gICAgZ29vZF9pbnRlcnZhbCA9IHRoaXMuYWxnb3JpdGhtLm5leHRfaW50ZXJ2YWwobmV4dF9nb29kLnN0YWJpbGl0eSwgaW50ZXJ2YWwpO1xuICAgIGVhc3lfaW50ZXJ2YWwgPSB0aGlzLmFsZ29yaXRobS5uZXh0X2ludGVydmFsKG5leHRfZWFzeS5zdGFiaWxpdHksIGludGVydmFsKTtcbiAgICBhZ2Fpbl9pbnRlcnZhbCA9IE1hdGgubWluKGFnYWluX2ludGVydmFsLCBoYXJkX2ludGVydmFsKTtcbiAgICBoYXJkX2ludGVydmFsID0gTWF0aC5tYXgoaGFyZF9pbnRlcnZhbCwgYWdhaW5faW50ZXJ2YWwgKyAxKTtcbiAgICBnb29kX2ludGVydmFsID0gTWF0aC5tYXgoZ29vZF9pbnRlcnZhbCwgaGFyZF9pbnRlcnZhbCArIDEpO1xuICAgIGVhc3lfaW50ZXJ2YWwgPSBNYXRoLm1heChlYXN5X2ludGVydmFsLCBnb29kX2ludGVydmFsICsgMSk7XG4gICAgbmV4dF9hZ2Fpbi5zY2hlZHVsZWRfZGF5cyA9IGFnYWluX2ludGVydmFsO1xuICAgIG5leHRfYWdhaW4uZHVlID0gZGF0ZV9zY2hlZHVsZXIodGhpcy5yZXZpZXdfdGltZSwgYWdhaW5faW50ZXJ2YWwsIHRydWUpO1xuICAgIG5leHRfaGFyZC5zY2hlZHVsZWRfZGF5cyA9IGhhcmRfaW50ZXJ2YWw7XG4gICAgbmV4dF9oYXJkLmR1ZSA9IGRhdGVfc2NoZWR1bGVyKHRoaXMucmV2aWV3X3RpbWUsIGhhcmRfaW50ZXJ2YWwsIHRydWUpO1xuICAgIG5leHRfZ29vZC5zY2hlZHVsZWRfZGF5cyA9IGdvb2RfaW50ZXJ2YWw7XG4gICAgbmV4dF9nb29kLmR1ZSA9IGRhdGVfc2NoZWR1bGVyKHRoaXMucmV2aWV3X3RpbWUsIGdvb2RfaW50ZXJ2YWwsIHRydWUpO1xuICAgIG5leHRfZWFzeS5zY2hlZHVsZWRfZGF5cyA9IGVhc3lfaW50ZXJ2YWw7XG4gICAgbmV4dF9lYXN5LmR1ZSA9IGRhdGVfc2NoZWR1bGVyKHRoaXMucmV2aWV3X3RpbWUsIGVhc3lfaW50ZXJ2YWwsIHRydWUpO1xuICB9XG4gIC8qKlxuICAgKiBSZXZpZXcvTmV3IG5leHRfc3RhdGVcbiAgICovXG4gIG5leHRfc3RhdGUobmV4dF9hZ2FpbiwgbmV4dF9oYXJkLCBuZXh0X2dvb2QsIG5leHRfZWFzeSkge1xuICAgIG5leHRfYWdhaW4uc3RhdGUgPSBTdGF0ZS5SZXZpZXc7XG4gICAgbmV4dF9hZ2Fpbi5sZWFybmluZ19zdGVwcyA9IDA7XG4gICAgbmV4dF9oYXJkLnN0YXRlID0gU3RhdGUuUmV2aWV3O1xuICAgIG5leHRfaGFyZC5sZWFybmluZ19zdGVwcyA9IDA7XG4gICAgbmV4dF9nb29kLnN0YXRlID0gU3RhdGUuUmV2aWV3O1xuICAgIG5leHRfZ29vZC5sZWFybmluZ19zdGVwcyA9IDA7XG4gICAgbmV4dF9lYXN5LnN0YXRlID0gU3RhdGUuUmV2aWV3O1xuICAgIG5leHRfZWFzeS5sZWFybmluZ19zdGVwcyA9IDA7XG4gIH1cbiAgdXBkYXRlX25leHQobmV4dF9hZ2FpbiwgbmV4dF9oYXJkLCBuZXh0X2dvb2QsIG5leHRfZWFzeSkge1xuICAgIGNvbnN0IGl0ZW1fYWdhaW4gPSB7XG4gICAgICBjYXJkOiBuZXh0X2FnYWluLFxuICAgICAgbG9nOiB0aGlzLmJ1aWxkTG9nKFJhdGluZy5BZ2FpbilcbiAgICB9O1xuICAgIGNvbnN0IGl0ZW1faGFyZCA9IHtcbiAgICAgIGNhcmQ6IG5leHRfaGFyZCxcbiAgICAgIGxvZzogc3VwZXIuYnVpbGRMb2coUmF0aW5nLkhhcmQpXG4gICAgfTtcbiAgICBjb25zdCBpdGVtX2dvb2QgPSB7XG4gICAgICBjYXJkOiBuZXh0X2dvb2QsXG4gICAgICBsb2c6IHN1cGVyLmJ1aWxkTG9nKFJhdGluZy5Hb29kKVxuICAgIH07XG4gICAgY29uc3QgaXRlbV9lYXN5ID0ge1xuICAgICAgY2FyZDogbmV4dF9lYXN5LFxuICAgICAgbG9nOiBzdXBlci5idWlsZExvZyhSYXRpbmcuRWFzeSlcbiAgICB9O1xuICAgIHRoaXMubmV4dC5zZXQoUmF0aW5nLkFnYWluLCBpdGVtX2FnYWluKTtcbiAgICB0aGlzLm5leHQuc2V0KFJhdGluZy5IYXJkLCBpdGVtX2hhcmQpO1xuICAgIHRoaXMubmV4dC5zZXQoUmF0aW5nLkdvb2QsIGl0ZW1fZ29vZCk7XG4gICAgdGhpcy5uZXh0LnNldChSYXRpbmcuRWFzeSwgaXRlbV9lYXN5KTtcbiAgfVxufVxuXG5jbGFzcyBSZXNjaGVkdWxlIHtcbiAgZnNycztcbiAgLyoqXG4gICAqIENyZWF0ZXMgYW4gaW5zdGFuY2Ugb2YgdGhlIGBSZXNjaGVkdWxlYCBjbGFzcy5cbiAgICogQHBhcmFtIGZzcnMgLSBBbiBpbnN0YW5jZSBvZiB0aGUgRlNSUyBjbGFzcyB1c2VkIGZvciBzY2hlZHVsaW5nLlxuICAgKi9cbiAgY29uc3RydWN0b3IoZnNycykge1xuICAgIHRoaXMuZnNycyA9IGZzcnM7XG4gIH1cbiAgLyoqXG4gICAqIFJlcGxheXMgYSByZXZpZXcgZm9yIGEgY2FyZCBhbmQgZGV0ZXJtaW5lcyB0aGUgbmV4dCByZXZpZXcgZGF0ZSBiYXNlZCBvbiB0aGUgZ2l2ZW4gcmF0aW5nLlxuICAgKiBAcGFyYW0gY2FyZCAtIFRoZSBjYXJkIGJlaW5nIHJldmlld2VkLlxuICAgKiBAcGFyYW0gcmV2aWV3ZWQgLSBUaGUgZGF0ZSB0aGUgY2FyZCB3YXMgcmV2aWV3ZWQuXG4gICAqIEBwYXJhbSByYXRpbmcgLSBUaGUgZ3JhZGUgZ2l2ZW4gdG8gdGhlIGNhcmQgZHVyaW5nIHRoZSByZXZpZXcuXG4gICAqIEByZXR1cm5zIEEgYFJlY29yZExvZ0l0ZW1gIGNvbnRhaW5pbmcgdGhlIHVwZGF0ZWQgY2FyZCBhbmQgcmV2aWV3IGxvZy5cbiAgICovXG4gIHJlcGxheShjYXJkLCByZXZpZXdlZCwgcmF0aW5nKSB7XG4gICAgcmV0dXJuIHRoaXMuZnNycy5uZXh0KGNhcmQsIHJldmlld2VkLCByYXRpbmcpO1xuICB9XG4gIC8qKlxuICAgKiBQcm9jZXNzZXMgYSBtYW51YWwgcmV2aWV3IGZvciBhIGNhcmQsIGFsbG93aW5nIGZvciBjdXN0b20gc3RhdGUsIHN0YWJpbGl0eSwgZGlmZmljdWx0eSwgYW5kIGR1ZSBkYXRlLlxuICAgKiBAcGFyYW0gY2FyZCAtIFRoZSBjYXJkIGJlaW5nIHJldmlld2VkLlxuICAgKiBAcGFyYW0gc3RhdGUgLSBUaGUgc3RhdGUgb2YgdGhlIGNhcmQgYWZ0ZXIgdGhlIHJldmlldy5cbiAgICogQHBhcmFtIHJldmlld2VkIC0gVGhlIGRhdGUgdGhlIGNhcmQgd2FzIHJldmlld2VkLlxuICAgKiBAcGFyYW0gZWxhcHNlZF9kYXlzIC0gVGhlIG51bWJlciBvZiBkYXlzIHNpbmNlIHRoZSBsYXN0IHJldmlldy5cbiAgICogQHBhcmFtIHN0YWJpbGl0eSAtIChPcHRpb25hbCkgVGhlIHN0YWJpbGl0eSBvZiB0aGUgY2FyZC5cbiAgICogQHBhcmFtIGRpZmZpY3VsdHkgLSAoT3B0aW9uYWwpIFRoZSBkaWZmaWN1bHR5IG9mIHRoZSBjYXJkLlxuICAgKiBAcGFyYW0gZHVlIC0gKE9wdGlvbmFsKSBUaGUgZHVlIGRhdGUgZm9yIHRoZSBuZXh0IHJldmlldy5cbiAgICogQHJldHVybnMgQSBgUmVjb3JkTG9nSXRlbWAgY29udGFpbmluZyB0aGUgdXBkYXRlZCBjYXJkIGFuZCByZXZpZXcgbG9nLlxuICAgKiBAdGhyb3dzIFdpbGwgdGhyb3cgYW4gZXJyb3IgaWYgdGhlIHN0YXRlIG9yIGR1ZSBkYXRlIGlzIG5vdCBwcm92aWRlZCB3aGVuIHJlcXVpcmVkLlxuICAgKi9cbiAgaGFuZGxlTWFudWFsUmF0aW5nKGNhcmQsIHN0YXRlLCByZXZpZXdlZCwgZWxhcHNlZF9kYXlzLCBzdGFiaWxpdHksIGRpZmZpY3VsdHksIGR1ZSkge1xuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgIHRocm93IG5ldyBGU1JTVmFsaWRhdGlvbkVycm9yKFxuICAgICAgICBcInJlc2NoZWR1bGU6IHN0YXRlIGlzIHJlcXVpcmVkIGZvciBtYW51YWwgcmF0aW5nXCJcbiAgICAgICk7XG4gICAgfVxuICAgIGxldCBsb2c7XG4gICAgbGV0IG5leHRfY2FyZDtcbiAgICBpZiAoc3RhdGUgPT09IFN0YXRlLk5ldykge1xuICAgICAgbG9nID0ge1xuICAgICAgICByYXRpbmc6IFJhdGluZy5NYW51YWwsXG4gICAgICAgIHN0YXRlLFxuICAgICAgICBkdWU6IGR1ZSA/PyByZXZpZXdlZCxcbiAgICAgICAgc3RhYmlsaXR5OiBjYXJkLnN0YWJpbGl0eSxcbiAgICAgICAgZGlmZmljdWx0eTogY2FyZC5kaWZmaWN1bHR5LFxuICAgICAgICBlbGFwc2VkX2RheXMsXG4gICAgICAgIGxhc3RfZWxhcHNlZF9kYXlzOiBjYXJkLmVsYXBzZWRfZGF5cyxcbiAgICAgICAgc2NoZWR1bGVkX2RheXM6IGNhcmQuc2NoZWR1bGVkX2RheXMsXG4gICAgICAgIGxlYXJuaW5nX3N0ZXBzOiBjYXJkLmxlYXJuaW5nX3N0ZXBzLFxuICAgICAgICByZXZpZXc6IHJldmlld2VkXG4gICAgICB9O1xuICAgICAgbmV4dF9jYXJkID0gY3JlYXRlRW1wdHlDYXJkKHJldmlld2VkKTtcbiAgICAgIG5leHRfY2FyZC5sYXN0X3JldmlldyA9IHJldmlld2VkO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAodHlwZW9mIGR1ZSA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICB0aHJvdyBuZXcgRlNSU1ZhbGlkYXRpb25FcnJvcihcbiAgICAgICAgICBcInJlc2NoZWR1bGU6IGR1ZSBpcyByZXF1aXJlZCBmb3IgbWFudWFsIHJhdGluZ1wiXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBjb25zdCBzY2hlZHVsZWRfZGF5cyA9IGRhdGVfZGlmZihkdWUsIHJldmlld2VkLCBcImRheXNcIik7XG4gICAgICBsb2cgPSB7XG4gICAgICAgIHJhdGluZzogUmF0aW5nLk1hbnVhbCxcbiAgICAgICAgc3RhdGU6IGNhcmQuc3RhdGUsXG4gICAgICAgIGR1ZTogY2FyZC5sYXN0X3JldmlldyB8fCBjYXJkLmR1ZSxcbiAgICAgICAgc3RhYmlsaXR5OiBjYXJkLnN0YWJpbGl0eSxcbiAgICAgICAgZGlmZmljdWx0eTogY2FyZC5kaWZmaWN1bHR5LFxuICAgICAgICBlbGFwc2VkX2RheXMsXG4gICAgICAgIGxhc3RfZWxhcHNlZF9kYXlzOiBjYXJkLmVsYXBzZWRfZGF5cyxcbiAgICAgICAgc2NoZWR1bGVkX2RheXM6IGNhcmQuc2NoZWR1bGVkX2RheXMsXG4gICAgICAgIGxlYXJuaW5nX3N0ZXBzOiBjYXJkLmxlYXJuaW5nX3N0ZXBzLFxuICAgICAgICByZXZpZXc6IHJldmlld2VkXG4gICAgICB9O1xuICAgICAgbmV4dF9jYXJkID0ge1xuICAgICAgICAuLi5jYXJkLFxuICAgICAgICBzdGF0ZSxcbiAgICAgICAgZHVlLFxuICAgICAgICBsYXN0X3JldmlldzogcmV2aWV3ZWQsXG4gICAgICAgIHN0YWJpbGl0eTogc3RhYmlsaXR5IHx8IGNhcmQuc3RhYmlsaXR5LFxuICAgICAgICBkaWZmaWN1bHR5OiBkaWZmaWN1bHR5IHx8IGNhcmQuZGlmZmljdWx0eSxcbiAgICAgICAgZWxhcHNlZF9kYXlzLFxuICAgICAgICBzY2hlZHVsZWRfZGF5cyxcbiAgICAgICAgcmVwczogY2FyZC5yZXBzICsgMVxuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIHsgY2FyZDogbmV4dF9jYXJkLCBsb2cgfTtcbiAgfVxuICAvKipcbiAgICogUmVzY2hlZHVsZXMgYSBjYXJkIGJhc2VkIG9uIGl0cyByZXZpZXcgaGlzdG9yeS5cbiAgICpcbiAgICogQHBhcmFtIGN1cnJlbnRfY2FyZCAtIFRoZSBjYXJkIHRvIGJlIHJlc2NoZWR1bGVkLlxuICAgKiBAcGFyYW0gcmV2aWV3cyAtIEFuIGFycmF5IG9mIHJldmlldyBoaXN0b3J5IG9iamVjdHMuXG4gICAqIEByZXR1cm5zIEFuIGFycmF5IG9mIHJlY29yZCBsb2cgaXRlbXMgcmVwcmVzZW50aW5nIHRoZSByZXNjaGVkdWxpbmcgcHJvY2Vzcy5cbiAgICovXG4gIHJlc2NoZWR1bGUoY3VycmVudF9jYXJkLCByZXZpZXdzKSB7XG4gICAgY29uc3QgY29sbGVjdGlvbnMgPSBbXTtcbiAgICBsZXQgY3VyX2NhcmQgPSBjcmVhdGVFbXB0eUNhcmQoY3VycmVudF9jYXJkLmR1ZSk7XG4gICAgZm9yIChjb25zdCByZXZpZXcgb2YgcmV2aWV3cykge1xuICAgICAgbGV0IGl0ZW07XG4gICAgICByZXZpZXcucmV2aWV3ID0gVHlwZUNvbnZlcnQudGltZShyZXZpZXcucmV2aWV3KTtcbiAgICAgIGlmIChyZXZpZXcucmF0aW5nID09PSBSYXRpbmcuTWFudWFsKSB7XG4gICAgICAgIGxldCBpbnRlcnZhbCA9IDA7XG4gICAgICAgIGlmIChjdXJfY2FyZC5zdGF0ZSAhPT0gU3RhdGUuTmV3ICYmIGN1cl9jYXJkLmxhc3RfcmV2aWV3KSB7XG4gICAgICAgICAgaW50ZXJ2YWwgPSBkYXRlX2RpZmYocmV2aWV3LnJldmlldywgY3VyX2NhcmQubGFzdF9yZXZpZXcsIFwiZGF5c1wiKTtcbiAgICAgICAgfVxuICAgICAgICBpdGVtID0gdGhpcy5oYW5kbGVNYW51YWxSYXRpbmcoXG4gICAgICAgICAgY3VyX2NhcmQsXG4gICAgICAgICAgcmV2aWV3LnN0YXRlLFxuICAgICAgICAgIHJldmlldy5yZXZpZXcsXG4gICAgICAgICAgaW50ZXJ2YWwsXG4gICAgICAgICAgcmV2aWV3LnN0YWJpbGl0eSxcbiAgICAgICAgICByZXZpZXcuZGlmZmljdWx0eSxcbiAgICAgICAgICByZXZpZXcuZHVlID8gVHlwZUNvbnZlcnQudGltZShyZXZpZXcuZHVlKSA6IHZvaWQgMFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaXRlbSA9IHRoaXMucmVwbGF5KGN1cl9jYXJkLCByZXZpZXcucmV2aWV3LCByZXZpZXcucmF0aW5nKTtcbiAgICAgIH1cbiAgICAgIGNvbGxlY3Rpb25zLnB1c2goaXRlbSk7XG4gICAgICBjdXJfY2FyZCA9IGl0ZW0uY2FyZDtcbiAgICB9XG4gICAgcmV0dXJuIGNvbGxlY3Rpb25zO1xuICB9XG4gIGNhbGN1bGF0ZU1hbnVhbFJlY29yZChjdXJyZW50X2NhcmQsIG5vdywgcmVjb3JkX2xvZ19pdGVtLCB1cGRhdGVfbWVtb3J5KSB7XG4gICAgaWYgKCFyZWNvcmRfbG9nX2l0ZW0pIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCB7IGNhcmQ6IHJlc2NoZWR1bGVfY2FyZCwgbG9nIH0gPSByZWNvcmRfbG9nX2l0ZW07XG4gICAgY29uc3QgY3VyX2NhcmQgPSBUeXBlQ29udmVydC5jYXJkKGN1cnJlbnRfY2FyZCk7XG4gICAgaWYgKGN1cl9jYXJkLmR1ZS5nZXRUaW1lKCkgPT09IHJlc2NoZWR1bGVfY2FyZC5kdWUuZ2V0VGltZSgpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY3VyX2NhcmQuc2NoZWR1bGVkX2RheXMgPSBkYXRlX2RpZmYoXG4gICAgICByZXNjaGVkdWxlX2NhcmQuZHVlLFxuICAgICAgY3VyX2NhcmQuZHVlLFxuICAgICAgXCJkYXlzXCJcbiAgICApO1xuICAgIHJldHVybiB0aGlzLmhhbmRsZU1hbnVhbFJhdGluZyhcbiAgICAgIGN1cl9jYXJkLFxuICAgICAgcmVzY2hlZHVsZV9jYXJkLnN0YXRlLFxuICAgICAgVHlwZUNvbnZlcnQudGltZShub3cpLFxuICAgICAgbG9nLmVsYXBzZWRfZGF5cyxcbiAgICAgIHVwZGF0ZV9tZW1vcnkgPyByZXNjaGVkdWxlX2NhcmQuc3RhYmlsaXR5IDogdm9pZCAwLFxuICAgICAgdXBkYXRlX21lbW9yeSA/IHJlc2NoZWR1bGVfY2FyZC5kaWZmaWN1bHR5IDogdm9pZCAwLFxuICAgICAgcmVzY2hlZHVsZV9jYXJkLmR1ZVxuICAgICk7XG4gIH1cbn1cblxuZnVuY3Rpb24gYXBwbHlBZnRlckhhbmRsZXIodmFsdWUsIGFmdGVySGFuZGxlcikge1xuICByZXR1cm4gdHlwZW9mIGFmdGVySGFuZGxlciA9PT0gXCJmdW5jdGlvblwiID8gYWZ0ZXJIYW5kbGVyKHZhbHVlKSA6IHZhbHVlO1xufVxuY2xhc3MgRlNSUyBleHRlbmRzIEZTUlNBbGdvcml0aG0ge1xuICBzdHJhdGVneUhhbmRsZXIgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xuICBTY2hlZHVsZXI7XG4gIGNvbnN0cnVjdG9yKHBhcmFtKSB7XG4gICAgc3VwZXIocGFyYW0pO1xuICAgIGNvbnN0IHsgZW5hYmxlX3Nob3J0X3Rlcm0gfSA9IHRoaXMucGFyYW1ldGVycztcbiAgICB0aGlzLlNjaGVkdWxlciA9IGVuYWJsZV9zaG9ydF90ZXJtID8gQmFzaWNTY2hlZHVsZXIgOiBMb25nVGVybVNjaGVkdWxlcjtcbiAgfVxuICBwYXJhbXNfaGFuZGxlcl9wcm94eSgpIHtcbiAgICBjb25zdCBfdGhpcyA9IHRoaXM7XG4gICAgcmV0dXJuIHtcbiAgICAgIHNldDogZnVuY3Rpb24odGFyZ2V0LCBwcm9wLCB2YWx1ZSkge1xuICAgICAgICBpZiAocHJvcCA9PT0gXCJyZXF1ZXN0X3JldGVudGlvblwiICYmIE51bWJlci5pc0Zpbml0ZSh2YWx1ZSkpIHtcbiAgICAgICAgICBfdGhpcy5pbnRlcnZhbE1vZGlmaWVyID0gX3RoaXMuY2FsY3VsYXRlX2ludGVydmFsX21vZGlmaWVyKFxuICAgICAgICAgICAgTnVtYmVyKHZhbHVlKVxuICAgICAgICAgICk7XG4gICAgICAgIH0gZWxzZSBpZiAocHJvcCA9PT0gXCJlbmFibGVfc2hvcnRfdGVybVwiKSB7XG4gICAgICAgICAgX3RoaXMuU2NoZWR1bGVyID0gdmFsdWUgPT09IHRydWUgPyBCYXNpY1NjaGVkdWxlciA6IExvbmdUZXJtU2NoZWR1bGVyO1xuICAgICAgICB9IGVsc2UgaWYgKHByb3AgPT09IFwid1wiKSB7XG4gICAgICAgICAgdmFsdWUgPSBtaWdyYXRlUGFyYW1ldGVycyhcbiAgICAgICAgICAgIHZhbHVlLFxuICAgICAgICAgICAgdGFyZ2V0LnJlbGVhcm5pbmdfc3RlcHMubGVuZ3RoLFxuICAgICAgICAgICAgdGFyZ2V0LmVuYWJsZV9zaG9ydF90ZXJtXG4gICAgICAgICAgKTtcbiAgICAgICAgICBfdGhpcy5mb3JnZXR0aW5nX2N1cnZlID0gZm9yZ2V0dGluZ19jdXJ2ZS5iaW5kKHRoaXMsIHZhbHVlKTtcbiAgICAgICAgICBfdGhpcy5pbnRlcnZhbE1vZGlmaWVyID0gX3RoaXMuY2FsY3VsYXRlX2ludGVydmFsX21vZGlmaWVyKFxuICAgICAgICAgICAgTnVtYmVyKHRhcmdldC5yZXF1ZXN0X3JldGVudGlvbilcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIFJlZmxlY3Quc2V0KHRhcmdldCwgcHJvcCwgdmFsdWUpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG4gIHVzZVN0cmF0ZWd5KG1vZGUsIGhhbmRsZXIpIHtcbiAgICB0aGlzLnN0cmF0ZWd5SGFuZGxlci5zZXQobW9kZSwgaGFuZGxlcik7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgY2xlYXJTdHJhdGVneShtb2RlKSB7XG4gICAgaWYgKG1vZGUpIHtcbiAgICAgIHRoaXMuc3RyYXRlZ3lIYW5kbGVyLmRlbGV0ZShtb2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zdHJhdGVneUhhbmRsZXIuY2xlYXIoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgZ2V0U2NoZWR1bGVyKGNhcmQsIG5vdykge1xuICAgIGNvbnN0IHNjaGVkdWxlclN0cmF0ZWd5ID0gdGhpcy5zdHJhdGVneUhhbmRsZXIuZ2V0KFxuICAgICAgU3RyYXRlZ3lNb2RlLlNDSEVEVUxFUlxuICAgICk7XG4gICAgY29uc3QgU2NoZWR1bGVyID0gc2NoZWR1bGVyU3RyYXRlZ3kgfHwgdGhpcy5TY2hlZHVsZXI7XG4gICAgY29uc3QgaW5zdGFuY2UgPSBuZXcgU2NoZWR1bGVyKGNhcmQsIG5vdywgdGhpcywgdGhpcy5zdHJhdGVneUhhbmRsZXIpO1xuICAgIHJldHVybiBpbnN0YW5jZTtcbiAgfVxuICAvKipcbiAgICogRGlzcGxheSB0aGUgY29sbGVjdGlvbiBvZiBjYXJkcyBhbmQgbG9ncyBmb3IgdGhlIGZvdXIgc2NlbmFyaW9zIGFmdGVyIHNjaGVkdWxpbmcgdGhlIGNhcmQgYXQgdGhlIGN1cnJlbnQgdGltZS5cbiAgICogQHBhcmFtIGNhcmQgQ2FyZCB0byBiZSBwcm9jZXNzZWRcbiAgICogQHBhcmFtIG5vdyBDdXJyZW50IHRpbWUgb3Igc2NoZWR1bGVkIHRpbWVcbiAgICogQHBhcmFtIGFmdGVySGFuZGxlciBDb252ZXJ0IHRoZSByZXN1bHQgdG8gYW5vdGhlciB0eXBlLiAoT3B0aW9uYWwpXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYHR5cGVzY3JpcHRcbiAgICogY29uc3QgY2FyZDogQ2FyZCA9IGNyZWF0ZUVtcHR5Q2FyZChuZXcgRGF0ZSgpKTtcbiAgICogY29uc3QgZiA9IGZzcnMoKTtcbiAgICogY29uc3QgcmVjb3JkTG9nID0gZi5yZXBlYXQoY2FyZCwgbmV3IERhdGUoKSk7XG4gICAqIGBgYFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0eXBlc2NyaXB0XG4gICAqIGludGVyZmFjZSBSZXZMb2dVbmNoZWNrZWRcbiAgICogICBleHRlbmRzIE9taXQ8UmV2aWV3TG9nLCBcImR1ZVwiIHwgXCJyZXZpZXdcIiB8IFwic3RhdGVcIiB8IFwicmF0aW5nXCI+IHtcbiAgICogICBjaWQ6IHN0cmluZztcbiAgICogICBkdWU6IERhdGUgfCBudW1iZXI7XG4gICAqICAgc3RhdGU6IFN0YXRlVHlwZTtcbiAgICogICByZXZpZXc6IERhdGUgfCBudW1iZXI7XG4gICAqICAgcmF0aW5nOiBSYXRpbmdUeXBlO1xuICAgKiB9XG4gICAqXG4gICAqIGludGVyZmFjZSBSZXBlYXRSZWNvcmRMb2cge1xuICAgKiAgIGNhcmQ6IENhcmRVbkNoZWNrZWQ7IC8vc2VlIG1ldGhvZDogY3JlYXRlRW1wdHlDYXJkXG4gICAqICAgbG9nOiBSZXZMb2dVbmNoZWNrZWQ7XG4gICAqIH1cbiAgICpcbiAgICogZnVuY3Rpb24gcmVwZWF0QWZ0ZXJIYW5kbGVyKHJlY29yZExvZzogUmVjb3JkTG9nKSB7XG4gICAqICAgICBjb25zdCByZWNvcmQ6IHsgW2tleSBpbiBHcmFkZV06IFJlcGVhdFJlY29yZExvZyB9ID0ge30gYXMge1xuICAgKiAgICAgICBba2V5IGluIEdyYWRlXTogUmVwZWF0UmVjb3JkTG9nO1xuICAgKiAgICAgfTtcbiAgICogICAgIGZvciAoY29uc3QgZ3JhZGUgb2YgR3JhZGVzKSB7XG4gICAqICAgICAgIHJlY29yZFtncmFkZV0gPSB7XG4gICAqICAgICAgICAgY2FyZDoge1xuICAgKiAgICAgICAgICAgLi4uKHJlY29yZExvZ1tncmFkZV0uY2FyZCBhcyBDYXJkICYgeyBjaWQ6IHN0cmluZyB9KSxcbiAgICogICAgICAgICAgIGR1ZTogcmVjb3JkTG9nW2dyYWRlXS5jYXJkLmR1ZS5nZXRUaW1lKCksXG4gICAqICAgICAgICAgICBzdGF0ZTogU3RhdGVbcmVjb3JkTG9nW2dyYWRlXS5jYXJkLnN0YXRlXSBhcyBTdGF0ZVR5cGUsXG4gICAqICAgICAgICAgICBsYXN0X3JldmlldzogcmVjb3JkTG9nW2dyYWRlXS5jYXJkLmxhc3RfcmV2aWV3XG4gICAqICAgICAgICAgICAgID8gcmVjb3JkTG9nW2dyYWRlXS5jYXJkLmxhc3RfcmV2aWV3IS5nZXRUaW1lKClcbiAgICogICAgICAgICAgICAgOiBudWxsLFxuICAgKiAgICAgICAgIH0sXG4gICAqICAgICAgICAgbG9nOiB7XG4gICAqICAgICAgICAgICAuLi5yZWNvcmRMb2dbZ3JhZGVdLmxvZyxcbiAgICogICAgICAgICAgIGNpZDogKHJlY29yZExvZ1tncmFkZV0uY2FyZCBhcyBDYXJkICYgeyBjaWQ6IHN0cmluZyB9KS5jaWQsXG4gICAqICAgICAgICAgICBkdWU6IHJlY29yZExvZ1tncmFkZV0ubG9nLmR1ZS5nZXRUaW1lKCksXG4gICAqICAgICAgICAgICByZXZpZXc6IHJlY29yZExvZ1tncmFkZV0ubG9nLnJldmlldy5nZXRUaW1lKCksXG4gICAqICAgICAgICAgICBzdGF0ZTogU3RhdGVbcmVjb3JkTG9nW2dyYWRlXS5sb2cuc3RhdGVdIGFzIFN0YXRlVHlwZSxcbiAgICogICAgICAgICAgIHJhdGluZzogUmF0aW5nW3JlY29yZExvZ1tncmFkZV0ubG9nLnJhdGluZ10gYXMgUmF0aW5nVHlwZSxcbiAgICogICAgICAgICB9LFxuICAgKiAgICAgICB9O1xuICAgKiAgICAgfVxuICAgKiAgICAgcmV0dXJuIHJlY29yZDtcbiAgICogfVxuICAgKiBjb25zdCBjYXJkOiBDYXJkID0gY3JlYXRlRW1wdHlDYXJkKG5ldyBEYXRlKCksIGNhcmRBZnRlckhhbmRsZXIpOyAvL3NlZSBtZXRob2Q6ICBjcmVhdGVFbXB0eUNhcmRcbiAgICogY29uc3QgZiA9IGZzcnMoKTtcbiAgICogY29uc3QgcmVjb3JkTG9nID0gZi5yZXBlYXQoY2FyZCwgbmV3IERhdGUoKSwgcmVwZWF0QWZ0ZXJIYW5kbGVyKTtcbiAgICogYGBgXG4gICAqL1xuICByZXBlYXQoY2FyZCwgbm93LCBhZnRlckhhbmRsZXIpIHtcbiAgICBjb25zdCBpbnN0YW5jZSA9IHRoaXMuZ2V0U2NoZWR1bGVyKGNhcmQsIG5vdyk7XG4gICAgY29uc3QgcmVjb3JkTG9nID0gaW5zdGFuY2UucHJldmlldygpO1xuICAgIHJldHVybiBhcHBseUFmdGVySGFuZGxlcihyZWNvcmRMb2csIGFmdGVySGFuZGxlcik7XG4gIH1cbiAgLyoqXG4gICAqIERpc3BsYXkgdGhlIGNvbGxlY3Rpb24gb2YgY2FyZHMgYW5kIGxvZ3MgZm9yIHRoZSBjYXJkIHNjaGVkdWxlZCBhdCB0aGUgY3VycmVudCB0aW1lLCBhZnRlciBhcHBseWluZyBhIHNwZWNpZmljIGdyYWRlIHJhdGluZy5cbiAgICogQHBhcmFtIGNhcmQgQ2FyZCB0byBiZSBwcm9jZXNzZWRcbiAgICogQHBhcmFtIG5vdyBDdXJyZW50IHRpbWUgb3Igc2NoZWR1bGVkIHRpbWVcbiAgICogQHBhcmFtIGdyYWRlIFJhdGluZyBvZiB0aGUgcmV2aWV3IChBZ2FpbiwgSGFyZCwgR29vZCwgRWFzeSlcbiAgICogQHBhcmFtIGFmdGVySGFuZGxlciBDb252ZXJ0IHRoZSByZXN1bHQgdG8gYW5vdGhlciB0eXBlLiAoT3B0aW9uYWwpXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYHR5cGVzY3JpcHRcbiAgICogY29uc3QgY2FyZDogQ2FyZCA9IGNyZWF0ZUVtcHR5Q2FyZChuZXcgRGF0ZSgpKTtcbiAgICogY29uc3QgZiA9IGZzcnMoKTtcbiAgICogY29uc3QgcmVjb3JkTG9nSXRlbSA9IGYubmV4dChjYXJkLCBuZXcgRGF0ZSgpLCBSYXRpbmcuQWdhaW4pO1xuICAgKiBgYGBcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHlwZXNjcmlwdFxuICAgKiBpbnRlcmZhY2UgUmV2TG9nVW5jaGVja2VkXG4gICAqICAgZXh0ZW5kcyBPbWl0PFJldmlld0xvZywgXCJkdWVcIiB8IFwicmV2aWV3XCIgfCBcInN0YXRlXCIgfCBcInJhdGluZ1wiPiB7XG4gICAqICAgY2lkOiBzdHJpbmc7XG4gICAqICAgZHVlOiBEYXRlIHwgbnVtYmVyO1xuICAgKiAgIHN0YXRlOiBTdGF0ZVR5cGU7XG4gICAqICAgcmV2aWV3OiBEYXRlIHwgbnVtYmVyO1xuICAgKiAgIHJhdGluZzogUmF0aW5nVHlwZTtcbiAgICogfVxuICAgKlxuICAgKiBpbnRlcmZhY2UgTmV4dFJlY29yZExvZyB7XG4gICAqICAgY2FyZDogQ2FyZFVuQ2hlY2tlZDsgLy9zZWUgbWV0aG9kOiBjcmVhdGVFbXB0eUNhcmRcbiAgICogICBsb2c6IFJldkxvZ1VuY2hlY2tlZDtcbiAgICogfVxuICAgKlxuICBmdW5jdGlvbiBuZXh0QWZ0ZXJIYW5kbGVyKHJlY29yZExvZ0l0ZW06IFJlY29yZExvZ0l0ZW0pIHtcbiAgICBjb25zdCByZWNvcmRJdGVtID0ge1xuICAgICAgY2FyZDoge1xuICAgICAgICAuLi4ocmVjb3JkTG9nSXRlbS5jYXJkIGFzIENhcmQgJiB7IGNpZDogc3RyaW5nIH0pLFxuICAgICAgICBkdWU6IHJlY29yZExvZ0l0ZW0uY2FyZC5kdWUuZ2V0VGltZSgpLFxuICAgICAgICBzdGF0ZTogU3RhdGVbcmVjb3JkTG9nSXRlbS5jYXJkLnN0YXRlXSBhcyBTdGF0ZVR5cGUsXG4gICAgICAgIGxhc3RfcmV2aWV3OiByZWNvcmRMb2dJdGVtLmNhcmQubGFzdF9yZXZpZXdcbiAgICAgICAgICA/IHJlY29yZExvZ0l0ZW0uY2FyZC5sYXN0X3JldmlldyEuZ2V0VGltZSgpXG4gICAgICAgICAgOiBudWxsLFxuICAgICAgfSxcbiAgICAgIGxvZzoge1xuICAgICAgICAuLi5yZWNvcmRMb2dJdGVtLmxvZyxcbiAgICAgICAgY2lkOiAocmVjb3JkTG9nSXRlbS5jYXJkIGFzIENhcmQgJiB7IGNpZDogc3RyaW5nIH0pLmNpZCxcbiAgICAgICAgZHVlOiByZWNvcmRMb2dJdGVtLmxvZy5kdWUuZ2V0VGltZSgpLFxuICAgICAgICByZXZpZXc6IHJlY29yZExvZ0l0ZW0ubG9nLnJldmlldy5nZXRUaW1lKCksXG4gICAgICAgIHN0YXRlOiBTdGF0ZVtyZWNvcmRMb2dJdGVtLmxvZy5zdGF0ZV0gYXMgU3RhdGVUeXBlLFxuICAgICAgICByYXRpbmc6IFJhdGluZ1tyZWNvcmRMb2dJdGVtLmxvZy5yYXRpbmddIGFzIFJhdGluZ1R5cGUsXG4gICAgICB9LFxuICAgIH07XG4gICAgcmV0dXJuIHJlY29yZEl0ZW1cbiAgfVxuICAgKiBjb25zdCBjYXJkOiBDYXJkID0gY3JlYXRlRW1wdHlDYXJkKG5ldyBEYXRlKCksIGNhcmRBZnRlckhhbmRsZXIpOyAvL3NlZSBtZXRob2Q6ICBjcmVhdGVFbXB0eUNhcmRcbiAgICogY29uc3QgZiA9IGZzcnMoKTtcbiAgICogY29uc3QgcmVjb3JkTG9nSXRlbSA9IGYucmVwZWF0KGNhcmQsIG5ldyBEYXRlKCksIFJhdGluZy5BZ2FpbiwgbmV4dEFmdGVySGFuZGxlcik7XG4gICAqIGBgYFxuICAgKi9cbiAgbmV4dChjYXJkLCBub3csIGdyYWRlLCBhZnRlckhhbmRsZXIpIHtcbiAgICBjb25zdCBpbnN0YW5jZSA9IHRoaXMuZ2V0U2NoZWR1bGVyKGNhcmQsIG5vdyk7XG4gICAgY29uc3QgZyA9IFR5cGVDb252ZXJ0LnJhdGluZyhncmFkZSk7XG4gICAgaWYgKGcgPT09IFJhdGluZy5NYW51YWwpIHtcbiAgICAgIHRocm93IG5ldyBGU1JTVmFsaWRhdGlvbkVycm9yKFwiQ2Fubm90IHJldmlldyBhIG1hbnVhbCByYXRpbmdcIik7XG4gICAgfVxuICAgIGNvbnN0IHJlY29yZExvZ0l0ZW0gPSBpbnN0YW5jZS5yZXZpZXcoZyk7XG4gICAgcmV0dXJuIGFwcGx5QWZ0ZXJIYW5kbGVyKHJlY29yZExvZ0l0ZW0sIGFmdGVySGFuZGxlcik7XG4gIH1cbiAgLyoqXG4gICAqIEdldCB0aGUgcmV0cmlldmFiaWxpdHkgb2YgdGhlIGNhcmRcbiAgICogQHBhcmFtIGNhcmQgIENhcmQgdG8gYmUgcHJvY2Vzc2VkXG4gICAqIEBwYXJhbSBub3cgIEN1cnJlbnQgdGltZSBvciBzY2hlZHVsZWQgdGltZVxuICAgKiBAcGFyYW0gZm9ybWF0ICBkZWZhdWx0OnRydWUgLCBDb252ZXJ0IHRoZSByZXN1bHQgdG8gYW5vdGhlciB0eXBlLiAoT3B0aW9uYWwpXG4gICAqIEByZXR1cm5zICBUaGUgcmV0cmlldmFiaWxpdHkgb2YgdGhlIGNhcmQsaWYgZm9ybWF0IGlzIHRydWUsIHRoZSByZXN1bHQgaXMgYSBzdHJpbmcsIG90aGVyd2lzZSBpdCBpcyBhIG51bWJlclxuICAgKi9cbiAgZ2V0X3JldHJpZXZhYmlsaXR5KGNhcmQsIG5vdywgZm9ybWF0ID0gdHJ1ZSkge1xuICAgIGNvbnN0IHByb2Nlc3NlZENhcmQgPSBUeXBlQ29udmVydC5jYXJkKGNhcmQpO1xuICAgIG5vdyA9IG5vdyA/IFR5cGVDb252ZXJ0LnRpbWUobm93KSA6IC8qIEBfX1BVUkVfXyAqLyBuZXcgRGF0ZSgpO1xuICAgIGNvbnN0IHQgPSBwcm9jZXNzZWRDYXJkLnN0YXRlICE9PSBTdGF0ZS5OZXcgPyBNYXRoLm1heChkYXRlX2RpZmYobm93LCBwcm9jZXNzZWRDYXJkLmxhc3RfcmV2aWV3LCBcImRheXNcIiksIDApIDogMDtcbiAgICBjb25zdCByID0gcHJvY2Vzc2VkQ2FyZC5zdGF0ZSAhPT0gU3RhdGUuTmV3ID8gdGhpcy5mb3JnZXR0aW5nX2N1cnZlKHQsICtwcm9jZXNzZWRDYXJkLnN0YWJpbGl0eS50b0ZpeGVkKDgpKSA6IDA7XG4gICAgcmV0dXJuIGZvcm1hdCA/IGAkeyhyICogMTAwKS50b0ZpeGVkKDIpfSVgIDogcjtcbiAgfVxuICAvKipcbiAgICpcbiAgICogQHBhcmFtIGNhcmQgQ2FyZCB0byBiZSBwcm9jZXNzZWRcbiAgICogQHBhcmFtIGxvZyBsYXN0IHJldmlldyBsb2dcbiAgICogQHBhcmFtIGFmdGVySGFuZGxlciBDb252ZXJ0IHRoZSByZXN1bHQgdG8gYW5vdGhlciB0eXBlLiAoT3B0aW9uYWwpXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYHR5cGVzY3JpcHRcbiAgICogY29uc3Qgbm93ID0gbmV3IERhdGUoKTtcbiAgICogY29uc3QgZiA9IGZzcnMoKTtcbiAgICogY29uc3QgZW1wdHlDYXJkRm9ybUFmdGVySGFuZGxlciA9IGNyZWF0ZUVtcHR5Q2FyZChub3cpO1xuICAgKiBjb25zdCByZXBlYXRGb3JtQWZ0ZXJIYW5kbGVyID0gZi5yZXBlYXQoZW1wdHlDYXJkRm9ybUFmdGVySGFuZGxlciwgbm93KTtcbiAgICogY29uc3QgeyBjYXJkLCBsb2cgfSA9IHJlcGVhdEZvcm1BZnRlckhhbmRsZXJbUmF0aW5nLkhhcmRdO1xuICAgKiBjb25zdCByb2xsYmFja0Zyb21BZnRlckhhbmRsZXIgPSBmLnJvbGxiYWNrKGNhcmQsIGxvZyk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0eXBlc2NyaXB0XG4gICAqIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XG4gICAqIGNvbnN0IGYgPSBmc3JzKCk7XG4gICAqIGNvbnN0IGVtcHR5Q2FyZEZvcm1BZnRlckhhbmRsZXIgPSBjcmVhdGVFbXB0eUNhcmQobm93LCBjYXJkQWZ0ZXJIYW5kbGVyKTsgIC8vc2VlIG1ldGhvZDogY3JlYXRlRW1wdHlDYXJkXG4gICAqIGNvbnN0IHJlcGVhdEZvcm1BZnRlckhhbmRsZXIgPSBmLnJlcGVhdChlbXB0eUNhcmRGb3JtQWZ0ZXJIYW5kbGVyLCBub3csIHJlcGVhdEFmdGVySGFuZGxlcik7IC8vc2VlIG1ldGhvZDogZnNycy5yZXBlYXQoKVxuICAgKiBjb25zdCB7IGNhcmQsIGxvZyB9ID0gcmVwZWF0Rm9ybUFmdGVySGFuZGxlcltSYXRpbmcuSGFyZF07XG4gICAqIGNvbnN0IHJvbGxiYWNrRnJvbUFmdGVySGFuZGxlciA9IGYucm9sbGJhY2soY2FyZCwgbG9nLCBjYXJkQWZ0ZXJIYW5kbGVyKTtcbiAgICogYGBgXG4gICAqL1xuICByb2xsYmFjayhjYXJkLCBsb2csIGFmdGVySGFuZGxlcikge1xuICAgIGNvbnN0IHByb2Nlc3NlZENhcmQgPSBUeXBlQ29udmVydC5jYXJkKGNhcmQpO1xuICAgIGNvbnN0IHByb2Nlc3NlZExvZyA9IFR5cGVDb252ZXJ0LnJldmlld19sb2cobG9nKTtcbiAgICBpZiAocHJvY2Vzc2VkTG9nLnJhdGluZyA9PT0gUmF0aW5nLk1hbnVhbCkge1xuICAgICAgdGhyb3cgbmV3IEZTUlNWYWxpZGF0aW9uRXJyb3IoXCJDYW5ub3Qgcm9sbGJhY2sgYSBtYW51YWwgcmF0aW5nXCIpO1xuICAgIH1cbiAgICBsZXQgbGFzdF9kdWU7XG4gICAgbGV0IGxhc3RfcmV2aWV3O1xuICAgIGxldCBsYXN0X2xhcHNlcztcbiAgICBzd2l0Y2ggKHByb2Nlc3NlZExvZy5zdGF0ZSkge1xuICAgICAgY2FzZSBTdGF0ZS5OZXc6XG4gICAgICAgIGxhc3RfZHVlID0gcHJvY2Vzc2VkTG9nLmR1ZTtcbiAgICAgICAgbGFzdF9yZXZpZXcgPSB2b2lkIDA7XG4gICAgICAgIGxhc3RfbGFwc2VzID0gMDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLkxlYXJuaW5nOlxuICAgICAgY2FzZSBTdGF0ZS5SZWxlYXJuaW5nOlxuICAgICAgY2FzZSBTdGF0ZS5SZXZpZXc6XG4gICAgICAgIGxhc3RfZHVlID0gcHJvY2Vzc2VkTG9nLnJldmlldztcbiAgICAgICAgbGFzdF9yZXZpZXcgPSBwcm9jZXNzZWRMb2cuZHVlO1xuICAgICAgICBsYXN0X2xhcHNlcyA9IHByb2Nlc3NlZENhcmQubGFwc2VzIC0gKHByb2Nlc3NlZExvZy5yYXRpbmcgPT09IFJhdGluZy5BZ2FpbiAmJiBwcm9jZXNzZWRMb2cuc3RhdGUgPT09IFN0YXRlLlJldmlldyA/IDEgOiAwKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNvbnN0IHByZXZDYXJkID0ge1xuICAgICAgLi4ucHJvY2Vzc2VkQ2FyZCxcbiAgICAgIGR1ZTogbGFzdF9kdWUsXG4gICAgICBzdGFiaWxpdHk6IHByb2Nlc3NlZExvZy5zdGFiaWxpdHksXG4gICAgICBkaWZmaWN1bHR5OiBwcm9jZXNzZWRMb2cuZGlmZmljdWx0eSxcbiAgICAgIGVsYXBzZWRfZGF5czogcHJvY2Vzc2VkTG9nLmxhc3RfZWxhcHNlZF9kYXlzLFxuICAgICAgc2NoZWR1bGVkX2RheXM6IHByb2Nlc3NlZExvZy5zY2hlZHVsZWRfZGF5cyxcbiAgICAgIHJlcHM6IE1hdGgubWF4KDAsIHByb2Nlc3NlZENhcmQucmVwcyAtIDEpLFxuICAgICAgbGFwc2VzOiBNYXRoLm1heCgwLCBsYXN0X2xhcHNlcyksXG4gICAgICBsZWFybmluZ19zdGVwczogcHJvY2Vzc2VkTG9nLmxlYXJuaW5nX3N0ZXBzLFxuICAgICAgc3RhdGU6IHByb2Nlc3NlZExvZy5zdGF0ZSxcbiAgICAgIGxhc3RfcmV2aWV3XG4gICAgfTtcbiAgICByZXR1cm4gYXBwbHlBZnRlckhhbmRsZXIocHJldkNhcmQsIGFmdGVySGFuZGxlcik7XG4gIH1cbiAgLyoqXG4gICAqXG4gICAqIEBwYXJhbSBjYXJkIENhcmQgdG8gYmUgcHJvY2Vzc2VkXG4gICAqIEBwYXJhbSBub3cgQ3VycmVudCB0aW1lIG9yIHNjaGVkdWxlZCB0aW1lXG4gICAqIEBwYXJhbSByZXNldF9jb3VudCBTaG91bGQgdGhlIHJldmlldyBjb3VudCBpbmZvcm1hdGlvbihyZXBzLGxhcHNlcykgYmUgcmVzZXQuIChPcHRpb25hbClcbiAgICogQHBhcmFtIGFmdGVySGFuZGxlciBDb252ZXJ0IHRoZSByZXN1bHQgdG8gYW5vdGhlciB0eXBlLiAoT3B0aW9uYWwpXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYHR5cGVzY3JpcHRcbiAgICogY29uc3Qgbm93ID0gbmV3IERhdGUoKTtcbiAgICogY29uc3QgZiA9IGZzcnMoKTtcbiAgICogY29uc3QgZW1wdHlDYXJkID0gY3JlYXRlRW1wdHlDYXJkKG5vdyk7XG4gICAqIGNvbnN0IHNjaGVkdWxpbmdfY2FyZHMgPSBmLnJlcGVhdChlbXB0eUNhcmQsIG5vdyk7XG4gICAqIGNvbnN0IHsgY2FyZCwgbG9nIH0gPSBzY2hlZHVsaW5nX2NhcmRzW1JhdGluZy5IYXJkXTtcbiAgICogY29uc3QgZm9yZ2V0Q2FyZCA9IGYuZm9yZ2V0KGNhcmQsIG5ldyBEYXRlKCksIHRydWUpO1xuICAgKiBgYGBcbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHlwZXNjcmlwdFxuICAgKiBpbnRlcmZhY2UgUmVwZWF0UmVjb3JkTG9nIHtcbiAgICogICBjYXJkOiBDYXJkVW5DaGVja2VkOyAvL3NlZSBtZXRob2Q6IGNyZWF0ZUVtcHR5Q2FyZFxuICAgKiAgIGxvZzogUmV2TG9nVW5jaGVja2VkOyAvL3NlZSBtZXRob2Q6IGZzcnMucmVwZWF0KClcbiAgICogfVxuICAgKlxuICAgKiBmdW5jdGlvbiBmb3JnZXRBZnRlckhhbmRsZXIocmVjb3JkTG9nSXRlbTogUmVjb3JkTG9nSXRlbSk6IFJlcGVhdFJlY29yZExvZyB7XG4gICAqICAgICByZXR1cm4ge1xuICAgKiAgICAgICBjYXJkOiB7XG4gICAqICAgICAgICAgLi4uKHJlY29yZExvZ0l0ZW0uY2FyZCBhcyBDYXJkICYgeyBjaWQ6IHN0cmluZyB9KSxcbiAgICogICAgICAgICBkdWU6IHJlY29yZExvZ0l0ZW0uY2FyZC5kdWUuZ2V0VGltZSgpLFxuICAgKiAgICAgICAgIHN0YXRlOiBTdGF0ZVtyZWNvcmRMb2dJdGVtLmNhcmQuc3RhdGVdIGFzIFN0YXRlVHlwZSxcbiAgICogICAgICAgICBsYXN0X3JldmlldzogcmVjb3JkTG9nSXRlbS5jYXJkLmxhc3RfcmV2aWV3XG4gICAqICAgICAgICAgICA/IHJlY29yZExvZ0l0ZW0uY2FyZC5sYXN0X3JldmlldyEuZ2V0VGltZSgpXG4gICAqICAgICAgICAgICA6IG51bGwsXG4gICAqICAgICAgIH0sXG4gICAqICAgICAgIGxvZzoge1xuICAgKiAgICAgICAgIC4uLnJlY29yZExvZ0l0ZW0ubG9nLFxuICAgKiAgICAgICAgIGNpZDogKHJlY29yZExvZ0l0ZW0uY2FyZCBhcyBDYXJkICYgeyBjaWQ6IHN0cmluZyB9KS5jaWQsXG4gICAqICAgICAgICAgZHVlOiByZWNvcmRMb2dJdGVtLmxvZy5kdWUuZ2V0VGltZSgpLFxuICAgKiAgICAgICAgIHJldmlldzogcmVjb3JkTG9nSXRlbS5sb2cucmV2aWV3LmdldFRpbWUoKSxcbiAgICogICAgICAgICBzdGF0ZTogU3RhdGVbcmVjb3JkTG9nSXRlbS5sb2cuc3RhdGVdIGFzIFN0YXRlVHlwZSxcbiAgICogICAgICAgICByYXRpbmc6IFJhdGluZ1tyZWNvcmRMb2dJdGVtLmxvZy5yYXRpbmddIGFzIFJhdGluZ1R5cGUsXG4gICAqICAgICAgIH0sXG4gICAqICAgICB9O1xuICAgKiB9XG4gICAqIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XG4gICAqIGNvbnN0IGYgPSBmc3JzKCk7XG4gICAqIGNvbnN0IGVtcHR5Q2FyZEZvcm1BZnRlckhhbmRsZXIgPSBjcmVhdGVFbXB0eUNhcmQobm93LCBjYXJkQWZ0ZXJIYW5kbGVyKTsgLy9zZWUgbWV0aG9kOiAgY3JlYXRlRW1wdHlDYXJkXG4gICAqIGNvbnN0IHJlcGVhdEZvcm1BZnRlckhhbmRsZXIgPSBmLnJlcGVhdChlbXB0eUNhcmRGb3JtQWZ0ZXJIYW5kbGVyLCBub3csIHJlcGVhdEFmdGVySGFuZGxlcik7IC8vc2VlIG1ldGhvZDogZnNycy5yZXBlYXQoKVxuICAgKiBjb25zdCB7IGNhcmQgfSA9IHJlcGVhdEZvcm1BZnRlckhhbmRsZXJbUmF0aW5nLkhhcmRdO1xuICAgKiBjb25zdCBmb3JnZXRGcm9tQWZ0ZXJIYW5kbGVyID0gZi5mb3JnZXQoY2FyZCwgZGF0ZV9zY2hlZHVsZXIobm93LCAxLCB0cnVlKSwgZmFsc2UsIGZvcmdldEFmdGVySGFuZGxlcik7XG4gICAqIGBgYFxuICAgKi9cbiAgZm9yZ2V0KGNhcmQsIG5vdywgcmVzZXRfY291bnQgPSBmYWxzZSwgYWZ0ZXJIYW5kbGVyKSB7XG4gICAgY29uc3QgcHJvY2Vzc2VkQ2FyZCA9IFR5cGVDb252ZXJ0LmNhcmQoY2FyZCk7XG4gICAgbm93ID0gVHlwZUNvbnZlcnQudGltZShub3cpO1xuICAgIGNvbnN0IHNjaGVkdWxlZF9kYXlzID0gcHJvY2Vzc2VkQ2FyZC5zdGF0ZSA9PT0gU3RhdGUuTmV3ID8gMCA6IGRhdGVfZGlmZihub3csIHByb2Nlc3NlZENhcmQuZHVlLCBcImRheXNcIik7XG4gICAgY29uc3QgZm9yZ2V0X2xvZyA9IHtcbiAgICAgIHJhdGluZzogUmF0aW5nLk1hbnVhbCxcbiAgICAgIHN0YXRlOiBwcm9jZXNzZWRDYXJkLnN0YXRlLFxuICAgICAgZHVlOiBwcm9jZXNzZWRDYXJkLmR1ZSxcbiAgICAgIHN0YWJpbGl0eTogcHJvY2Vzc2VkQ2FyZC5zdGFiaWxpdHksXG4gICAgICBkaWZmaWN1bHR5OiBwcm9jZXNzZWRDYXJkLmRpZmZpY3VsdHksXG4gICAgICBlbGFwc2VkX2RheXM6IDAsXG4gICAgICBsYXN0X2VsYXBzZWRfZGF5czogcHJvY2Vzc2VkQ2FyZC5lbGFwc2VkX2RheXMsXG4gICAgICBzY2hlZHVsZWRfZGF5cyxcbiAgICAgIGxlYXJuaW5nX3N0ZXBzOiBwcm9jZXNzZWRDYXJkLmxlYXJuaW5nX3N0ZXBzLFxuICAgICAgcmV2aWV3OiBub3dcbiAgICB9O1xuICAgIGNvbnN0IGZvcmdldF9jYXJkID0ge1xuICAgICAgLi4ucHJvY2Vzc2VkQ2FyZCxcbiAgICAgIGR1ZTogbm93LFxuICAgICAgc3RhYmlsaXR5OiAwLFxuICAgICAgZGlmZmljdWx0eTogMCxcbiAgICAgIGVsYXBzZWRfZGF5czogMCxcbiAgICAgIHNjaGVkdWxlZF9kYXlzOiAwLFxuICAgICAgcmVwczogcmVzZXRfY291bnQgPyAwIDogcHJvY2Vzc2VkQ2FyZC5yZXBzLFxuICAgICAgbGFwc2VzOiByZXNldF9jb3VudCA/IDAgOiBwcm9jZXNzZWRDYXJkLmxhcHNlcyxcbiAgICAgIGxlYXJuaW5nX3N0ZXBzOiAwLFxuICAgICAgc3RhdGU6IFN0YXRlLk5ldyxcbiAgICAgIGxhc3RfcmV2aWV3OiBwcm9jZXNzZWRDYXJkLmxhc3RfcmV2aWV3XG4gICAgfTtcbiAgICBjb25zdCByZWNvcmRMb2dJdGVtID0geyBjYXJkOiBmb3JnZXRfY2FyZCwgbG9nOiBmb3JnZXRfbG9nIH07XG4gICAgcmV0dXJuIGFwcGx5QWZ0ZXJIYW5kbGVyKHJlY29yZExvZ0l0ZW0sIGFmdGVySGFuZGxlcik7XG4gIH1cbiAgLyoqXG4gICAqIFJlc2NoZWR1bGVzIHRoZSBjdXJyZW50IGNhcmQgYW5kIHJldHVybnMgdGhlIHJlc2NoZWR1bGVkIGNvbGxlY3Rpb25zIGFuZCByZXNjaGVkdWxlIGl0ZW0uXG4gICAqXG4gICAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgdGhlIHJlY29yZCBsb2cgaXRlbS5cbiAgICogQHBhcmFtIHtDYXJkSW5wdXQgfCBDYXJkfSBjdXJyZW50X2NhcmQgLSBUaGUgY3VycmVudCBjYXJkIHRvIGJlIHJlc2NoZWR1bGVkLlxuICAgKiBAcGFyYW0ge0FycmF5PEZTUlNIaXN0b3J5Pn0gcmV2aWV3cyAtIFRoZSBhcnJheSBvZiBGU1JTSGlzdG9yeSBvYmplY3RzIHJlcHJlc2VudGluZyB0aGUgcmV2aWV3cy5cbiAgICogQHBhcmFtIHtQYXJ0aWFsPFJlc2NoZWR1bGVPcHRpb25zPFQ+Pn0gb3B0aW9ucyAtIFRoZSBvcHRpb25hbCByZXNjaGVkdWxlIG9wdGlvbnMuXG4gICAqIEByZXR1cm5zIHtJUmVzY2hlZHVsZTxUPn0gLSBUaGUgcmVzY2hlZHVsZWQgY29sbGVjdGlvbnMgYW5kIHJlc2NoZWR1bGUgaXRlbS5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHlwZXNjcmlwdFxuICAgKiBjb25zdCBmID0gZnNycygpXG4gICAqIGNvbnN0IGdyYWRlczogR3JhZGVbXSA9IFtSYXRpbmcuR29vZCwgUmF0aW5nLkdvb2QsIFJhdGluZy5Hb29kLCBSYXRpbmcuR29vZF1cbiAgICogY29uc3QgcmV2aWV3c19hdCA9IFtcbiAgICogICBuZXcgRGF0ZSgyMDI0LCA4LCAxMyksXG4gICAqICAgbmV3IERhdGUoMjAyNCwgOCwgMTMpLFxuICAgKiAgIG5ldyBEYXRlKDIwMjQsIDgsIDE3KSxcbiAgICogICBuZXcgRGF0ZSgyMDI0LCA4LCAyOCksXG4gICAqIF1cbiAgICpcbiAgICogY29uc3QgcmV2aWV3czogRlNSU0hpc3RvcnlbXSA9IFtdXG4gICAqIGZvciAobGV0IGkgPSAwOyBpIDwgZ3JhZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAqICAgcmV2aWV3cy5wdXNoKHtcbiAgICogICAgIHJhdGluZzogZ3JhZGVzW2ldLFxuICAgKiAgICAgcmV2aWV3OiByZXZpZXdzX2F0W2ldLFxuICAgKiAgIH0pXG4gICAqIH1cbiAgICpcbiAgICogY29uc3QgcmVzdWx0c19zaG9ydCA9IHNjaGVkdWxlci5yZXNjaGVkdWxlKFxuICAgKiAgIGNyZWF0ZUVtcHR5Q2FyZCgpLFxuICAgKiAgIHJldmlld3MsXG4gICAqICAge1xuICAgKiAgICAgc2tpcE1hbnVhbDogZmFsc2UsXG4gICAqICAgfVxuICAgKiApXG4gICAqIGNvbnNvbGUubG9nKHJlc3VsdHNfc2hvcnQpXG4gICAqIGBgYFxuICAgKi9cbiAgcmVzY2hlZHVsZShjdXJyZW50X2NhcmQsIHJldmlld3MgPSBbXSwgb3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3Qge1xuICAgICAgcmVjb3JkTG9nSGFuZGxlcixcbiAgICAgIHJldmlld3NPcmRlckJ5LFxuICAgICAgc2tpcE1hbnVhbCA9IHRydWUsXG4gICAgICBub3cgPSAvKiBAX19QVVJFX18gKi8gbmV3IERhdGUoKSxcbiAgICAgIHVwZGF0ZV9tZW1vcnlfc3RhdGU6IHVwZGF0ZU1lbW9yeVN0YXRlID0gZmFsc2VcbiAgICB9ID0gb3B0aW9ucztcbiAgICBpZiAocmV2aWV3c09yZGVyQnkgJiYgdHlwZW9mIHJldmlld3NPcmRlckJ5ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIHJldmlld3Muc29ydChyZXZpZXdzT3JkZXJCeSk7XG4gICAgfVxuICAgIGlmIChza2lwTWFudWFsKSB7XG4gICAgICByZXZpZXdzID0gcmV2aWV3cy5maWx0ZXIoKHJldmlldykgPT4gcmV2aWV3LnJhdGluZyAhPT0gUmF0aW5nLk1hbnVhbCk7XG4gICAgfVxuICAgIGNvbnN0IHJlc2NoZWR1bGVTdmMgPSBuZXcgUmVzY2hlZHVsZSh0aGlzKTtcbiAgICBjb25zdCBjb2xsZWN0aW9ucyA9IHJlc2NoZWR1bGVTdmMucmVzY2hlZHVsZShcbiAgICAgIG9wdGlvbnMuZmlyc3RfY2FyZCB8fCBjcmVhdGVFbXB0eUNhcmQoKSxcbiAgICAgIHJldmlld3NcbiAgICApO1xuICAgIGNvbnN0IGxlbiA9IGNvbGxlY3Rpb25zLmxlbmd0aDtcbiAgICBjb25zdCBjdXJfY2FyZCA9IFR5cGVDb252ZXJ0LmNhcmQoY3VycmVudF9jYXJkKTtcbiAgICBjb25zdCBtYW51YWxfaXRlbSA9IHJlc2NoZWR1bGVTdmMuY2FsY3VsYXRlTWFudWFsUmVjb3JkKFxuICAgICAgY3VyX2NhcmQsXG4gICAgICBub3csXG4gICAgICBsZW4gPyBjb2xsZWN0aW9uc1tsZW4gLSAxXSA6IHZvaWQgMCxcbiAgICAgIHVwZGF0ZU1lbW9yeVN0YXRlXG4gICAgKTtcbiAgICByZXR1cm4ge1xuICAgICAgY29sbGVjdGlvbnM6IHR5cGVvZiByZWNvcmRMb2dIYW5kbGVyID09PSBcImZ1bmN0aW9uXCIgPyBjb2xsZWN0aW9ucy5tYXAocmVjb3JkTG9nSGFuZGxlcikgOiBjb2xsZWN0aW9ucyxcbiAgICAgIHJlc2NoZWR1bGVfaXRlbTogbWFudWFsX2l0ZW0gPyBhcHBseUFmdGVySGFuZGxlcihtYW51YWxfaXRlbSwgcmVjb3JkTG9nSGFuZGxlcikgOiBudWxsXG4gICAgfTtcbiAgfVxufVxuY29uc3QgZnNycyA9IChwYXJhbXMpID0+IHtcbiAgcmV0dXJuIG5ldyBGU1JTKHBhcmFtcyB8fCB7fSk7XG59O1xuXG5leHBvcnQgeyBBYnN0cmFjdFNjaGVkdWxlciwgQmFzaWNMZWFybmluZ1N0ZXBzU3RyYXRlZ3ksIENMQU1QX1BBUkFNRVRFUlMsIENvbnZlcnRTdGVwVW5pdFRvTWludXRlcywgRGVmYXVsdEluaXRTZWVkU3RyYXRlZ3ksIEZTUlMsIEZTUlM1X0RFRkFVTFRfREVDQVksIEZTUlM2X0RFRkFVTFRfREVDQVksIEZTUlNBbGdvcml0aG0sIEZTUlNWZXJzaW9uLCBHZW5TZWVkU3RyYXRlZ3lXaXRoQ2FyZElkLCBHcmFkZXMsIElOSVRfU19NQVgsIFJhdGluZywgU19NQVgsIFNfTUlOLCBTdGF0ZSwgU3RyYXRlZ3lNb2RlLCBUeXBlQ29udmVydCwgVzE3X1cxOF9DZWlsaW5nLCBjaGVja1BhcmFtZXRlcnMsIGNsYW1wLCBjbGlwUGFyYW1ldGVycywgY29tcHV0ZURlY2F5RmFjdG9yLCBjcmVhdGVFbXB0eUNhcmQsIGRhdGVEaWZmSW5EYXlzLCBkYXRlX2RpZmYsIGRhdGVfc2NoZWR1bGVyLCBkZWZhdWx0X2VuYWJsZV9mdXp6LCBkZWZhdWx0X2VuYWJsZV9zaG9ydF90ZXJtLCBkZWZhdWx0X2xlYXJuaW5nX3N0ZXBzLCBkZWZhdWx0X21heGltdW1faW50ZXJ2YWwsIGRlZmF1bHRfcmVsZWFybmluZ19zdGVwcywgZGVmYXVsdF9yZXF1ZXN0X3JldGVudGlvbiwgZGVmYXVsdF93LCBmaXhEYXRlLCBmaXhSYXRpbmcsIGZpeFN0YXRlLCBmb3JnZXR0aW5nX2N1cnZlLCBmb3JtYXREYXRlLCBmc3JzLCBnZW5lcmF0b3JQYXJhbWV0ZXJzLCBnZXRfZnV6el9yYW5nZSwgbWlncmF0ZVBhcmFtZXRlcnMsIHJvdW5kVG8sIHNob3dfZGlmZl9tZXNzYWdlIH07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1pbmRleC5tanMubWFwXG4iLCIvLyBUaGUgbW9kdWxlIGNhY2hlXG5jb25zdCBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdGNvbnN0IGNhY2hlZE1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdGlmIChjYWNoZWRNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjYWNoZWRNb2R1bGUuZXhwb3J0cztcblx0fVxuXHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuXHRjb25zdCBtb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdID0ge1xuXHRcdGlkOiBtb2R1bGVJZCxcblx0XHRsb2FkZWQ6IGZhbHNlLFxuXHRcdGV4cG9ydHM6IHt9XG5cdH07XG5cblx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG5cdGlmICghKG1vZHVsZUlkIGluIF9fd2VicGFja19tb2R1bGVzX18pKSB7XG5cdFx0ZGVsZXRlIF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdFx0Y29uc3QgZSA9IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIgKyBtb2R1bGVJZCArIFwiJ1wiKTtcblx0XHRlLmNvZGUgPSAnTU9EVUxFX05PVF9GT1VORCc7XG5cdFx0dGhyb3cgZTtcblx0fVxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXShtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBGbGFnIHRoZSBtb2R1bGUgYXMgbG9hZGVkXG5cdG1vZHVsZS5sb2FkZWQgPSB0cnVlO1xuXG5cdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG5cdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbn1cblxuIiwiLy8gZGVmaW5lIGdldHRlci92YWx1ZSBmdW5jdGlvbnMgZm9yIGhhcm1vbnkgZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5kID0gKGV4cG9ydHMsIGRlZmluaXRpb24pID0+IHtcblx0aWYoQXJyYXkuaXNBcnJheShkZWZpbml0aW9uKSkge1xuXHRcdHZhciBpID0gMDtcblx0XHR3aGlsZShpIDwgZGVmaW5pdGlvbi5sZW5ndGgpIHtcblx0XHRcdHZhciBrZXkgPSBkZWZpbml0aW9uW2krK107XG5cdFx0XHR2YXIgYmluZGluZyA9IGRlZmluaXRpb25baSsrXTtcblx0XHRcdGlmKCFfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZXhwb3J0cywga2V5KSkge1xuXHRcdFx0XHRpZihiaW5kaW5nID09PSAwKSB7XG5cdFx0XHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIGtleSwgeyBlbnVtZXJhYmxlOiB0cnVlLCB2YWx1ZTogZGVmaW5pdGlvbltpKytdIH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBrZXksIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBiaW5kaW5nIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYoYmluZGluZyA9PT0gMCkgeyBpKys7IH1cblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0Zm9yKHZhciBrZXkgaW4gZGVmaW5pdGlvbikge1xuXHRcdFx0aWYoX193ZWJwYWNrX3JlcXVpcmVfXy5vKGRlZmluaXRpb24sIGtleSkgJiYgIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBrZXkpKSB7XG5cdFx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBrZXksIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBkZWZpbml0aW9uW2tleV0gfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59OyIsIl9fd2VicGFja19yZXF1aXJlX18uaG1kID0gKG1vZHVsZSkgPT4ge1xuXHRtb2R1bGUgPSBPYmplY3QuY3JlYXRlKG1vZHVsZSk7XG5cdGlmICghbW9kdWxlLmNoaWxkcmVuKSBtb2R1bGUuY2hpbGRyZW4gPSBbXTtcblx0T2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZHVsZSwgJ2V4cG9ydHMnLCB7XG5cdFx0ZW51bWVyYWJsZTogdHJ1ZSxcblx0XHRzZXQoKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0VTIE1vZHVsZXMgbWF5IG5vdCBhc3NpZ24gbW9kdWxlLmV4cG9ydHMgb3IgZXhwb3J0cy4qLCBVc2UgRVNNIGV4cG9ydCBzeW50YXgsIGluc3RlYWQ6ICcgKyBtb2R1bGUuaWQpO1xuXHRcdH1cblx0fSk7XG5cdHJldHVybiBtb2R1bGU7XG59OyIsIl9fd2VicGFja19yZXF1aXJlX18ubyA9IChvYmosIHByb3ApID0+IChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKSkiLCIvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSAoZXhwb3J0cykgPT4ge1xuXHRpZihTeW1ib2wudG9TdHJpbmdUYWcpIHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgU3ltYm9sLnRvU3RyaW5nVGFnLCB7IHZhbHVlOiAnTW9kdWxlJyB9KTtcblx0fVxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xufTsiLCIiLCIvLyBzdGFydHVwXG4vLyBMb2FkIGVudHJ5IG1vZHVsZSBhbmQgcmV0dXJuIGV4cG9ydHNcbi8vIFRoaXMgZW50cnkgbW9kdWxlIGlzIHJlZmVyZW5jZWQgYnkgb3RoZXIgbW9kdWxlcyBzbyBpdCBjYW4ndCBiZSBpbmxpbmVkXG5sZXQgX193ZWJwYWNrX2V4cG9ydHNfXyA9IF9fd2VicGFja19yZXF1aXJlX18oXCIuL2ZlYXR1cmVzL3RyYWNrZXIvc2NoZWR1bGVyL2ZzcnNTY2hlZHVsZXIuanNcIik7XG4iLCIiXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=