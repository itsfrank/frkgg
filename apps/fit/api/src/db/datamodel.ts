export class Weight {
    private value: number = 0;
    private isKg: boolean = true;

    private constructor(value: number, isKg: boolean) {
        this.value = value;
        this.isKg = isKg;
    }
    asLbs() {
        if (this.isKg) {
            return this.value / 2.20462;
        }
        return this.value;
    }
    asKgs() {
        if (!this.isKg) {
            return this.value * 2.20462;
        }
        return this.value;
    }
    static fromLbs(lbs: number) {
        return new Weight(lbs, false);
    }
    static fromKgs(kgs: number) {
        return new Weight(kgs, true);
    }
}
