import test from 'node:test';
import assert from 'node:assert/strict';
import {youtubeVideoId,youtubeRange,timestamp} from '../public/youtube-range.js';
test('Player aceita links watch, curtos, shorts e live sem aceitar outros hosts',()=>{
 for(const url of ['https://www.youtube.com/watch?v=M7lc1UVf-VE&t=10','https://youtu.be/M7lc1UVf-VE?si=abc','https://youtube.com/shorts/M7lc1UVf-VE','https://youtube.com/live/M7lc1UVf-VE'])assert.equal(youtubeVideoId(url),'M7lc1UVf-VE');
 for(const url of ['https://youtube.com.evil.test/watch?v=M7lc1UVf-VE','https://youtube.com/playlist?list=abc','https://youtube.com/watch?v=abc','javascript:alert(1)','http://youtu.be/M7lc1UVf-VE','https://user@youtu.be/M7lc1UVf-VE'])assert.throws(()=>youtubeVideoId(url));
});
test('Recorte respeita precisão, duração do vídeo e limite de dez minutos',()=>{
 assert.deepEqual(youtubeRange('1.2','4.8',10),{start:1.2,end:4.8});
 assert.deepEqual(youtubeRange(0,600),{start:0,end:600});
 for(const args of [['',10],[0,''],[10,10],[-1,5],[0,601],[0,11,10],[10,11,10],['bad',3]])assert.throws(()=>youtubeRange(...args));
 assert.equal(timestamp(65.2),'1:05.2');
});
