import {mkdir,copyFile,access,cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const local=new URL('./site/assets/',import.meta.url);
await mkdir(local,{recursive:true});
const assets={
  'display.woff2':'fonts/podkova/Podkova-wght.woff2',
  'font-license.txt':'fonts/podkova/OFL.txt',
  'shadow.png':'art/companions/shadow-v3-20260730/shadow-spirit-calm.png',
  'den.jpg':'art/den/v5/den-night-lantern.jpg',
  'sound.js':'sound-engine-v1.js',
  'microphone.svg':'art/icons/ui/media-microphone.svg',
};
for(const [name,source] of Object.entries(assets)) {
  const target=new URL(name,local);
  try { await copyFile(new URL('../../public/'+source,import.meta.url),target); }
  catch(error) { if(error.code!=='ENOENT') throw error; await access(target); }
}
await access(new URL('./site/index.html',import.meta.url));
await cp(new URL('./site/',import.meta.url),new URL('./dist/',import.meta.url),{recursive:true});
console.log('Static preview ready. Existing Satoru artwork and audio engine; no account connection.');
