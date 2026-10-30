export const VIDEO_UPLOAD_LIMIT=25*1024*1024;
export const FILE_VIDEO_KEY=/^file:\/portfolio\/videos\/[a-z0-9]{12,40}\.(?:mp4|webm)$/;
export function uploadedVideoUrl(path,type) {
 const id=/^desk-uploads\/([a-z0-9]{12,40})-[\w.-]{1,80}$/i.exec(String(path??''))?.[1];
 const ext=type==='video/mp4'?'mp4':type==='video/webm'?'webm':null;
 if(!id||!ext)throw new Error('Use an MP4 or WebM video.');
 return '/portfolio/videos/'+id+'.'+ext;
}
export function validVideoBytes(bytes,type) {
 return type==='video/mp4'?bytes.length>=12&&String.fromCharCode(...bytes.subarray(4,8))==='ftyp':type==='video/webm'?bytes.length>=4&&[0x1a,0x45,0xdf,0xa3].every((n,i)=>bytes[i]===n):false;
}
