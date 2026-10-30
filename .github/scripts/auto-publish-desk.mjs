import {AUTOMATIC_DESK_PUBLISHING} from '../../src/lib/publishing-policy.js';
// Only the owner's data-only desk PRs may publish after their exact head passes Preview.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export function eligible(pr,repo,files) {
 return pr.state==='open' && !pr.draft && pr.title==='Your desk changes' && pr.user?.login==='Ryan-Reddy' && pr.base?.ref==='main' && pr.head?.repo?.full_name===repo && pr.head.ref.startsWith('desk/') && files.length>0 && files.length===pr.changed_files && files.every(file=>!file.includes('..') && /^(public\/videos\/[a-z0-9]{12,40}\.(?:mp4|webm)|src\/data\/.*\.json|src\/content\/articles\/.*\.md|public\/images\/(articles|project-uploads)\/.*\.(webp|png|jpe?g|gif))$/i.test(file));
}
async function main() {
 if(!AUTOMATIC_DESK_PUBLISHING){console.log('Automatic desk publishing is disabled.');return;}
 const repo=process.env.GITHUB_REPOSITORY,event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
 const api=async(path,method='GET',body)=>{const response=await fetch('https://api.github.com/repos/'+repo+path,{method,headers:{Authorization:'Bearer '+process.env.GH_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},body:body?JSON.stringify(body):undefined});if(!response.ok)throw new Error(method+' '+path+': HTTP '+response.status);return response.json();};
 if(event.workflow_run && (event.workflow_run.conclusion!=='success' || event.workflow_run.head_repository?.full_name!==repo))return;
 const number=String(event.inputs?.number ?? '');
 const prs=/^\d+$/.test(number)?[await api('/pulls/'+number)]:await api('/commits/'+event.workflow_run.head_sha+'/pulls');
 for(const summary of prs){
  const pr=typeof summary.changed_files==='number'?summary:await api('/pulls/'+summary.number);
  const files=[];for(let page=1;;page++){const batch=await api('/pulls/'+pr.number+'/files?per_page=100&page='+page);files.push(...batch.map(file=>file.filename));if(batch.length<100)break;}
  if(!eligible(pr,repo,files))continue;
  const runs=await api('/commits/'+pr.head.sha+'/check-runs?per_page=100');
  const preview=runs.check_runs.filter(run=>run.name==='preview').sort((a,b)=>Date.parse(b.started_at)-Date.parse(a.started_at))[0];
  if(preview?.status!=='completed' || preview.conclusion!=='success'){console.log('Waiting for this version of the desk changes to pass Preview.');continue;}
  const result=await api('/pulls/'+pr.number+'/merge','PUT',{sha:pr.head.sha,merge_method:'squash',commit_title:'Publish desk changes (#'+pr.number+')'});
  if(!result.merged)throw new Error('Desk changes were not merged');
  console.log('Published checked desk changes #'+pr.number+'; the live site rebuild follows.');
 }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)await main();
