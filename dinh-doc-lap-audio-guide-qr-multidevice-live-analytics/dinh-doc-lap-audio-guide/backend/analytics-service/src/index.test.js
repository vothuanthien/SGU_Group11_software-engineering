import { describe, expect, it } from 'vitest';

const allowedEvents = new Set(['app_opened', 'qr_scan', 'place_opened', 'visit_marked', 'narration_started', 'narration_completed']);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('analytics input rules', () => {
  it('accepts generated UUID visitor ids', () => {
    expect(uuidPattern.test('a1c2e3f4-1234-4123-8123-aabbccddeeff')).toBe(true);
  });
  it('rejects invalid visitor identifiers', () => {
    expect(uuidPattern.test('visitor-123')).toBe(false);
  });
  it('only accepts supported analytics event types', () => {
    expect(allowedEvents.has('app_opened')).toBe(true);
    expect(allowedEvents.has('qr_scan')).toBe(true);
    expect(allowedEvents.has('narration_started')).toBe(true);
    expect(allowedEvents.has('arbitrary')).toBe(false);
  });
});
