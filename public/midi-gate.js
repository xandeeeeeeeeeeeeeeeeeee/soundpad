export class MidiGate {
 constructor(){this.down=new Set()}
 edge(type,channel,number,value,off=false){const key=`${type}:${channel}:${number}`,released=off||value===0;if(released){this.down.delete(key);return 'release'}if(this.down.has(key))return 'repeat';this.down.add(key);return 'press'}
 clear(){this.down.clear()}
}
