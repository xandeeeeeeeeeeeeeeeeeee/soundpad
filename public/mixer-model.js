export const parameters = {
  volume: {label:'Volume',min:0,max:1,unit:'%'},
  pan: {label:'Panorama',min:-1,max:1,unit:''},
  filter: {label:'Filtro passa-baixas',min:0,max:1,unit:'%'},
  pitch: {label:'Tom / velocidade',min:-24,max:24,unit:'st'},
  mute: {label:'Mute',min:0,max:1,unit:''}
};
export const clamp=(n,min=0,max=1)=>Math.min(max,Math.max(min,Number(n)||0));
export const mixDefaults=()=>({volume:1,pan:0,filter:0,pitch:0,mute:false,solo:false});
export function upgradeMixer(state){
  const names=['Ambientes','Efeitos','Magia','Combate','Música','Importados',...state.sounds.map(s=>s.category||'Importados')];
  state.categories??=[...new Set(names)].map((name,i)=>({id:'category-'+i,name,...mixDefaults(),duck:['Ambientes','Música'].includes(name)}));
  state.channels??=['Ambiência','Música','Efeitos','Voz'].map((name,i)=>({id:'channel-'+i,name,...mixDefaults()}));
  if(!state.channels.length)state.channels.push({id:'channel-0',name:'Geral',...mixDefaults()});
  for(const sound of state.sounds){
    let category=state.categories.find(c=>c.id===sound.categoryId)||state.categories.find(c=>c.name===sound.category);
    if(!category){category={id:crypto.randomUUID(),name:sound.category||'Importados',...mixDefaults()};state.categories.push(category)}
    sound.categoryId=category.id;sound.category=category.name;
    if(!state.channels.some(c=>c.id===sound.channelId))sound.channelId=state.channels[category.name==='Ambientes'?0:category.name==='Música'?Math.min(1,state.channels.length-1):Math.min(2,state.channels.length-1)].id;
    for(const [key,value] of Object.entries(mixDefaults()))sound[key]??=value;
  }
  state.settings.filter??=0;state.settings.pan??=0;state.settings.pitch??=0;state.settings.mute??=false;
  for(const slot of state.slots){slot.pitch??=0;slot.filter??=0;slot.mute??=false;slot.channelId??=''}
  for(const knob of state.knobs){
    if(knob.binding)continue;
    const category=state.categories.find(c=>c.name===knob.action);
    knob.binding={scope:category?'category':'master',target:category?.id||'',parameter:knob.action==='filter'?'filter':knob.action==='pitch'?'pitch':'volume',min:knob.action==='pitch'?-12:0,max:knob.action==='pitch'?12:1,curve:'linear',invert:false,mode:'absolute',step:.01};
    if(category&&!state.mixerVersion&&Number(knob.id.slice(4))<8)category.volume=knob.value;
  }
  state.mixerVersion=1;
  return state;
}
export function knobPosition(previous,raw,mode='absolute',step=.01){
  raw=clamp(raw,0,127);
  if(mode==='absolute')return raw/127;
  let delta=mode==='relative-offset'?raw-64:mode==='relative-sign'?(raw>=64?-(raw-64):raw):(raw>63?raw-128:raw);
  return clamp(previous+delta*clamp(step,.001,.25));
}
export function bindingValue(binding,position){
  let value=clamp(position);if(binding.invert)value=1-value;if(binding.curve==='square')value*=value;
  return Number(binding.min)+(Number(binding.max)-Number(binding.min))*value;
}
export function bindingTarget(state,binding){
  if(binding.scope==='master')return state.settings;
  const key={category:'categories',channel:'channels',sound:'sounds',slot:'slots'}[binding.scope];
  return state[key]?.find(item=>item.id===binding.target)||null;
}
export function setBinding(state,binding,position){
  const target=bindingTarget(state,binding);if(!target)return false;
  const parameter=binding.parameter,value=bindingValue(binding,position),limits=parameters[parameter];
  if(!limits)return false;
  const key=binding.scope==='master'&&parameter==='volume'?'master':parameter;
  target[key]=parameter==='mute'?value>=.5:clamp(value,limits.min,limits.max);
  return true;
}
export function routeFor(state,sound,slot={}){
  return {category:state.categories.find(c=>c.id===sound.categoryId),channel:state.channels.find(c=>c.id===(slot.channelId||sound.channelId))||state.channels[0]};
}
export function validateBinding(binding){
  if(!parameters[binding.parameter])throw Error('Escolha um parâmetro válido.');
  const p=parameters[binding.parameter],min=Number(binding.min),max=Number(binding.max);
  if(!Number.isFinite(min)||!Number.isFinite(max)||min>=max||min<p.min||max>p.max)throw Error(`Limites permitidos: ${p.min} a ${p.max}; mínimo deve ser menor que máximo.`);
  if(!['absolute','relative-twos','relative-offset','relative-sign'].includes(binding.mode))throw Error('Modo de encoder inválido.');
}
export function midiConflicts(items){
  const result=[];
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
    const a=items[i],b=items[j],x=a.midi,y=b.midi;
    if(!x||!y||x.type!==y.type||x.number!==y.number||x.channel&&y.channel&&x.channel!==y.channel)continue;
    if(a.id.startsWith('pad')&&b.id.startsWith('pad')&&Math.floor(Number(a.id.slice(3))/8)!==Math.floor(Number(b.id.slice(3))/8))continue;
    if(a.id.startsWith('knob')&&b.id.startsWith('knob')&&Math.floor(Number(a.id.slice(4))/8)!==Math.floor(Number(b.id.slice(4))/8))continue;
    result.push(`${a.id} / ${b.id}`);
  }
  return result;
}
