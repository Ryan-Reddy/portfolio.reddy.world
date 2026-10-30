// One searchable index of published work and private article drafts.
const plain = value => String(value ?? '').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const searchText = values => values.flat().map(plain).join(' ').toLocaleLowerCase();
export function allDeskItems(data, state) {
  const projects = (data.projects ?? []).map((project,index) => {
    const record = state.projects?.[project.id] ?? {};
    const content = record.content ?? project.content ?? '';
    const title = plain(record.title ?? project.title) || 'Untitled project';
    return {type:'project',id:project.id,index,title,href:project.href,editable:true,
      status:(record.reviewed ?? project.done) ? 'reviewed' : 'todo',hasText:Boolean(plain(content)),
      detail:project.portfolio ?? '',search:searchText([title,record.summary ?? project.summary,content,record.tags ?? project.keywords,project.portfolio])};
  });
  const published = data.wallArticles ?? [];
  const articles = Object.entries(state.articles ?? {}).filter(([,a])=>a && !a.deleted).map(([id,article]) => {
    const live = published.find(p=>p.desk===id);
    const title = plain(article.title) || 'Untitled article';
    return {type:'article',id,title,editable:true,href:live?.href,
      status:article.status==='ready' ? (live ? 'published' : 'ready') : 'draft',hasText:Boolean(plain(article.content)),
      detail:data.kinds?.[article.kind ?? 'story']?.label ?? 'Article',at:article.at ?? article.created ?? 0,
      search:searchText([title,article.summary,article.content,article.tags,article.keywords,article.kind])};
  });
  for (const live of published) {
    // A private draft of a published piece is the one editable entry, not a second row.
    if (live.desk && state.articles?.[live.desk] && !state.articles[live.desk].deleted) continue;
    articles.push({type:'article',id:live.desk ?? live.id,title:plain(live.title)||'Untitled article',href:live.href,
      editable:false,status:'published',hasText:live.hasText !== false,detail:live.kind ?? 'Article',at:live.at ?? 0,
      search:searchText([live.title,live.summary,live.text,live.kind,live.tags])});
  }
  return [...articles.sort((a,b)=>b.at-a.at||a.title.localeCompare(b.title)),...projects];
}
export function findDeskItems(items,{query='',type='all',status='all'}={}) {
  const words = plain(query).toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(item => (type==='all'||item.type===type)
    && (status==='all'||(status==='no-text'?!item.hasText:item.status===status))
    && words.every(word=>item.search.includes(word)));
}
