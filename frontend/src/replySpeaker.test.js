import test from 'node:test';
import assert from 'node:assert/strict';
import { createReplySpeaker } from './replySpeaker.js';
test('voice replies speak streamed text in the detected language', async () => {
 const spoken=[];
 globalThis.window={speechSynthesis:{getVoices:()=>[{lang:'ko-KR',voiceURI:'korean'}],cancel(){},speak(u){spoken.push(u);queueMicrotask(()=>u.onend());}},dispatchEvent(){}};
 globalThis.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
 const speaker=createReplySpeaker('', 'ko');
 speaker.feed('안녕하세요! '); speaker.feed('여행을 계획해요.'); await speaker.end();
 assert.equal(spoken.map(u=>u.text).join(' '),'안녕하세요! 여행을 계획해요.');
 assert.ok(spoken.every(u=>u.lang==='ko'));
});
test('missing browser voice uses server audio rather than dropping speech', async () => {
 const calls=[];let plays=0;
 globalThis.window={speechSynthesis:{getVoices:()=>[],cancel(){}},dispatchEvent(){}};
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async (url,request)=>{calls.push({url,body:JSON.parse(request.body)});return {ok:true,blob:async()=>new Blob(['audio'])};};
 globalThis.Audio=class {constructor(src){this.src=src;}play(){plays++;queueMicrotask(()=>this.onended());return Promise.resolve();}pause(){}};
 try {
  const speaker=createReplySpeaker('/backend','ko');speaker.feed('안녕하세요!');await speaker.end();
  assert.equal(calls[0].url,'/backend/api/speak');assert.equal(calls[0].body.text,'안녕하세요!');assert.equal(plays,1);
 } finally {globalThis.fetch=oldFetch;}
});
test('all supported languages use server speech when no local voice exists', async () => {
 const oldFetch=globalThis.fetch;
 const requests=[];
 globalThis.window={speechSynthesis:{getVoices:()=>[],cancel(){}},dispatchEvent(){}};
 globalThis.fetch=async (_url,request)=>{requests.push(JSON.parse(request.body));return {ok:true,blob:async()=>new Blob(['audio'])};};
 globalThis.Audio=class {constructor(src){this.src=src;}play(){queueMicrotask(()=>this.onended());return Promise.resolve();}pause(){}};
 try {
  for (const code of ['en','zh','es','fr','de','si','ta','ko','hi','it','ar']) {
   const speaker=createReplySpeaker('',code);speaker.feed('A short reply.');assert.equal(await speaker.end(),true);
   assert.equal(requests.at(-1).language_code,code);
  }
 } finally {globalThis.fetch=oldFetch;}
});
test('server failures are reported instead of silently pretending playback succeeded', async () => {
 const oldFetch=globalThis.fetch;
 globalThis.window={speechSynthesis:{getVoices:()=>[],cancel(){}},dispatchEvent(){}};
 globalThis.fetch=async()=>({ok:false});
 try {const speaker=createReplySpeaker('','ar');speaker.feed('مرحبا.');assert.equal(await speaker.end(),false);} finally {globalThis.fetch=oldFetch;}
});
