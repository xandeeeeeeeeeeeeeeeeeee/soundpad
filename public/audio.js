import {clamp,routeFor} from './mixer-model.js';

export class Engine {
 constructor(onChange){this.buffers=new Map();this.voices=new Map();this.onChange=onChange;this.masterValue=.8;this.maxVoices=48;this.pitch=0;this.duck=false;this.channelNodes=new Map();this.state=null}
 init(){
  if(this.ctx)return;
  this.ctx=new AudioContext({latencyHint:'interactive'});
  this.master=this.ctx.createGain();this.master.gain.value=this.masterValue;
  this.masterPan=this.ctx.createStereoPanner();
  this.filter=this.ctx.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=20000;
  this.limiter=this.ctx.createDynamicsCompressor();this.limiter.threshold.value=-6;this.limiter.ratio.value=12;
  this.analyser=this.ctx.createAnalyser();this.analyser.fftSize=256;
  this.master.connect(this.masterPan).connect(this.filter).connect(this.limiter).connect(this.analyser).connect(this.ctx.destination);
  if(this.state)this.configure(this.state);
 }
 configure(state){
  this.state=state;this.masterValue=state.settings.master;this.pitch=state.settings.pitch||0;this.duck=state.settings.duck;
  if(!this.ctx)return;
  this.master.gain.setTargetAtTime(state.settings.mute?0:this.masterValue,this.ctx.currentTime,.02);
  this.masterPan.pan.setTargetAtTime(state.settings.pan||0,this.ctx.currentTime,.02);
  this.filter.frequency.setTargetAtTime(this.frequency(state.settings.filter||0),this.ctx.currentTime,.025);
  const solo=state.channels.some(c=>c.solo);
  for(const channel of state.channels){
   let node=this.channelNodes.get(channel.id);if(!node){node=this.ctx.createGain();node.connect(this.master);this.channelNodes.set(channel.id,node)}
   node.gain.setTargetAtTime(channel.mute||solo&&!channel.solo?0:clamp(channel.volume),this.ctx.currentTime,.025);
  }
  this.updateDuck();
  for(const[id,node]of this.channelNodes)if(!state.channels.some(c=>c.id===id)){node.disconnect();this.channelNodes.delete(id)}
 }
 frequency(value){return 20000*(.02**clamp(value))}
 async load(sound){this.init();if(this.buffers.has(sound.id))return this.buffers.get(sound.id);const r=await fetch(sound.url);if(!r.ok)throw Error('Arquivo ausente: '+sound.name);const buffer=await this.ctx.decodeAudioData(await r.arrayBuffer());this.buffers.set(sound.id,buffer);return buffer}
 async resume(){this.init();await this.ctx.resume()}
 volume(value){this.masterValue=value;if(this.state){this.state.settings.master=value;this.configure(this.state)}else if(this.ctx)this.master.gain.setTargetAtTime(value,this.ctx.currentTime,.02)}
 bus(name,value){const category=this.state?.categories.find(c=>c.name===name||c.id===name);if(category){category.volume=value;this.configure(this.state)}}
 bend(value){this.pitch=value;if(this.state)this.state.settings.pitch=value;this.updateDuck()}
 mod(value){if(this.state)this.state.settings.filter=value;if(this.ctx)this.filter.frequency.setTargetAtTime(this.frequency(value),this.ctx.currentTime,.03)}
 updateDuck(){
  if(!this.ctx)return;
  const audibleEffect=[...this.voices.values()].some(v=>{
   if(v.stopping)return false;
   const sound=this.state?.sounds.find(s=>s.id===v.soundId)||v.sound;
   if(!this.state)return v.category!=='Ambientes'&&v.category!=='Música';
   const slot=this.voiceSlot(v);
   const {category,channel}=routeFor(this.state,sound,slot);
   return !category?.duck&&!sound.mute&&!slot.mute&&!category?.mute&&!channel?.mute&&(!this.state.channels.some(c=>c.solo)||channel?.solo)&&(!this.state.categories.some(c=>c.solo)||category?.solo)&&(slot.volume??1)>0&&sound.volume>0&&(category?.volume??1)>0&&(channel?.volume??1)>0;
  });
  for(const voice of this.voices.values())this.updateVoice(voice,audibleEffect);
 }
 voiceSlot(voice){const current=this.state?.slots.find(s=>s.id===voice.slotId);if(!current)return voice.slot;if(!voice.slot.layer)return current;return {...current,volume:(current.volume??1)*(voice.slot.volume??1)};}
 updateVoice(voice,audibleEffect=false){
  const ctx=this.ctx,sound=this.state?.sounds.find(s=>s.id===voice.soundId)||voice.sound;
  const slot=this.voiceSlot(voice);
  const {category,channel}=this.state?routeFor(this.state,sound,slot):{};
  const categorySolo=this.state?.categories.some(c=>c.solo);
  const categoryMuted=category?.mute||categorySolo&&!category?.solo;
  const gain=voice.overrideVolume??((slot.volume??.8)*voice.velocity);
  voice.level=gain;voice.gain.gain.setTargetAtTime(slot.mute?0:gain,ctx.currentTime,.02);
  voice.soundGain.gain.setTargetAtTime(sound.mute?0:(sound.volume??1),ctx.currentTime,.02);
  voice.categoryGain.gain.setTargetAtTime(categoryMuted?0:(category?.volume??1)*(this.duck && audibleEffect && category?.duck ? 0.35 : 1),ctx.currentTime,.08);
  voice.pan.pan.setTargetAtTime(clamp((slot.pan||0)+(sound.pan||0)+(category?.pan||0)+(channel?.pan||0),-1,1),ctx.currentTime,.02);
  voice.filter.frequency.setTargetAtTime(this.frequency(Math.max(slot.filter||0,sound.filter||0,category?.filter||0,channel?.filter||0)),ctx.currentTime,.025);
  voice.source.playbackRate.setTargetAtTime(2**(clamp(this.pitch+(sound.pitch||0)+(slot.pitch||0)+(category?.pitch||0)+(channel?.pitch||0),-48,48)/12),ctx.currentTime,.025);
  const destination=this.channelNodes.get(channel?.id)||this.master;
  if(destination!==voice.destination){voice.pan.disconnect();voice.pan.connect(destination);voice.destination=destination}
  voice.name=slot.name||sound.name;voice.category=category?.name||sound.category;voice.channelId=channel?.id;voice.channelName=channel?.name||'Master';
 }
 play(sound,slot={},velocity=1,when){
  const buffer=this.buffers.get(sound.id);if(!buffer)throw Error('Som ainda não carregado');
  const ctx=this.ctx,start=Math.max(0,Number(slot.start)||0),end=Number(slot.end)>0?Math.min(Number(slot.end),buffer.duration):buffer.duration;
  if(start>=end)throw Error('Início deve ser menor que o fim do áudio');
  if(this.voices.size>=this.maxVoices)this.stop(this.voices.keys().next().value,0);
  if(slot.choke)for(const[id,v]of this.voices)if(v.choke===slot.choke)this.stop(id,.04);
  const source=ctx.createBufferSource(),envelope=ctx.createGain(),gain=ctx.createGain(),soundGain=ctx.createGain(),categoryGain=ctx.createGain(),filter=ctx.createBiquadFilter(),pan=ctx.createStereoPanner();
  filter.type='lowpass';source.buffer=buffer;source.loop=!!slot.loop;source.loopStart=start;source.loopEnd=end;
  const at=when??ctx.currentTime;envelope.gain.setValueAtTime(slot.fade>0?0:1,at);if(slot.fade>0)envelope.gain.linearRampToValueAtTime(1,at+slot.fade);
  source.connect(envelope).connect(gain).connect(soundGain).connect(categoryGain).connect(filter).connect(pan);
  const id=crypto.randomUUID(),voice={source,envelope,gain,soundGain,categoryGain,filter,pan,sound,slot,velocity,name:slot.name||sound.name,slotId:slot.id,soundId:sound.id,choke:slot.choke,category:sound.category,loop:slot.loop,level:(slot.volume??.8)*velocity};
  this.voices.set(id,voice);this.updateDuck();
  source.onended=()=>{for(const node of[source,envelope,gain,soundGain,categoryGain,filter,pan])node.disconnect();this.voices.delete(id);this.updateDuck();this.onChange()};
  if(slot.loop)source.start(at,start);else source.start(at,start,end-start);
  this.onChange();return id;
 }
 setVoiceVolume(id,level){const voice=this.voices.get(id);if(voice){voice.overrideVolume=clamp(level);this.updateDuck()}}
 stop(id,fade=.04){const v=this.voices.get(id);if(!v||v.stopping)return;v.stopping=true;const t=this.ctx.currentTime,param=v.envelope.gain;param.cancelScheduledValues(t);param.setValueAtTime(param.value,t);param.linearRampToValueAtTime(0,t+fade);v.source.stop(t+fade+.005)}
 stopSlot(id){for(const[k,v]of this.voices)if(v.slotId===id)this.stop(k)}
 stopAll(fade=.04){for(const id of this.voices.keys())this.stop(id,fade)}
}
