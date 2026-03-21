import { Database as SqliteDatabase } from 'bun:sqlite';
import { pushSQLiteSchema } from 'drizzle-kit/api';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Weight } from './datamodel';
import { exercises, users, workoutExercises, workouts } from './schema';

export const schema = { users, exercises, workouts, workoutExercises };

export class Database {
    private sqlite: SqliteDatabase;
    private db;
    private initialized = false;

    constructor(path: string) {
        // path = ':memory:' for in-memory db
        this.sqlite = new SqliteDatabase(path);
        this.db = drizzle(this.sqlite, { schema });
    }

    async init() {
        if (this.initialized) return;
        const result = await pushSQLiteSchema(
            schema,
            this.db as unknown as Parameters<typeof pushSQLiteSchema>[1],
        );
        await result.apply();
        this.initialized = true;
    }

    async createExercise(
        userId: number,
        exerciseData: {
            name: string;
            weight: Weight;
            reps: number;
            sets: number;
        },
    ) {
        const [created] = await this.db
            .insert(exercises)
            .values({
                ...exerciseData,
                weight: exerciseData.weight.asLbs(),
                userId,
            })
            .returning();
        return {
            ...created,
            weight: Weight.fromLbs(created.weight),
        };
    }

    async getExercise(id: number) {
        const [found] = await this.db
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

    async getUserExercises(userId: number) {
        const found = await this.db
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

    async createWorkout(
        userId: number,
        workoutData: {
            name: string;
            exercises: { id: number; order: number }[];
        },
    ) {
        const [created] = await this.db
            .insert(workouts)
            .values({
                name: workoutData.name,
                userId,
            })
            .returning();

        for (const exerciseData of workoutData.exercises) {
            await this.db.insert(workoutExercises).values({
                workoutId: created.id,
                exerciseId: exerciseData.id,
                order: exerciseData.order,
            });
        }
        return created;
    }

    async getWorkout(id: number) {
        const [foundWorkout] = await this.db
            .select()
            .from(workouts)
            .where(eq(workouts.id, id))
            .limit(1);

        if (!foundWorkout) return null;

        const foundWorkoutExercises = await this.db
            .select()
            .from(workoutExercises)
            .where(eq(workoutExercises.workoutId, id))
            .orderBy(workoutExercises.order);

        const exercisePromises = foundWorkoutExercises.map((e) =>
            this.getExercise(e.exerciseId),
        );
        const foundExercises = await Promise.all(exercisePromises);

        return {
            ...foundWorkout,
            exercises: foundExercises.filter((e) => e !== null),
        };
    }

    async getWorkouts(userId: number) {
        const found = await this.db
            .select()
            .from(workouts)
            .where(eq(workouts.userId, userId));

        const workoutPromises = found.map((w) => this.getWorkout(w.id));
        const foundWorkouts = await Promise.all(workoutPromises);
        return foundWorkouts.filter((w) => w !== null);
    }
}
