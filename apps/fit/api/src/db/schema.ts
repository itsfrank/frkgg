import { integer, numeric, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull(),
    email: text("email").notNull(),
});

export const exercises = sqliteTable("exercises", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    weight: numeric("weight", { mode: "number" }).notNull(),
    reps: integer("reps").notNull(),
    sets: integer("sets").notNull(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
});

export const workouts = sqliteTable("workouts", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
});

export const workoutExercises = sqliteTable("workout_exercises", {
    workoutId: integer("workout_id").notNull().references(() => workouts.id, { onDelete: "cascade" }),
    exerciseId: integer("exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
});

