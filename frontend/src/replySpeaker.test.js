import test from 'node:test';
import assert from 'node:assert/strict';
import { createReplySpeaker } from './replySpeaker.js';
test('available local voices never replace the consistent server voice', async () => {
 const calls=[];
 globalThis.window={speechSynthesis:{getVoices:()=>[{lang:'ko-KR',voiceURI:'korean'}],cancel(){},speak(){throw new Error('Local voice must not be used');}},dispatchEvent(){}};
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async (_url,request)=>{calls.push(JSON.parse(request.body));return {ok:true,blob:async()=>new Blob(['audio'])};};
 globalThis.Audio=class {constructor(src){this.src=src;}play(){queueMicrotask(()=>this.onended());return Promise.resolve();}pause(){}};
 try {
  const speaker=createReplySpeaker('', 'ko');
  speaker.feed('안녕하세요! '); speaker.feed('여행을 계획해요.'); assert.equal(await speaker.end(),true);
  assert.equal(calls.map(c=>c.text).join(' '),'안녕하세요! 여행을 계획해요.');
  assert.ok(calls.every(c=>c.language_code==='ko'));
 } finally {globalThis.fetch=oldFetch;}
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
