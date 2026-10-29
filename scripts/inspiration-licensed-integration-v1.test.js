'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Provider=require('../server-inspiration-pexels-v1.js'),Owner=require('../server-inspiration-profile-v1.js'),Profile=require('../public/inspiration-profile-v1.js'),Runtime=require('../public/inspiration-supply-runtime-v1.js');
const signer=Provider.createSigner(()=>'fixture');
const candidate=signer.sign(Provider.photoCandidate({id:123,url:'https://www.pexels.com/photo/forest-123/',photographer:'Ada',alt:'Forest trail',src:{large:'https://images.pexels.com/photos/123/forest.jpeg'}},'nature','2026-10-29T12:00:00.000Z'));
function profile(){return Profile.configure({...Profile.emptyProfile(),interests:[{id:'nature',label:'Природа'}],formats:['image']});}
test('signed licensed findings survive the existing field CAS owner and reload',()=>{
 const base=profile();const selected=Runtime.ensureDigest({profile:base,day:'2026-10-29',now:'2026-10-29T12:01:00.000Z',candidates:[candidate],locale:'ru'});
 assert.equal(selected.items[0]?.id,candidate.id);
 const result=Owner.prepareCommit({inspiration:base,unrelated:'keep'},{base,profile:selected.profile,finds:[candidate]},{verifyLicensed:signer.verify});
 assert.equal(result.ok,true);assert.equal(result.settings.unrelated,'keep');assert.equal(result.settings.inspirationFinds[0].supplyProof,candidate.supplyProof);
 const repeated=Owner.prepareCommit(result.settings,{base,profile:selected.profile,finds:[candidate]},{verifyLicensed:signer.verify});assert.equal(repeated.replay,true);
});
test('client cannot mint or alter a licensed candidate even with otherwise valid metadata',()=>{
 const base=profile();for(const item of [{...candidate,supplyProof:'0'.repeat(64)},{...candidate,interestIds:['finance']}]){
  const result=Owner.prepareCommit({inspiration:base},{base,profile:base,finds:[item]},{verifyLicensed:signer.verify});assert.equal(result.ok,false);
 }
});
test('today remains fixed and tomorrow cannot repeat a shown Pexels identity',()=>{
 const options={profile:profile(),day:'2026-10-29',now:'2026-10-29T12:01:00.000Z',candidates:[candidate],locale:'ru'};
 const first=Runtime.ensureDigest(options);assert.equal(first.items.length,1);const shown=Profile.recordShown(first.profile,options.day);
 assert.equal(Runtime.ensureDigest({...options,profile:shown,candidates:[]}).profile.digest.ids[0],candidate.id);
 const tomorrow=Runtime.ensureDigest({...options,profile:shown,day:'2026-10-30',now:'2026-10-30T12:01:00.000Z'});assert.equal(tomorrow.items.length,0);
});
test('saved Pexels references remain usable as source links after rolling inventory expires',()=>{
 const saved={id:'saved',catalogId:candidate.id,url:candidate.delivery.sourceUrl,note:'Keep this'};
 const resolved=Runtime.resolveSaved(saved,[]);assert.equal(resolved.supplyUnavailable,false);assert.equal(resolved.mediaPolicy,'link');assert.equal(resolved.url,saved.url);assert.equal(resolved.note,'Keep this');assert.equal(resolved.videoUrl,'');
 assert.equal(Runtime.resolveSaved({...saved,url:'https://evil.invalid/photo'},[]).supplyUnavailable,true);
});
test('an explicit removed licensed resource is refused rather than normalized back to unknown',()=>{
 const result=Runtime.ensureDigest({profile:profile(),day:'2026-10-29',now:'2026-10-29T12:01:00.000Z',candidates:[{...candidate,available:false,availabilityReason:'removed'}],locale:'ru'});
 assert.equal(result.items.length,0);
});
