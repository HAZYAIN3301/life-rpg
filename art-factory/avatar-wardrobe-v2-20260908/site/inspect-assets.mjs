import fs from 'node:fs';
for(const name of ['rogue','knight','mage']){
 const b=fs.readFileSync('public/models/'+name+'.glb');
 const j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
 console.log(JSON.stringify({name,nodes:j.nodes.filter(n=>n.mesh!==undefined).map(n=>({name:n.name,t:n.translation,r:n.rotation})),joints:j.skins[0].joints.map(i=>j.nodes[i].name),roots:j.scenes,rootNodes:j.nodes.filter(n=>!j.nodes.some(p=>p.children?.includes(j.nodes.indexOf(n)))),images:j.images},null,2));
}
