// Factory-only: never interprets account inventory, grants gold or writes production settings.
export const SCHEMA = 'satoru.avatar-3d-pilot/1';
export const CATALOG = Object.freeze({
  hair: ['crop', 'ponytail'], top: ['traveller', 'field-vest'],
  bottom: ['trousers', 'ranger'], weapon: ['none', 'training-blade'],
  skin: ['warm', 'light', 'brown', 'deep'], hairColor: ['chestnut', 'ink', 'copper', 'silver'],
  cloth: ['teal', 'navy', 'ochre', 'plum']
});
export const COLORS = Object.freeze({
  skin: { warm: '#c9936c', light: '#e9c6a0', brown: '#936045', deep: '#593b32' },
  hairColor: { chestnut: '#3b261f', ink: '#222632', copper: '#98482c', silver: '#c4c9c7' },
  cloth: { teal: '#28696a', navy: '#354961', ochre: '#ab773b', plum: '#6c4664' }
});
export const DEFAULT_LOOK = Object.freeze({schema: SCHEMA, hair:'crop', top:'traveller', bottom:'trousers', weapon:'training-blade', skin:'warm', hairColor:'chestnut', cloth:'teal'});
export const POSES = Object.freeze(['idle','walk','sit','pet']);
export const BONE_NAMES = Object.freeze(['Hips','Spine','Chest','Neck','Head',
  'UpperArmL','LowerArmL','HandL','UpperArmR','LowerArmR','HandR',
  'UpperLegL','LowerLegL','FootL','UpperLegR','LowerLegR','FootR']);
export const PART_NAMES = Object.freeze(['Hair_crop','Hair_ponytail','Top_traveller','Top_field-vest',
  'Bottom_trousers','Bottom_ranger','HandR_open','HandR_grip','Weapon_training-blade']);
export const SOCKET_NAMES = Object.freeze(['GripR','PalmL']);
export function parseLook(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid look');
  if (value.schema !== SCHEMA) throw new Error('Unsupported look schema');
  if (Object.keys(value).some(key => key !== 'schema' && !Object.hasOwn(CATALOG,key))) throw new Error('Unknown look field');
  const result = {schema:SCHEMA};
  for (const [key,choices] of Object.entries(CATALOG)) {
    if (!choices.includes(value[key])) throw new Error(`Unsupported ${key}`);
    result[key] = value[key];
  }
  return result;
}
export function changeLook(current, key, value) { return parseLook({...parseLook(current), [key]:value}); }
export function validateGLBEnvelope(bytes) {
  if (!(bytes instanceof ArrayBuffer) || bytes.byteLength < 20 || bytes.byteLength > 12*1024*1024) throw new Error('GLB size invalid');
  const view = new DataView(bytes);
  if (view.getUint32(0,true)!==0x46546c67 || view.getUint32(4,true)!==2 || view.getUint32(8,true)!==bytes.byteLength) throw new Error('Invalid GLB header');
  const length=view.getUint32(12,true);
  if (view.getUint32(16,true)!==0x4e4f534a || length%4 || 20+length>bytes.byteLength) throw new Error('Invalid GLB JSON');
  const doc=JSON.parse(new TextDecoder().decode(bytes.slice(20,20+length)));
  // No external textures, buffers, extensions or URLs from imported user content.
  if ((doc.buffers||[]).some(b=>b.uri) || (doc.images||[]).some(i=>i.uri)) throw new Error('External resources forbidden');
  if (doc.extensionsRequired?.length || doc.extensionsUsed?.length) throw new Error('Extensions require explicit review');
  if (doc.asset?.version!=='2.0' || doc.nodes?.length>500 || doc.meshes?.length>250) throw new Error('GLB contract limits');
  return doc;
}
export function animationAllowed({visible,intersecting,reduced,paused}) { return !!visible && !!intersecting && !reduced && !paused; }
