import { exercises } from "./schema";

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

export type ExerciseRow = typeof exercises.$inferSelect;
export type NewExerciseRow = typeof exercises.$inferInsert;

type ExerciseData = Omit<ExerciseRow, "weight"> & {
  weight: Weight;
};

class Exercise {
    static fromRow(row: ExerciseRow): Exercise {
        return {
            ...row,
            weight: Weight.fromKgs(row.weight),
        };
    }

    static toRow(exercise: ExerciseData): NewExerciseRow {
        return {
            ...exercise,
            weight: exercise.weight.asLbs(),
        };
    }
}

export type Workout_in = {
    exercises: Exercise[];
};

export type Workout = Workout_in & {
    id: number;
    userId: number;
};
