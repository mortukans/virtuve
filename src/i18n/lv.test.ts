import { describe, it, expect } from 'vitest';
import { lvPlural, count, categoryLabel, locationLabel, freshnessLabel } from './lv';

describe('Latvian plural', () => {
  it('uses singular for n ending in 1 but not 11', () => {
    expect(lvPlural(1, 'prece', 'preces')).toBe('prece');
    expect(lvPlural(21, 'prece', 'preces')).toBe('prece');
    expect(lvPlural(31, 'produkts', 'produkti')).toBe('produkts');
  });
  it('uses plural for 11, teens, and other numbers', () => {
    expect(lvPlural(11, 'prece', 'preces')).toBe('preces');
    expect(lvPlural(2, 'prece', 'preces')).toBe('preces');
    expect(lvPlural(0, 'prece', 'preces')).toBe('preces');
    expect(lvPlural(15, 'prece', 'preces')).toBe('preces');
  });
  it('count() prefixes the number', () => {
    expect(count(1, 'prece', 'preces')).toBe('1 prece');
    expect(count(7, 'prece', 'preces')).toBe('7 preces');
  });
});

describe('enum labels', () => {
  it('cover every key with a Latvian string', () => {
    for (const map of [categoryLabel, locationLabel, freshnessLabel]) {
      for (const v of Object.values(map)) {
        expect(typeof v).toBe('string');
        expect(v.length).toBeGreaterThan(0);
      }
    }
    expect(categoryLabel.meat).toBe('Gaļa');
    expect(locationLabel.fridge).toBe('Ledusskapis');
  });
});
