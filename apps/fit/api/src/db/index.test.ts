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

    it('returns null for a missing exercise', async () => {
        expect(await db.getExercise(999)).toBeNull();
    });

    it('only returns exercises for the requested user', async () => {
        await db.createExercise(123, {
            name: 'Squat',
            weight: Weight.fromLbs(185),
            reps: 5,
            sets: 3,
        });
        const otherUserExercise = await db.createExercise(456, {
            name: 'Press',
            weight: Weight.fromLbs(95),
            reps: 8,
            sets: 3,
        });

        const exercises = await db.getUserExercises(456);

        expect(exercises).toEqual([otherUserExercise]);
    });
});

describe('workouts', () => {
    it('can create a workout and load its exercises in order', async () => {
        const squat = await db.createExercise(123, {
            name: 'Squat',
            weight: Weight.fromLbs(185),
            reps: 5,
            sets: 3,
        });
        const deadlift = await db.createExercise(123, {
            name: 'Deadlift',
            weight: Weight.fromLbs(315),
            reps: 5,
            sets: 1,
        });

        const workout = await db.createWorkout(123, {
            name: 'Heavy Day',
            exercises: [
                { id: deadlift.id, order: 2 },
                { id: squat.id, order: 1 },
            ],
        });

        expect(workout.name).toBe('Heavy Day');
        expect(workout.userId).toBe(123);
        expect(workout.id).toBeGreaterThan(0);

        const foundWorkout = await db.getWorkout(workout.id);
        expect(foundWorkout).toEqual({
            ...workout,
            exercises: [squat, deadlift],
        });
    });

    it('returns null for a missing workout', async () => {
        expect(await db.getWorkout(999)).toBeNull();
    });

    it('only returns workouts for the requested user', async () => {
        const squat = await db.createExercise(123, {
            name: 'Squat',
            weight: Weight.fromLbs(185),
            reps: 5,
            sets: 3,
        });
        const press = await db.createExercise(456, {
            name: 'Press',
            weight: Weight.fromLbs(95),
            reps: 8,
            sets: 3,
        });

        await db.createWorkout(123, {
            name: 'Lower',
            exercises: [{ id: squat.id, order: 1 }],
        });
        const otherUserWorkout = await db.createWorkout(456, {
            name: 'Upper',
            exercises: [{ id: press.id, order: 1 }],
        });

        const workouts = await db.getWorkouts(456);

        expect(workouts).toEqual([
            {
                ...otherUserWorkout,
                exercises: [press],
            },
        ]);
    });
});
