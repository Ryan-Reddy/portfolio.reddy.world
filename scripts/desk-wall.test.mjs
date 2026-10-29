import {test} from 'node:test';
import assert from 'node:assert/strict';
import {placedTiles, wallSettings} from '../src/lib/desk-wall.js';
import {snapshotOf, stamp, mergeStates, sameWork, applyExport} from '../src/lib/desk-store.js';
test('wall settings merge across devices, with the latest deliberate show preserved', () => {
  const a = {projects: {}, images: {}, wall: {p: {hidden: true, row: 2}}};
  const snap = snapshotOf(a);
  a.wall.p = {hidden: false, row: 0, order: 0};
  stamp(a, snap, 200);
  const b = {wall: {p: {hidden: true, row: 2, at: 100}, q: {row: 3, at: 150}}};
  const merged = mergeStates(a, b);
  assert.equal(merged.wall.p.hidden, false);
  assert.equal(merged.wall.p.row, 0);
  assert.equal(merged.wall.q.row, 3);
  assert.equal(sameWork(a, b), false);
});
test('placement exports only public settings and preserves hidden tiles for showing again', () => {
  const settings = wallSettings({'p-one': {year: 2020, row: 2, order: 1, hidden: false, at: 123, title: 'private'}, 'p-two': {hidden: true}, bad: {year: 'no', row: -2}});
  assert.deepEqual(settings, {'p-one': {year: 2020, row: 2, order: 1, hidden: false}, 'p-two': {hidden: true}});
  const tiles = placedTiles([{key: 'p-one', year: 2026}, {key: 'p-two', year: 2026}], settings);
  assert.equal(tiles.length, 2);
  assert.equal(tiles[0].hidden, true);
  assert.equal(tiles[1].year, 2020);
});
test('loading a copy preserves its wall arrangement and stamps it newer than the account', () => {
  const state = {projects: {}, images: {}, wall: {'p-one': {hidden: true, at: 100}}};
  applyExport(state, {version: 4, images: {}, wall: {'p-one': {hidden: false, row: 1}}}, 200);
  assert.deepEqual(state.wall['p-one'], {hidden: false, row: 1, at: 200});
});
test('showing a tile hidden by the site stamps a deliberate false, even on a fresh desk', () => {
  const state = {projects:{},images:{}};
  const snap = snapshotOf(state);
  state.wall = {'p-one':{hidden:false}};
  assert.equal(stamp(state,snap,200),true);
  assert.equal(state.wall['p-one'].at,200);
  assert.equal(mergeStates(state,{wall:{'p-one':{hidden:true}}}).wall['p-one'].hidden,false);
});
