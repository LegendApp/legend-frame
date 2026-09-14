import { expect, test } from 'bun:test';
import { MusicModel } from '../packages/cli/templates/music-lite/model';
import { compare } from '../packages/cli/templates/diff-lite/compare';
test('restoring a queue never autoplays and resumes only after a play command', async () => {
  const calls: string[] = []; let saved: unknown;
  const model = new MusicModel({ load: async () => ({ value: { version: 1, tracks: [{ id: 'one', name: 'One', uri: 'one.wav' }], currentId: 'one', position: 12 }, recovered: false }), save: async value => { saved = value; } }, async () => ({ release() { calls.push('release'); }, player: {
    async play() { calls.push('play'); }, async pause() { calls.push('pause'); }, async seekTo(seconds) { calls.push(`seek:${seconds}`); }, async remove() { calls.push('remove'); },
    async getStatus() { return { currentTime: 12, duration: 30, playing: true, didJustFinish: false, error: null }; },
  } }));
  await model.load(); expect(calls).toEqual([]); await model.play(); expect(calls).toEqual(['seek:12','play']); expect(saved).toBeDefined(); await model.dispose(); expect(calls.slice(-2)).toEqual(['remove','release']);
});
test('a failed player creation preserves the queue and reports the error', async () => {
  const model = new MusicModel({ load: async () => ({ value: null, recovered: false }), save: async () => {} }, async () => { throw Error('missing file'); });
  await model.load(); await model.add([{id:'one',name:'One',uri:'missing.wav'}]); await model.play();
  expect(model.getSnapshot().tracks).toHaveLength(1); expect(model.getSnapshot().error).toContain('missing file'); expect(model.getSnapshot().busy).toBe(false);
});
test('line comparison preserves old/new line numbers and marks additions and deletions', () => {
  expect(compare('a\nb\n', 'a\nc\n')).toEqual([
    {kind:'same',text:'a',left:1,right:1}, {kind:'removed',text:'b',left:2,right:null}, {kind:'added',text:'c',left:null,right:2},
  ]);
  expect(() => compare('a'.repeat(400_001), '')).toThrow('smaller');
});
test('disposal waits for in-flight creation and releases the player once', async () => {
  let finish!: () => void; const ready = new Promise<void>(resolve => { finish = resolve; }); const calls: string[] = [];
  const model = new MusicModel({ load: async () => ({ value: null, recovered: false }), save: async () => {} }, async () => {
    await ready; return { release() { calls.push('release'); }, player: {
      async play() { calls.push('play'); }, async pause() {}, async seekTo() {}, async remove() { calls.push('remove'); },
      async getStatus() { return { playing: true, currentTime: 0, duration: 30, didJustFinish: false, error: null }; },
    } };
  });
  await model.load(); await model.add([{ id:'one', name:'One', uri:'one.wav' }]);
  const playing = model.play(); const disposing = model.dispose(); finish(); await Promise.all([playing, disposing]);
  expect(calls).toEqual(['play', 'remove', 'release']); expect(model.getSnapshot().status.playing).toBe(false);
});
