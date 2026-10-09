import test from 'node:test';
import assert from 'node:assert/strict';
import { readySpeech } from './speechChunks.js';
test('first sentence is ready before the reply finishes', () => {
 assert.deepEqual(readySpeech('Hello. More text is coming',0,false),{text:'Hello.',offset:6});
});
test('subsequent chunks do not repeat spoken text', () => {
 const text='Hello. 다음 문장입니다!';
 const first=readySpeech(text,0,false);
 assert.equal(first.text,text);
 assert.equal(readySpeech(text,first.offset,false),null);
});
test('unfinished sentences wait and flush when completed', () => {
 assert.equal(readySpeech('안녕하세요',0,false),null);
 assert.deepEqual(readySpeech('안녕하세요',0,true),{text:'안녕하세요',offset:5});
});
