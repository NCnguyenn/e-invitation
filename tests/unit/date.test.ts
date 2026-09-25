import { describe, expect, it } from 'vitest';
import { eventCalendar, countdownParts } from '../../src/features/template/date';

describe('Vietnam event time', () => {
  it('uses Vietnam date even when UTC is the preceding day', () => {
    const calendar = eventCalendar('2026-09-27T18:00:00Z');
    expect(calendar).toMatchObject({ day: 28, month: 9, year: 2026, time: '01:00' });
    expect(calendar.weeks.flat().filter(Boolean)).toHaveLength(30);
    expect(calendar.weeks[0]).toEqual([null, 1, 2, 3, 4, 5, 6]);
  });
  it('handles leap years and Sunday month boundaries', () => {
    expect(eventCalendar('2024-02-29T10:00:00+07:00').weeks.flat().filter(Boolean)).toHaveLength(29);
    expect(eventCalendar('2026-03-01T10:00:00+07:00').weeks[0]).toEqual([null, null, null, null, null, null, 1]);
  });
  it('never counts below zero', () => {
    expect(countdownParts(1000, 2000)).toEqual([0, 0, 0, 0]);
    expect(countdownParts(90061000, 0)).toEqual([1, 1, 1, 1]);
  });
});
