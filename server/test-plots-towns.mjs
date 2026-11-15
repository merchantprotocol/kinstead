// Copyright (c) 2026 Merchant Protocol. All rights reserved.
/* A town (a plot with a house) is only ever recycled once its owner is KNOWN to have been away a week. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PlotRecycler } from './src/PlotRecycler.js';

const DAY = 24 * 3600 * 1000, now = 100 * DAY;

test('a plot without a house can always be recycled', () => {
  assert.equal(PlotRecycler.townIsAbandoned(false, 0, now), true);
  assert.equal(PlotRecycler.townIsAbandoned(false, now - 1000, now), true);
});

test('a town with an unknown last-seen time (every town from before tracking) is never recycled', () => {
  assert.equal(PlotRecycler.townIsAbandoned(true, 0, now), false);
});

test('a town seen in the last week is kept; one gone more than a week is recyclable', () => {
  assert.equal(PlotRecycler.townIsAbandoned(true, now - 6 * DAY, now), false);
  assert.equal(PlotRecycler.townIsAbandoned(true, now - 8 * DAY, now), true);
});
