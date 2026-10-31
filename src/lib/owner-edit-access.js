// A cached flag may load editor code, but only an owner-only read may reveal its controls.
export function watchOwnerEditAccess(cloud,{ready,hide,error}) {
 let generation=0,unwatch;
 hide();
 const stop=cloud.watchUser(user=>{
  const current=++generation;unwatch?.();unwatch=null;hide();
  if(!user)return;
  unwatch=cloud.watchRemote(remote=>{if(current===generation)ready(remote,user);},cause=>{if(current===generation){hide();error?.(cause);}});
 });
 return ()=>{generation++;unwatch?.();stop?.();hide();};
}
