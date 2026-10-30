export const PICTURE_ID = /^p[a-z0-9]{1,60}$/;
export function projectPictureFolder(projectId) {
  if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(projectId)) throw new Error('Invalid project address');
  return 'project-uploads/' + projectId;
}
export function projectPictureUrl(projectId,id) {
  if (!PICTURE_ID.test(id)) throw new Error('Invalid picture id');
  return '/portfolio/images/' + projectPictureFolder(projectId) + '/' + id + '.webp';
}
export function appendProjectPictures(state,data,photos={}) {
  let count=0;
  for (const [projectId,record] of Object.entries(state.projects ?? {})) {
    const [portfolio,slug]=projectId.split('/');
    const post=data[portfolio]?.posts.find(p=>p.slug===slug);
    if (!post) continue;
    for (const [id,p] of Object.entries(record.pictures ?? {})) {
      if (!PICTURE_ID.test(id)) continue;
      const previous=post.media.find(m=>m.deskPicture===id);
      if(p.removed){if(previous)previous.duplicate_of=-1;if(post.featured?.deskPicture===id)delete post.featured;continue;}
      if(!photos[projectId]?.[id]) continue;
      if(previous)delete previous.duplicate_of;
      const made=photos[projectId][id], url=projectPictureUrl(projectId,id);
      const own=state.images?.[projectId+'::'+url] ?? {};
      const media={type:'image',url,deskPicture:id,width:made.width,height:made.height,alt:own.description || p.alt || post.title+' — photo '+(post.media.filter(m=>m.type==='image').length+1),title:p.name ?? '',srcset:made.srcset};
      const found=post.media.find(m=>m.deskPicture===id);
      if (!found) {post.media.push(media);count++;}
      else Object.assign(found,{width:made.width,height:made.height});
    }
  }
  return count;
}
export function resolveProjectPictures(content,media) {
  return String(content ?? '').replace(/<figure\s+data-picture="([a-z0-9]+)"\s*>\s*<\/figure>/gi,(_,id)=>{
    const index=media.findIndex(m=>m.deskPicture===id);
    return index<0 ? '' : '<figure data-media="'+index+'"></figure>';
  });
}
