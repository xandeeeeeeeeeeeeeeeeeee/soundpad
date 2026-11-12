import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedMediaURL,searchTerm,catalogEntry} from '../catalog.mjs';
import {cleanSetup} from '../public/state.js';
test('Migração remove sons antigos, referências e campanha, preservando importados e MIDI',()=>{
 const original={campaign:'antiga',sounds:[{id:'rain',kind:'synth'},{id:'user',kind:'file',url:'/audio/user.wav'}],slots:[{soundId:'rain',midi:{number:42},name:'Chuva',loop:true},{soundId:'user',name:'Arquivo pessoal'},{sceneId:'old'}],scenes:[{id:'old',layers:[{soundId:'rain'}]},{id:'mixed',layers:[{soundId:'rain'},{soundId:'user',volume:.5}]}]};
 const result=cleanSetup(original);assert.equal('campaign'in result,false);assert.deepEqual(result.sounds.map(s=>s.id),['user']);assert.equal(result.slots[0].soundId,'');assert.equal(result.slots[0].midi.number,42);assert.equal(result.slots[1].name,'Arquivo pessoal');assert.equal(result.slots[2].sceneId,'');assert.deepEqual(result.scenes,[{id:'mixed',layers:[{soundId:'user',volume:.5}]}]);assert.deepEqual(cleanSetup(structuredClone(result)),result);
});
test('Downloads aceitam apenas hosts de mídia conhecidos',()=>{
 for(const u of ['https://upload.wikimedia.org/wikipedia/commons/test.ogg','https://archive.org/download/a/b.mp3','https://ia801234.us.archive.org/0/items/a/b.wav'])assert.ok(allowedMediaURL(u));
 for(const u of ['http://archive.org/a','https://archive.org.evil.test/a','https://127.0.0.1/a','https://user:password@archive.org/a','https://archive.org:444/a','https://evil.archive.org/a'])assert.equal(allowedMediaURL(u),false);
 assert.throws(()=>catalogEntry('arbitrary-url'));
});
test('Busca traduz termos usuais sem alterar termos livres',()=>{assert.equal(searchTerm('chuva'),'rain');assert.equal(searchTerm('forest ambience'),'forest ambience');assert.equal(searchTerm(''),'rain')});
