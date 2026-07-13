class FSRS {
    constructor(params = null) {
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
        const now = new Date().getTime();
        return {
            id: Date.now().toString(),
            problemTitle, problemUrl, textRead, approach, tags,
            due: now,
            stability: 0, difficulty: 0, elapsed_days: 0, scheduled_days: 0,
            reps: 0, lapses: 0, state: 0,
            historyLog: [now] // NEW: Track exactly when this was created/reviewed
        };
    }

    applyFuzz(interval) {
        if (interval < 2.5) return Math.round(interval);
        let fuzzRange;
        if (interval < 7) fuzzRange = 1;
        else if (interval < 20) fuzzRange = 2;
        else if (interval < 45) fuzzRange = 3;
        else fuzzRange = Math.max(4, Math.round(interval * 0.05));
        
        const fuzz = Math.floor(Math.random() * (fuzzRange * 2 + 1)) - fuzzRange;
        return Math.max(1, Math.round(interval + fuzz));
    }

    reviewCard(card, rating, customWeights = null, now = new Date().getTime()) {
        let newCard = { ...card };
        
        // NEW: Store due date before this review to determine if it was due today
        newCard.previousDue = card.due;
        
        // NEW: Add this exact review timestamp to the card's history log
        newCard.historyLog = newCard.historyLog || [];
        newCard.historyLog.push(now);

        const w = (customWeights && customWeights.length === 17) ? customWeights : this.w;

        if (newCard.state === 0) {
            newCard.difficulty = Math.max(1, Math.min(10, w[4] + (rating - 3) * w[5]));
            newCard.stability = w[rating - 1];
            newCard.state = rating === 1 ? 1 : 2;
        } else {
            const retrievability = Math.exp(this.decay * newCard.elapsed_days / newCard.stability);
            newCard.difficulty = Math.max(1, Math.min(10, newCard.difficulty + w[6] * (rating - 3)));

            if (rating === 1) {
                newCard.stability = w[11] * Math.pow(newCard.difficulty, -w[12]) * Math.pow(newCard.stability, w[13]) * Math.exp((1 - retrievability) * w[14]);
                newCard.lapses += 1;
                newCard.state = 3;
            } else {
                newCard.stability = newCard.stability * (1 + Math.exp(w[8]) * (11 - newCard.difficulty) * Math.pow(newCard.stability, -w[9]) * (Math.exp((1 - retrievability) * w[10]) - 1));
                newCard.state = 2;
            }
        }

        newCard.reps += 1;
        const intervalModifier = 9 * (Math.pow(this.requestRetention, 1 / this.decay) - 1);
        let rawInterval = newCard.stability * intervalModifier;
        
        newCard.scheduled_days = this.applyFuzz(rawInterval);
        newCard.due = now + (newCard.scheduled_days * 24 * 60 * 60 * 1000);
        return newCard;
    }
}