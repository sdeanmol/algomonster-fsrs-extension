/**
 * @file features/tracker/scheduler/scheduler.ts
 * @description Abstract base class defining the standard interface for scheduling algorithms.
 * Any scheduling algorithm (e.g., FSRS, SM-2, Leitner) must extend this class to be fully
 * pluggable within the extension architecture.
 */

export class AbstractScheduler {
    constructor() {
        if (new.target === AbstractScheduler) {
            throw new TypeError("Cannot construct AbstractScheduler instances directly.");
        }
    }

    /**
     * Initializes a new flashcard schema with default scheduling parameters.
     */
    createCard(problemTitle?: string, problemUrl?: string, textRead?: string, approach?: string, tags: string[] = []): any {
        throw new Error("Method 'createCard()' must be implemented.");
    }

    /**
     * Transition card parameters based on review rating.
     */
    reviewCard(card?: any, rating?: number, customWeights: number[] | null = null, now: number = Date.now()): any {
        throw new Error("Method 'reviewCard()' must be implemented.");
    }

    /**
     * Computes the mathematical retrievability probability (0.0 to 1.0) of a card.
     */
    getRetrievability(card?: any, now: number = Date.now()): number {
        throw new Error("Method 'getRetrievability()' must be implemented.");
    }

    /**
     * Computes projected retrievability over a future time span based on current stability.
     */
    getProjectedRetrievability(stability?: number, elapsedDays?: number): number {
        throw new Error("Method 'getProjectedRetrievability()' must be implemented.");
    }

    /**
     * Retrieves the baseline target memory retention rate for the scheduling algorithm.
     */
    getDefaultRequestRetention(): number {
        throw new Error("Method 'getDefaultRequestRetention()' must be implemented.");
    }

    /**
     * Determines whether the card is considered to have a highly difficult rating
     * based on the algorithm's specific difficulty scale.
     */
    isHighDifficulty(card?: any): boolean {
        throw new Error("Method 'isHighDifficulty()' must be implemented.");
    }

    /**
     * Evaluates whether a card has passed the learning phase into 'graduated' review.
     */
    isGraduated(card?: any): boolean {
        throw new Error("Method 'isGraduated()' must be implemented.");
    }

    /**
     * Determines whether the current scheduler implementation supports personalized optimization.
     */
    supportsOptimization(): boolean {
        return false;
    }

    /**
     * Trains and applies optimized scheduling parameters based on historical review data.
     */
    async optimize(reviewHistory?: any[]): Promise<any> {
        throw new Error("Method 'optimize()' is not supported by this scheduler.");
    }

    /**
     * Resets the scheduling parameters to their algorithmic defaults.
     */
    resetConfiguration(): void {
        throw new Error("Method 'resetConfiguration()' is not supported by this scheduler.");
    }

    /**
     * Exports the current scheduling parameters.
     */
    exportConfiguration(): any {
        throw new Error("Method 'exportConfiguration()' is not supported by this scheduler.");
    }

    /**
     * Imports and applies scheduling parameters.
     */
    importConfiguration(config?: any): void {
        throw new Error("Method 'importConfiguration()' is not supported by this scheduler.");
    }
}

export default AbstractScheduler;

if (typeof window !== 'undefined') {
    (window as any).AbstractScheduler = AbstractScheduler;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AbstractScheduler;
}
