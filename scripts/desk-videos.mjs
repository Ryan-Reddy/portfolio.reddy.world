// Private originals become public only when a public project or ready article uses them.
import {existsSync,mkdirSync,readFileSync,copyFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {uploadedVideoUrl,validVideoBytes,VIDEO_UPLOAD_LIMIT} from '../src/lib/uploaded-video.js';
import {readySlugs,deskIdOf} from './desk-articles.mjs';
import {isPublicArchivePost} from '../src/lib/archive-curation.js';
export function makeVideos(state,existing,originals,publicDir,allowedProjects){
 const ready=readySlugs(state,existing);let count=0;
 const pieces=[...Object.entries(state.projects??{}).filter(([id])=>allowedProjects.has(id)).map(([,p])=>p),...Object.keys(ready).map(id=>state.articles[id])];
 for(const piece of pieces)for(const video of Object.values(piece.videos??{})){
  if(video.removed)continue;
  const url=uploadedVideoUrl(video.path,video.type);
  if(!String(piece.content??'').includes('file:'+url)&&piece.bannerVideo!=='file:'+url)continue;
  const target=path.join(publicDir,url.replace(/^\/portfolio\//,''));
  if(existsSync(target))continue;
  const original=path.join(originals,path.basename(video.path));
  if(!existsSync(original))throw new Error('Video original is missing: '+video.name);
  const bytes=readFileSync(original);
  if(bytes.length>VIDEO_UPLOAD_LIMIT||!validVideoBytes(bytes,video.type))throw new Error('Video is not a supported MP4/WebM under 25 MB: '+video.name);
  mkdirSync(path.dirname(target),{recursive:true});copyFileSync(original,target);count++;
 }
 return count;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const [stateFile,originals]=process.argv.slice(2);if(!stateFile||!originals)throw new Error('usage: desk-videos.mjs <desk.json> <originals>');
 const state=JSON.parse(readFileSync(stateFile,'utf8'));
 const dir=new URL('../src/content/articles/',import.meta.url);
 const existing=existsSync(dir)?Object.fromEntries(readdirSync(dir).filter(f=>f.endsWith('.md')).map(f=>[f.replace(/\.md$/,''),{desk:deskIdOf(readFileSync(new URL(f,dir),'utf8'))}])):{};
 const allowed=new Set(['rmaekers','rrproductions','vaguelyvulgar'].flatMap(key=>JSON.parse(readFileSync(new URL('../src/data/'+key+'.json',import.meta.url),'utf8')).posts.filter(p=>isPublicArchivePost(key,p)).map(p=>key+'/'+p.slug)));
 console.log('desk-videos: '+makeVideos(state,existing,originals,fileURLToPath(new URL('../public/',import.meta.url)),allowed)+' new video files prepared');
}
