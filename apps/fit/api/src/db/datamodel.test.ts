import { describe, expect, it } from 'bun:test';

import { Weight } from './datamodel';

describe('Weight', () => {
    it('converts kilograms to pounds', () => {
        expect(Weight.fromKgs(100).asLbs()).toBeCloseTo(220.462, 3);
    });

    it('converts pounds to kilograms', () => {
        expect(Weight.fromLbs(220.462).asKgs()).toBeCloseTo(100, 3);
    });

    it('keeps pound values unchanged when reading as pounds', () => {
        expect(Weight.fromLbs(185).asLbs()).toBe(185);
    });

    it('keeps kilogram values unchanged when reading as kilograms', () => {
        expect(Weight.fromKgs(100).asKgs()).toBe(100);
    });
});
