import { describe, it, expect } from 'vitest';
import { creditsFor, OPERATION_CREDITS, DEFAULT_OPERATION_CREDIT, MAX_PROJECTS } from '../costs';

describe('creditsFor', () => {
  it('returns 1.0 for generate (the most expensive writing operation)', () => {
    expect(creditsFor('generate')).toBe(1.0);
  });

  it('returns 2.0 for quick-start (heaviest path)', () => {
    expect(creditsFor('quick-start')).toBe(2.0);
  });

  it('returns 0.2 for cheap creator tools', () => {
    expect(creditsFor('hook-ab')).toBe(0.2);
    expect(creditsFor('title-hook')).toBe(0.2);
    expect(creditsFor('score-hook')).toBe(0.2);
  });

  it('returns the default credit for unknown operations', () => {
    expect(creditsFor('some-unknown-route')).toBe(DEFAULT_OPERATION_CREDIT);
    expect(creditsFor('')).toBe(DEFAULT_OPERATION_CREDIT);
  });

  it('every listed operation has a positive cost', () => {
    for (const [op, cost] of Object.entries(OPERATION_CREDITS)) {
      expect(cost, `cost for "${op}" must be > 0`).toBeGreaterThan(0);
    }
  });
});

describe('MAX_PROJECTS', () => {
  it('caps free tier at 3', () => {
    expect(MAX_PROJECTS.free).toBe(3);
  });

  it('allows unlimited projects for paid tiers', () => {
    expect(MAX_PROJECTS.story_pro).toBe(-1);
    expect(MAX_PROJECTS.creator_pro).toBe(-1);
    expect(MAX_PROJECTS.all_access).toBe(-1);
  });
});
