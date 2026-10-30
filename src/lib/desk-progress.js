import {isPristine} from './desk-store.js';
// Private progress is independent of publication and the ordering of image arrays.
const unique=words=>[...new Map(words.map(word=>String(word??'').trim()).filter(Boolean).map(word=>[word.toLowerCase(),word])).values()];
export function startingTags(post) {
  if(Array.isArray(post.keywords))return unique(post.keywords);
  return unique([...(post.tags??[]),...(post.categories??[])]).filter(word=>!/^(?:uncategori[sz]ed|geen categorie)$/i.test(word));
}
export function nextToReview(projects,state,from) {
  const order=Array.from({length:projects.length},(_,i)=>(from+i+1)%projects.length);
  const pending=i=>!(state.projects?.[projects[i].id]?.reviewed??projects[i].done);
  const touched=i=>!isPristine(state.projects?.[projects[i].id]) || projects[i].images.some(image=>!isPristine(state.images?.[image.key]??state.images?.[image.url],image.existingDescription));
  return order.find(i=>pending(i)&&!touched(i))??order.find(pending)??null;
}
export function rememberPlace(state,flat,now=Date.now()) {
  const item=flat[state.cursor]??flat[0];if(!item)return;
  state.place={projectId:item.project.id,imageKey:item.image.key,articleId:state.article??null,at:now};
}
export function resumeCursor(flat,state) {
  const place=state.place;
  if(place){const exact=flat.findIndex(item=>item.project.id===place.projectId&&item.image.key===place.imageKey);if(exact>=0)return exact;
    const project=flat.findIndex(item=>item.project.id===place.projectId);if(project>=0)return project;}
  return Number.isInteger(state.cursor)&&flat[state.cursor]?state.cursor:null;
}
export function samePlace(a,b) {
 const identity=s=>s?.place?[s.place.projectId,s.place.imageKey,s.place.articleId??null]:[s?.cursor??0,s?.article??null];
 return JSON.stringify(identity(a))===JSON.stringify(identity(b));
}
