import fs from 'node:fs';
for(const name of ['rogue','knight','mage']){
const b=fs.readFileSync('public/models/'+name+'.glb'),end=20+b.readUInt32LE(12),j=JSON.parse(b.subarray(20,end)),img=j.bufferViews[j.images[0].bufferView];fs.writeFileSync('../'+name+'-source-texture.png',b.subarray(end+8+img.byteOffset,end+8+img.byteOffset+img.byteLength));
function vals(id){const a=j.accessors[id],v=j.bufferViews[a.bufferView],n={VEC2:2,VEC3:3,SCALAR:1}[a.type],C={5126:Float32Array,5123:Uint16Array,5125:Uint32Array}[a.componentType];return new C(b.buffer,b.byteOffset+end+8+(v.byteOffset||0)+(a.byteOffset||0),a.count*n);}
for(const node of j.nodes.filter(n=>/_(Head|ArmLeft|Body)$/.test(n.name))){
const m=j.meshes[node.mesh].primitives[0],uv=vals(m.attributes.TEXCOORD_0),p=vals(m.attributes.POSITION),idx=vals(m.indices),groups={};
for(let i=0;i<idx.length;i+=3){const vs=[idx[i],idx[i+1],idx[i+2]],u=vs.reduce((s,k)=>s+uv[k*2],0)/3,v=vs.reduce((s,k)=>s+uv[k*2+1],0)/3,key=Math.floor(u*8)+','+Math.floor(v*4),g=groups[key]||={n:0,min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};g.n++;for(const k of vs)for(let d=0;d<3;d++){g.min[d]=Math.min(g.min[d],p[k*3+d]);g.max[d]=Math.max(g.max[d],p[k*3+d]);}}
console.log(node.name,JSON.stringify(groups));
}}
