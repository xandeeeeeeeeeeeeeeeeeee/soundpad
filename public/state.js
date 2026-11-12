// Remove o conteúdo antigo incluído pelo aplicativo sem alterar arquivos importados.
export function cleanSetup(state){
 delete state.campaign;
 const removed=new Set((state.sounds||[]).filter(s=>s.kind!=='file').map(s=>s.id));
 state.sounds=(state.sounds||[]).filter(s=>s.kind==='file');
 const removedScenes=new Set();
 state.scenes=(state.scenes||[]).filter(scene=>{const before=scene.layers.length;scene.layers=scene.layers.filter(l=>!removed.has(l.soundId));if(before&&!scene.layers.length){removedScenes.add(scene.id);return false}return true});
 for(const slot of state.slots||[]){if(removed.has(slot.soundId)||removedScenes.has(slot.sceneId)){slot.soundId='';slot.sceneId='';slot.name='';slot.loop=false;slot.mode='oneshot';slot.start=0;slot.end=0;slot.color='#7799bd'}}
 return state;
}
