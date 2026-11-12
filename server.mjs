import http from 'node:http';
import {cleanSetup} from './public/state.js';
import {searchCatalog,downloadCatalog} from './catalog.mjs';
import path from 'node:path';
import {mkdir,readFile,writeFile,rename,stat,unlink} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const root=path.dirname(fileURLToPath(import.meta.url));
const data=process.env.SOUNDPAD_DATA_DIR?path.resolve(process.env.SOUNDPAD_DATA_DIR):path.join(root,'data'), audio=path.join(data,'audio');
await mkdir(audio,{recursive:true});
const jobs=new Map();
export function youtubeURL(value){let u;try{u=new URL(value)}catch{throw Error('URL inválida')};if(u.protocol!=='https:'||!['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(u.hostname)||u.username||u.password||u.port)throw Error('Use um link HTTPS do YouTube');return u.href;}
export function clipRange(start,end){start=Number(start);end=Number(end);if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end-start>600)throw Error('O trecho deve ter entre 0 e 600 segundos');return {start,end};}
function executable(name){const packaged=path.join(root,'tools',name+'.exe');if(process.platform==='win32'&&existsSync(packaged))return packaged;const local=name==='ffmpeg'?path.join(root,'node_modules','ffmpeg-static',process.platform==='win32'?'ffmpeg.exe':'ffmpeg'):path.join(root,'tools','yt-dlp.exe');return existsSync(local)?local:name;}
function run(bin,args,timeout=180000){return new Promise((resolve,reject)=>{const child=spawn(bin,args,{windowsHide:true,shell:false});let log='';const timer=setTimeout(()=>{child.kill();reject(Error('Tempo limite excedido'))},timeout);child.stderr.on('data',b=>{log=(log+b).slice(-3000)});child.stdout.on('data',()=>{});child.on('error',e=>{clearTimeout(timer);reject(e)});child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error(log||`Processo terminou com ${code}`))})})}
async function body(req,max=150*1024*1024){let size=0,chunks=[];for await(const b of req){size+=b.length;if(size>max)throw Error('Arquivo muito grande (máximo 150 MB)');chunks.push(b)}return Buffer.concat(chunks)}
function json(res,value,code=200){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value))}
export function createServer(){return http.createServer(async(req,res)=>{try{
 const host=req.headers.host;if(!['127.0.0.1:3210','localhost:3210'].includes(host)){json(res,{error:'Host não permitido'},403);return}
 if(req.headers.origin&&!['http://127.0.0.1:3210','http://localhost:3210'].includes(req.headers.origin)){json(res,{error:'Origem não permitida'},403);return}
 const url=new URL(req.url,'http://127.0.0.1:3210');
 if(url.pathname==='/api/catalog'&&req.method==='GET'){json(res,await searchCatalog(url.searchParams.get('q')||'rain',url.searchParams.get('source')||'all',url.searchParams.get('page')||1));return}
 if(url.pathname==='/api/catalog/import'&&req.method==='POST'){const input=JSON.parse((await body(req,4096)).toString());const {entry,bytes}=await downloadCatalog(input.id);const id=randomUUID(),ext=path.extname(new URL(entry.mediaUrl).pathname).toLowerCase();if(!['.wav','.mp3','.ogg','.oga','.flac'].includes(ext))throw Error('Formato indisponível');const original=path.join(audio,id+ext);await writeFile(original,bytes);let file=id+ext;try{await run(executable('ffmpeg'),['-nostdin','-y','-i',original,'-vn','-ac','2','-ar','44100',path.join(audio,id+'.converted.wav')]);file=id+'.converted.wav';await unlink(original)}catch{}json(res,{url:'/audio/'+file,entry});return}
 if(url.pathname==='/api/health'&&req.method==='GET'){json(res,{application:'soundpad',version:'1.0.0'});return}
 if(url.pathname==='/api/status'){const check=async n=>{try{await run(executable(n),[n==='ffmpeg'?'-version':'--version'],5000);return true}catch{return false}};const [yt,ff]=await Promise.all([check('yt-dlp'),check('ffmpeg')]);json(res,{youtube:yt,ffmpeg:ff});return}
 if(url.pathname==='/api/setup'){
  if(req.method==='GET'){try{json(res,cleanSetup(JSON.parse(await readFile(path.join(data,'setup.json'),'utf8'))))}catch(e){if(e.code!=='ENOENT')throw e;json(res,null)}return}
  if(req.method==='PUT'){const config=cleanSetup(JSON.parse((await body(req,10*1024*1024)).toString()));if(config.version!==1||!Array.isArray(config.sounds)||!Array.isArray(config.slots))throw Error('Setup inválido');await writeFile(path.join(data,'setup.tmp'),JSON.stringify(config));await rename(path.join(data,'setup.tmp'),path.join(data,'setup.json'));json(res,{ok:true});return}
 }
 if(url.pathname==='/api/audio'&&req.method==='POST'){const id=randomUUID(),ext=path.extname(url.searchParams.get('name')||'audio.wav').toLowerCase();if(!['.wav','.mp3','.ogg','.flac','.m4a','.aac','.aiff','.aif','.opus','.webm','.mp4','.wma'].includes(ext))throw Error('Formato não suportado');const input=path.join(audio,id+ext);await writeFile(input,await body(req));let file=id+ext;try{await run(executable('ffmpeg'),['-nostdin','-y','-i',input,'-vn','-ac','2','-ar','44100',path.join(audio,id+'.converted.wav')]);file=id+'.converted.wav';await unlink(input)}catch{}json(res,{url:'/audio/'+file});return}
 if(url.pathname==='/api/youtube'&&req.method==='POST'){
  const input=JSON.parse((await body(req,4096)).toString()),source=youtubeURL(input.url),range=clipRange(input.start,input.end),id=randomUUID();jobs.set(id,{status:'running'});
  (async()=>{try{await run(executable('yt-dlp'),['--ignore-config','--no-playlist','--no-warnings','--js-runtimes','node:'+process.execPath,'--ffmpeg-location',executable('ffmpeg'),'--download-sections',`*${range.start}-${range.end}`,'--force-keyframes-at-cuts','-f','bestaudio/best','-x','--audio-format','wav','--max-filesize','150M','-o',path.join(audio,id+'.%(ext)s'),'--',source],300000);await stat(path.join(audio,id+'.wav'));jobs.set(id,{status:'done',url:'/audio/'+id+'.wav'})}catch(e){jobs.set(id,{status:'error',error:e.message})}})();json(res,{id},202);return
 }
 if(url.pathname.startsWith('/api/jobs/')){json(res,jobs.get(url.pathname.split('/').pop())||{status:'error',error:'Importação não encontrada'});return}
 if(req.method!=='GET'){json(res,{error:'Método não permitido'},405);return}
 const isAudio=url.pathname.startsWith('/audio/');const base=isAudio?audio:path.join(root,'public');const relative=isAudio?url.pathname.slice(7):(url.pathname==='/'?'index.html':url.pathname.slice(1));const target=path.resolve(base,decodeURIComponent(relative));if(!target.startsWith(base+path.sep)){json(res,{error:'Caminho inválido'},403);return}
 const content=await readFile(target);const type={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.wav':'audio/wav','.mp3':'audio/mpeg','.svg':'image/svg+xml','.json':'application/json'}[path.extname(target)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(content);
 }catch(e){json(res,{error:e.code==='ENOENT'?'Arquivo não encontrado':e.message},e.code==='ENOENT'?404:400)}})}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))createServer().listen(3210,'127.0.0.1',()=>console.log('Grimoire Soundpad → http://127.0.0.1:3210'));

