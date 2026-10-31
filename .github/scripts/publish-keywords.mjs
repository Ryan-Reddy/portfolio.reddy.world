import {readFileSync} from 'node:fs';
const repo=process.env.GITHUB_REPOSITORY;
const content=readFileSync(process.argv[2],'utf8'),data=JSON.parse(content);
if(content.length>200000 || data.market!=='NL' || data.language!=='nl-NL' || !data.keywords || !Object.keys(data.keywords).length)throw Error('Unexpected keyword dataset');
const api=async(path,method='GET',body)=>{
 const response=await fetch(`https://api.github.com/repos/${repo}${path}`,{method,headers:{Authorization:'Bearer '+process.env.GH_TOKEN,Accept:'application/vnd.github+json'},body:body?JSON.stringify(body):undefined});
 if(!response.ok)throw Error(`Keyword update HTTP ${response.status}`);return response.json();
};
const prs=await api('/pulls?state=open&base=main&per_page=100');
if(prs.some(pr=>pr.title==='Refresh keyword demand' && pr.head?.repo?.full_name===repo)){console.log('An existing keyword update awaits checks.');process.exit(0);}
const file='src/data/keyword-search.json',current=await api('/contents/'+file+'?ref=main');
if(Buffer.from(current.content,'base64').toString('utf8')===content){console.log('Keyword data already current.');process.exit(0);}
const main=await api('/git/ref/heads/main'),branch='desk/keyword-demand-'+Date.now();
await api('/git/refs','POST',{ref:'refs/heads/'+branch,sha:main.object.sha});
await api('/contents/'+file,'PUT',{message:'Refresh dated Bing keyword demand',branch,sha:current.sha,content:Buffer.from(content).toString('base64')});
const pr=await api('/pulls','POST',{title:'Refresh keyword demand',head:branch,base:'main',body:'Refresh aggregate Bing Netherlands keyword counts. Only the keyword dataset changes. Preview must pass before automatic publishing.'});
console.log('Submitted keyword data update #'+pr.number);
