import test from 'node:test';
import assert from 'node:assert/strict';
import {watchOwnerEditAccess} from '../src/lib/owner-edit-access.js';
test('editing controls remain absent until owner access succeeds and disappear on sign-out',()=>{
 let auth,allowed,denied,visible=false,unsubscribed=0;
 const cloud={watchUser:fn=>(auth=fn,()=>{}),watchRemote:(yes,no)=>(allowed=yes,denied=no,()=>unsubscribed++)};
 const stop=watchOwnerEditAccess(cloud,{ready:()=>visible=true,hide:()=>visible=false});
 assert.equal(visible,false);auth(null);assert.equal(visible,false);
 auth({uid:'owner'});assert.equal(visible,false);allowed({projects:{}});assert.equal(visible,true);
 const stale=allowed;auth(null);assert.equal(visible,false);assert.equal(unsubscribed,1);
 stale({projects:{}});assert.equal(visible,false);
 auth({uid:'other'});denied({code:'permission-denied'});assert.equal(visible,false);
 stop();allowed({projects:{}});assert.equal(visible,false);
});
