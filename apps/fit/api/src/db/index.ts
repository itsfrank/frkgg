import { Database } from 'bun:sqlite';
import { pushSQLiteSchema } from 'drizzle-kit/api';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Weight } from './datamodel';
import { exercises, users, workoutExercises, workouts } from './schema';

export const schema = { users, exercises, workouts, workoutExercises };

const sqlite = new Database(':memory:');
export const db = drizzle(sqlite, { schema });

let initialized = false;
export async function initDb() {
    if (initialized) return;
    const result = await pushSQLiteSchema(
        schema,
        db as unknown as Parameters<typeof pushSQLiteSchema>[1],
    );
    await result.apply();
    initialized = true;
}

export async function createExercise(
    userId: number,
    exerciseData: {
        name: string;
        weight: Weight;
        reps: number;
        sets: number;
    },
) {
    const [created] = await db
        .insert(exercises)
        .values({
            ...exerciseData,
            weight: exerciseData.weight.asLbs(),
            userId,
        })
        .returning();
    return created;
}

export async function getExercise(id: number) {
    const [found] = await db
        .select()
        .from(exercises)
        .where(eq(exercises.id, id))
        .limit(1);

    if (!found) return null;
    return {
        ...found,
        weight: Weight.fromLbs(found.weight),
    };
}

export async function getExercises(userId: number) {
    const found = await db
        .select()
        .from(exercises)
        .where(eq(exercises.userId, userId))
        .orderBy(exercises.id);

    return found.map((e) => {
        return {
            ...e,
            weight: Weight.fromLbs(e.weight),
        };
    });
}

export async function createWorkout(
    userId: number,
    workoutData: {
        name: string;
        exercises: { id: number; order: number }[];
    },
) {
    const [created] = await db
        .insert(workouts)
        .values({
            name: workoutData.name,
            userId,
        })
        .returning();

    for (const exerciseData of workoutData.exercises) {
        await db.insert(workoutExercises).values({
            workoutId: created.id,
            exerciseId: exerciseData.id,
            order: exerciseData.order,
        });
    }
    return created;
}

export async function getWorkout(id: number) {
    const [foundWorkout] = await db
        .select()
        .from(workouts)
        .where(eq(workouts.id, id))
        .limit(1);

    if (!foundWorkout) return null;

    const foundWorkoutExercises = await db
        .select()
        .from(workoutExercises)
        .where(eq(workoutExercises.workoutId, id))
        .orderBy(workoutExercises.order);

    const exercisePromises = foundWorkoutExercises.map((e) =>
        getExercise(e.exerciseId),
    );
    const foundExercises = await Promise.all(exercisePromises);

    return {
        ...foundWorkout,
        exercises: foundExercises.filter((e) => e !== null),
    };
}

export async function getWorkouts(userId: number) {
    const found = await db
        .select()
        .from(workouts)
        .where(eq(workouts.userId, userId));

    const workoutPromises = found.map((w) => getWorkout(w.id));
    const foundWorkouts = await Promise.all(workoutPromises);
    return foundWorkouts.filter((w) => w !== null);
}
