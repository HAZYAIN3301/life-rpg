import {mkdir,copyFile,cp} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for(const file of ['index.html','workbench.css','workbench.mjs','wardrobe.mjs','contract.mjs','drawn.html','drawn.css','drawn.mjs','drawn-rig.mjs']) await copyFile(file,'dist/'+file);
await cp('public','dist',{recursive:true});
await mkdir('dist/vendor',{recursive:true});
await cp('node_modules/three/build','dist/vendor/build',{recursive:true});
await cp('node_modules/three/examples/jsm','dist/vendor/addons',{recursive:true});
await copyFile('node_modules/three/LICENSE','dist/vendor/LICENSE-Three.txt');
console.log('Built isolated wardrobe preview.');
