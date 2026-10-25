// The modelling page: Ryan is in the pictures, someone else took them. So in a picture's
// ImageObject he is what it is `about`, never its `creator`, and his name is not its credit or
// copyright. A photographer's credit (#50) stays where it is: only Ryan's own claims go.
// Its alt text is the picture's description; its keywords are already on the object.

const RYANS = { creditText: 'Ryan Reddy', copyrightNotice: '© Ryan Reddy' };

/** A picture's ImageObject for a page where Ryan is the subject, not the photographer */
export function subjectImageObject(object, media, personId) {
  const out = { ...object, description: media.description || media.alt || undefined, about: { '@id': personId } };
  if (out.creator?.['@id'] === personId) delete out.creator;
  for (const [key, value] of Object.entries(RYANS)) if (out[key] === value) delete out[key];
  return out;
}
