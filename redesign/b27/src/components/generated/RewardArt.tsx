import { Reward } from './B2Model';
import { Icon } from './B2Scene';
export function RewardArt({reward,size=64}:{reward:Reward;size?:number}){return reward.image&&/^data:image\/(png|jpeg|webp);base64,/.test(reward.image)?<img className="b24-reward-image" src={reward.image} width={size} height={size} alt=""/>:<Icon id={reward.iconId} size={size}/>;}
export async function readRewardImage(file:File):Promise<string>{
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('Выбери PNG, JPEG или WebP до 5 МБ.');
 const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas'),ratio=Math.min(1,400/Math.max(img.width,img.height));canvas.width=Math.round(img.width*ratio);canvas.height=Math.round(img.height*ratio);canvas.getContext('2d')!.drawImage(img,0,0,canvas.width,canvas.height);const result=canvas.toDataURL('image/webp',.8);if(result.length>600000)throw Error('Изображение слишком большое. Выбери другое.');return result;}finally{URL.revokeObjectURL(url);}
}
