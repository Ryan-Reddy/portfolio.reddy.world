// Backups contain text/metadata and image references, never another copy of an image.
export function publicationSnapshot(desk) {
 const state=structuredClone(desk.state);
 state.wall={...desk.DATA.wall,...state.wall};
 for(const p of desk.DATA.projects){const own=state.projects[p.id] ?? {};state.projects[p.id]={title:p.title,summary:p.summary ?? '',tags:p.keywords.join(', '),content:p.content,hero:p.hero,craft:p.craft ?? '',published:p.published,pageLayout:p.pageLayout ?? 'story',bannerVideo:p.bannerVideo ?? '',bannerFocus:p.bannerFocus ?? 'center',...own};
  for(const image of p.images){state.images[image.key]={description:image.description || image.existingDescription || image.alt || '',tags:image.keywords.filter(w=>!p.keywords.includes(w)).join(', '),credit:image.credit,...state.images[image.key]};}
 }
 return state;
}
export function restoredState(current,version,now=Date.now()) {
 const restored=structuredClone(version);
 for(const kind of ['projects','images','articles','wall']){
  restored[kind] ??= {};
  for(const key of new Set([...Object.keys(current[kind] ?? {}),...Object.keys(restored[kind])])){
   const entry=restored[kind][key];
   if(!entry) restored[kind][key]=kind==='articles'?{deleted:true,at:now}:{at:now};
   else {entry.at=now;if(kind==='projects'){for(const [id,p] of Object.entries(current.projects?.[key]?.pictures ?? {}))if(!entry.pictures?.[id]){entry.pictures ??= {};entry.pictures[id]={...p,removed:true};}const empty=['summary','tags','content','hero'].filter(field=>Object.hasOwn(entry,field) && !entry[field]);entry.cleared=[...new Set([...(entry.cleared ?? []),...empty])];}}
  }
 }
 restored.savedAt=now;return restored;
}
export async function packState(state) {
 const stream=new Blob([JSON.stringify(state)]).stream().pipeThrough(new CompressionStream('gzip'));
 const bytes=new Uint8Array(await new Response(stream).arrayBuffer());let binary='';
 for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return JSON.stringify({format:'gzip',data:btoa(binary)});
}
export async function unpackState(text) {
 const value=JSON.parse(text);if(value.format!=='gzip')return value;
 const bytes=Uint8Array.from(atob(value.data),c=>c.charCodeAt(0));
 return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
}
