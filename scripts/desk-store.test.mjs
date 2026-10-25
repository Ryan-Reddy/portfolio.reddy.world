// npm test  (node --test "scripts/**/*.test.mjs"): the image desk's saved work (src/lib/desk-store.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stamp, snapshotOf, mergeStates, sameWork, summarize, isPristine, dayOf, applyExport } from '../src/lib/desk-store.js';

const T0 = Date.parse('2026-10-25T08:00:00');
const T1 = T0 + 60_000;
const T2 = T0 + 120_000;
const A = 'rmaekers/a';
const B = 'rmaekers/b';
const M = 'vaguelyvulgar/m';
const img = (project, n) => `${project}::/portfolio/images/${project}/${n}.jpg`;

const DATA = [
  { id: A, title: 'Project A', portfolio: 'ReddyMaekers', images: [{ key: img(A, 1), url: 'a1', existingDescription: 'Old caption' }, { key: img(A, 2), url: 'a2', existingDescription: '' }] },
  { id: B, title: 'Project B', portfolio: 'ReddyMaekers', images: [{ key: img(B, 1), url: 'b1', existingDescription: '' }] },
  { id: M, title: 'Modelling M', portfolio: 'Vaguely Vulgar', images: [{ key: img(M, 1), url: 'm1', existingDescription: '' }, { key: img(M, 2), url: 'm2', existingDescription: '' }] },
];
const existing = { [img(A, 1)]: 'Old caption' };
const fresh = () => ({ projects: {}, images: {}, cursor: 0, session: 0 });

test('a change is stamped with its time; the day counts as worked', () => {
  const state = fresh();
  const snap = snapshotOf(state);
  state.projects[A] = { tags: 'stage, light' };
  assert.equal(stamp(state, snap, T1, existing), true);
  assert.equal(state.projects[A].at, T1);
  assert.equal(state.savedAt, T1);
  assert.deepEqual(state.days, { [dayOf(T1)]: true });
  // nothing new: no new stamp
  assert.equal(stamp(state, snap, T2, existing), false);
  assert.equal(state.projects[A].at, T1);
});

test('merely showing a project or picture is not work, so it gets no stamp', () => {
  const state = fresh();
  const snap = snapshotOf(state);
  // what collect() writes for a picture Ryan only looked at: its old caption, no words
  state.projects[A] = { tags: '' };
  state.images[img(A, 1)] = { description: 'Old caption', tags: '' };
  assert.equal(stamp(state, snap, T1, existing), false);
  assert.equal(state.images[img(A, 1)].at, undefined);
  assert.equal(state.days, undefined);
  assert.equal(isPristine(state.images[img(A, 1)], 'Old caption'), true);
  assert.equal(isPristine({ description: 'New words' }, 'Old caption'), false);
});

test('clearing real work is a change and is stamped', () => {
  const state = { ...fresh(), projects: { [A]: { tags: 'stage' } } };
  const snap = snapshotOf(state);
  state.projects[A].tags = '';
  assert.equal(stamp(state, snap, T1, existing), true);
  assert.equal(state.projects[A].at, T1);
});

test('marking a project done stamps doneAt once', () => {
  const state = { ...fresh(), projects: { [A]: { tags: 'stage', at: T0 } } };
  const snap = snapshotOf(state);
  state.projects[A].reviewed = true;
  stamp(state, snap, T1, existing);
  assert.equal(state.projects[A].doneAt, T1);
  state.projects[A].hero = 'a2';
  stamp(state, snap, T2, existing);
  assert.equal(state.projects[A].doneAt, T1, 'a later change keeps the moment it was done');
  assert.equal(state.projects[A].at, T2);
});

test('merging: the newer change wins per project and per picture, in both directions', () => {
  const local = { ...fresh(), projects: { [A]: { tags: 'new local', at: T2 }, [B]: { tags: 'old local', at: T0 } }, savedAt: T2 };
  const remote = { ...fresh(), projects: { [A]: { tags: 'old remote', at: T1 }, [B]: { tags: 'new remote', at: T1 } }, savedAt: T1 };
  const merged = mergeStates(local, remote);
  assert.equal(merged.projects[A].tags, 'new local');
  assert.equal(merged.projects[B].tags, 'new remote');
});

test('merging keeps work that only one side has', () => {
  const local = { ...fresh(), images: { [img(A, 2)]: { description: 'only here', tags: '', at: T1 } } };
  const remote = { ...fresh(), projects: { [B]: { tags: 'only there', reviewed: true, at: T0 } } };
  const merged = mergeStates(local, remote);
  assert.equal(merged.images[img(A, 2)].description, 'only here');
  assert.equal(merged.projects[B].tags, 'only there');
  assert.equal(merged.projects[B].reviewed, true);
  assert.equal(mergeStates(local, null).images[img(A, 2)].description, 'only here', 'nothing saved yet: the browser copy as it is');
});

test('a stale browser that only looked at a picture cannot wipe work saved on another device', () => {
  // device 1 typed extra words for the picture and saved them to the account
  const account = { ...fresh(), images: { [img(A, 1)]: { description: 'A welder at night', tags: 'welding', at: T1 } }, savedAt: T1 };
  // device 2, never synced, opens the same picture later: collect() writes the old caption and no words
  const browser = fresh();
  const snap = snapshotOf(browser);
  browser.images[img(A, 1)] = { description: 'Old caption', tags: '' };
  stamp(browser, snap, T2, existing);
  const merged = mergeStates(browser, account);
  assert.equal(merged.images[img(A, 1)].description, 'A welder at night');
  assert.equal(merged.images[img(A, 1)].tags, 'welding');
});

test('two copies from before the stamps merge field by field: tags joined, done kept, nothing lost', () => {
  const local = { ...fresh(), projects: { [A]: { tags: 'stage, Light' } } };
  const remote = { ...fresh(), projects: { [A]: { tags: 'light, wood', reviewed: true, hero: 'a2' } } };
  const merged = mergeStates(local, remote);
  assert.equal(merged.projects[A].tags, 'stage, Light, wood');
  assert.equal(merged.projects[A].reviewed, true);
  assert.equal(merged.projects[A].hero, 'a2');
});

test('the place is the one from the copy changed last; days worked are joined; the session is the larger', () => {
  const local = { ...fresh(), cursor: 3, session: 2, savedAt: T1, days: { '2026-10-24': true } };
  const remote = { ...fresh(), cursor: 7, session: 5, savedAt: T2, days: { '2026-10-25': true } };
  const merged = mergeStates(local, remote);
  assert.equal(merged.cursor, 7);
  assert.equal(merged.session, 5);
  assert.deepEqual(Object.keys(merged.days).sort(), ['2026-10-24', '2026-10-25']);
  assert.equal(mergeStates({ ...local, savedAt: T2 + 1 }, remote).cursor, 3);
});

test('merging is safe to repeat: merging the result again changes nothing', () => {
  const local = { ...fresh(), projects: { [A]: { tags: 'x', at: T2 } }, images: { [img(A, 1)]: { description: 'd', tags: '', at: T0 } } };
  const remote = { ...fresh(), projects: { [B]: { tags: 'y', at: T1 } } };
  const once = mergeStates(local, remote);
  assert.equal(sameWork(mergeStates(once, remote), once), true);
  assert.equal(sameWork(mergeStates(remote, once), once), true);
  assert.equal(sameWork(once, local), false);
});

test('overview: done, started and not started per portfolio, and one next step', () => {
  const state = {
    ...fresh(),
    cursor: 0,
    projects: { [A]: { tags: 'stage, light', reviewed: true, hero: 'a2', doneAt: T1 }, [B]: { tags: '' } },
    images: { [img(B, 1)]: { description: 'typed', tags: '' }, [img(A, 1)]: { description: 'Old caption', tags: '' } },
    days: { '2026-10-24': true, '2026-10-25': true },
    savedAt: T1,
  };
  const sum = summarize(DATA, state, { now: T2 });
  assert.equal(sum.total, 3);
  assert.equal(sum.done, 1);
  assert.equal(sum.started, 1, 'B has a typed description');
  assert.equal(sum.todo, 1);
  assert.deepEqual(sum.portfolios.map((p) => [p.name, p.done, p.started, p.todo]), [['ReddyMaekers', 1, 1, 0], ['Vaguely Vulgar', 0, 0, 1]]);
  const a = sum.portfolios[0].rows[0];
  assert.deepEqual([a.status, a.keywords, a.lead, a.creditsMissing], ['done', 2, true, null]);
  assert.equal(sum.next.title, 'Project B', 'A is done, so the next one after it');
  assert.equal(sum.daysWorked, 2);
  assert.equal(sum.doneToday, 1);
});

test('overview: next up is where Ryan is when that project is not done yet', () => {
  const state = { ...fresh(), cursor: 3 }; // flat index 3 = the first picture of Modelling M
  assert.equal(summarize(DATA, state).next.title, 'Modelling M');
  const all = { ...fresh(), projects: Object.fromEntries(DATA.map((p) => [p.id, { reviewed: true }])) };
  assert.equal(summarize(DATA, all).next, null);
});

test('overview: modelling projects count pictures without a photographer when credits exist', () => {
  const state = { ...fresh(), images: { [img(M, 1)]: { credit: { name: 'Jane Doe', url: '' } } } };
  const row = (credits) => summarize(DATA, state, { credits }).portfolios[1].rows[0];
  assert.equal(row(null).creditsMissing, null, 'no credit field on this page: nothing counted');
  assert.equal(row({}).creditsMissing, 1);
  assert.equal(row({ [img(M, 2)]: { name: 'From the archive' } }).creditsMissing, 0);
  assert.equal(summarize(DATA, { ...state, projects: { [M]: { credit: { name: 'All by me' } } } }, { credits: {} }).portfolios[1].rows[0].creditsMissing, 0);
});

test('a loaded export marks many projects done at once: they were done before, not today', () => {
  const state = fresh();
  const snap = snapshotOf(state);
  state.projects[A] = { tags: 'x', reviewed: true };
  state.projects[B] = { tags: 'y', reviewed: true };
  stamp(state, snap, T1, existing);
  assert.equal(state.projects[A].doneAt, undefined);
  assert.equal(state.projects[B].doneAt, undefined);
  assert.equal(state.projects[A].at, T1, 'still stamped, so the loaded work is saved');
});

const exportOf = (projects, images) => ({ version: 4, exportedAt: '2026-10-25T08:00:00Z', projects, images });

test('load export replaces the loaded projects whole: no stale lead picture, credit or words survive', () => {
  const state = fresh();
  state.projects[A] = { tags: 'old', hero: 'a2', reviewed: false, at: T0 };
  state.projects[B] = { tags: 'kept', hero: 'b1', at: T0 };
  state.images[img(A, 1)] = { description: 'Stale words', tags: 'stale', credit: { name: 'Someone' }, at: T0 };
  state.images[img(A, 2)] = { description: 'Not in the export', tags: '', at: T0 };
  const loaded = exportOf({ [A]: { tags: 'stage, light', reviewed: true, at: 1, doneAt: 1 } }, {
    [img(A, 1)]: { projectId: A, description: 'Old caption', imageKeywords: ['dmx'], reviewed: true },
    [img(B, 1)]: { projectId: B, description: 'Not loaded: B is not in the projects', imageKeywords: [] },
  });
  assert.deepEqual(applyExport(state, loaded, T2), [A]);
  assert.deepEqual(state.projects[A], { tags: 'stage, light', reviewed: true, at: T2 }, 'the hero and the old stamps are gone');
  assert.deepEqual(state.images[img(A, 1)], { description: 'Old caption', tags: 'dmx', reviewed: true, at: T2 });
  assert.deepEqual(state.images[img(A, 2)], { at: T2 }, 'a picture the export does not list is cleared');
  assert.deepEqual(state.projects[B], { tags: 'kept', hero: 'b1', at: T0 }, 'a project not in the export is untouched');
  assert.equal(state.images[img(B, 1)], undefined);
});

test('a loaded export wins over the account copy, even where the account had a newer lead picture', () => {
  const remote = { ...fresh(), projects: { [A]: { tags: 'old', hero: 'a2', at: T1 } }, images: { [img(A, 1)]: { description: 'Remote', at: T1 } }, savedAt: T1 };
  const local = mergeStates(fresh(), remote);
  applyExport(local, exportOf({ [A]: { tags: 'stage' } }, { [img(A, 1)]: { projectId: A, description: '', imageKeywords: [] } }), T2);
  const merged = mergeStates(remote, local);
  assert.equal(merged.projects[A].hero, undefined);
  assert.equal(merged.projects[A].tags, 'stage');
  assert.equal(merged.images[img(A, 1)].description, '');
  // and stamping afterwards (save()) keeps it the newest
  const snap = snapshotOf(remote);
  stamp(local, snap, T2 + 1, existing);
  assert.ok(mergeStates(remote, local).projects[A].at >= T2);
});

test('load export refuses anything that is not a version 4 export, and changes nothing', () => {
  const state = fresh();
  state.projects[A] = { tags: 'x', at: T0 };
  assert.throws(() => applyExport(state, { version: 3, images: {} }, T2), /version 4/);
  assert.throws(() => applyExport(state, { version: 4 }, T2), /version 4/);
  assert.deepEqual(state.projects[A], { tags: 'x', at: T0 });
});
