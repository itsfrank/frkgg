import { beforeEach, describe, expect, it } from 'bun:test';
import { Weight } from './datamodel';
import { Database } from './index';

let db: Database;

beforeEach(async () => {
    db = new Database(':memory:');
    await db.init();
});

describe('exercises', () => {
    it('can create an exercise', async () => {
        const exercise = await db.createExercise(123, {
            name: 'Squat',
            weight: Weight.fromLbs(185),
            reps: 5,
            sets: 3,
        });
        expect(exercise.name).toBe('Squat');
        expect(exercise.weight.asLbs()).toBe(185);
        expect(exercise.reps).toBe(5);
        expect(exercise.sets).toBe(3);
        expect(exercise.userId).toBe(123);
        expect(exercise.id).toBeGreaterThan(0);

        const foundExercise = await db.getExercise(exercise.id);
        expect(foundExercise).toEqual(exercise);
    });

    it('can get all exercises', async () => {
        const exerciseBase = {
            weight: Weight.fromLbs(185),
            reps: 5,
            sets: 3,
        };
        const exData1 = { ...exerciseBase, name: 'Squat' };
        const exData2 = { ...exerciseBase, name: 'Bench Press' };
        const exData3 = { ...exerciseBase, name: 'Deadlift' };

        const ex1 = await db.createExercise(123, exData1);
        const ex2 = await db.createExercise(123, exData2);
        const ex3 = await db.createExercise(123, exData3);

        const exercises = await db.getUserExercises(123);
        expect(exercises).toHaveLength(3);
        expect(exercises).toContainEqual(ex1);
        expect(exercises).toContainEqual(ex2);
        expect(exercises).toContainEqual(ex3);
    });
});
