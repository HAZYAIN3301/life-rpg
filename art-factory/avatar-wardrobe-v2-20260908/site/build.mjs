import {mkdir,copyFile,cp,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await mkdir('dist',{recursive:true});
for(const file of ['index.html','workbench.css','workbench.mjs','wardrobe.mjs','contract.mjs','drawn.html','drawn.css','drawn.mjs','drawn-rig.mjs','volume.html','volume.css','volume.mjs','volume-rig.mjs']) await copyFile(file,'dist/'+file);
await cp('public','dist',{recursive:true});
await mkdir('dist/vendor',{recursive:true});
await cp('node_modules/three/build','dist/vendor/build',{recursive:true});
await cp('node_modules/three/examples/jsm','dist/vendor/addons',{recursive:true});
await copyFile('node_modules/three/LICENSE','dist/vendor/LICENSE-Three.txt');
// A mirrored Site checkout may still contain an old dist/. Publish only after
// this build; the deterministic manifest lets deployment QA verify exact bytes.
const inputs=['index.html','drawn.html','drawn.css','drawn.mjs','drawn-rig.mjs','volume.html','volume.css','volume.mjs','volume-rig.mjs','images/drawn/traveller-original.png','images/drawn/den.jpg'];
const hashes={};
for(const file of inputs){const bytes=await readFile('dist/'+file);if(!bytes.length)throw Error('Empty build asset: '+file);hashes[file]=createHash('sha256').update(bytes).digest('hex')}
await writeFile('dist/build-manifest.json',JSON.stringify({schema:1,hashes},null,2)+'\n');
console.log('Built wardrobe + drawn gesture previews; verified '+inputs.length+' critical files.');
