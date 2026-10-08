"""Extract the WordPress WXR exports into src/data/*.json.

Keeps everything the static site needs for SEO: the old URL (for redirects),
the featured image, the publish and edit dates, and the original post text with
its pictures where the post placed them: each [gallery], [caption] or <img>
becomes a <figure data-media="i,j"> placeholder pointing into the post's media
list, which holds only placed pictures (uploads never placed in the post are
mostly near-duplicate burst shots). A post without any placed picture keeps
its uploads. Exports live in src/.zOld/ (git-ignored: they contain
contact-form messages).
"""
import os
import re
import json
import html
import xml.etree.ElementTree as ET
from urllib.parse import unquote, urlparse

ROOT = os.path.join(os.path.dirname(__file__), '..')
OLD = os.path.join(ROOT, 'src', '.zOld')

SOURCES = {
    'rmaekers': {
        'name': 'RMaekers',
        'subtitle': 'Decors & Props for Theatre, Festivals & Performance',
        'path': os.path.join(OLD, 'reddymaekersproductions.wordpress.com-2026-10-01-09_14_28-qqu7fichoykjlcokkls0xmmjnwsexzoe', 'reddymaekersproductions.wordpress.com-2026-10-01-09_14_15', 'reddymaekersproductions.wordpress.com.2026-10-01.000.xml')
    },
    'rrproductions': {
        'name': 'RRproductions',
        'subtitle': "Ryan Reddy's Fine Art, Sculptures & Inventions",
        'path': os.path.join(OLD, 'ryanvanlil.wordpress.com-2026-10-01-09_13_40-bkr9q4dzikgrd7h3k0t1rdf3xkcg2ucw', 'ryanvanlil.wordpress.com-2026-10-01-09_13_32', 'ryanvanlil.wordpress.com.2026-10-01.000.xml')
    },
    'maup': {
        'name': 'Maup de Kleermaeker',
        'subtitle': 'Bespoke Furniture Design & Adaptive Craftsmanship',
        'path': os.path.join(OLD, 'mbdekleermaeker.WordPress.2026-10-01.xml')
    },
    'vaguelyvulgar': {
        'name': 'Vaguely Vulgar',
        'subtitle': "Ryan Reddy's Personal Photo & Modelling Portfolio",
        'path': os.path.join(OLD, 'vaguelyvulgar.WordPress.2026-10-01.xml')
    }
}

NS = {
    'wp': 'http://wordpress.org/export/1.2/',
    'content': 'http://purl.org/rss/1.0/modules/content/',
    'excerpt': 'http://purl.org/rss/1.0/modules/excerpt/',
    'dc': 'http://purl.org/dc/elements/1.1/'
}

VIDEO_EXT = ('.mp4', '.mov', '.m4v', '.webm')
IMAGE_EXT = ('.jpg', '.jpeg', '.png', '.gif', '.webp')


def text(el, path):
    node = el.find(path, NS)
    return (node.text or '').strip() if node is not None else ''


def meta(el, key):
    for m in el.findall('wp:postmeta', NS):
        if text(m, 'wp:meta_key') == key:
            return text(m, 'wp:meta_value')
    return ''


def base_url(url):
    return url.split('?')[0]


SHORTCODES = r'\[/?(gallery|caption|wpvideo|embed|audio|video)[^\]]*\]'
IMG_TAG = r'(?:<a\b[^>]*>\s*)?(<img\b[^>]*>)(?:\s*</a>)?'


def clean_html(raw_html):
    """Tidy post html: no leftover shortcodes, no empty paragraphs."""
    if not raw_html:
        return ''
    t = re.sub(SHORTCODES, '', raw_html)
    t = re.sub(r'<p>\s*(&nbsp;)?\s*</p>', '', t)
    return t.strip()


def plain(raw_html):
    t = re.sub(r'\[caption[^\]]*\][\s\S]*?\[/caption\]', ' ', raw_html or '')
    t = re.sub(IMG_TAG, ' ', clean_html(t), flags=re.I)
    t = re.sub(r'<[^>]+>', ' ', t)
    return ' '.join(html.unescape(t).split())


def size(metadata):
    """Width and height from a serialized _wp_attachment_metadata (the full-size entry comes first)."""
    m = re.search(r's:5:"width";i:(\d+);s:6:"height";i:(\d+);', metadata or '')
    return (int(m.group(1)), int(m.group(2))) if m else (None, None)


def utc(gmt):
    """'2016-07-20 14:17:41' (WordPress GMT) as ISO 8601 UTC, or None for drafts' zero date"""
    return gmt.replace(' ', 'T') + 'Z' if gmt and not gmt.startswith('0000') else None


def attr(tag, name):
    m = re.search(rf'\b{name}=["\']([^"\']*)["\']', tag, re.I)
    return html.unescape(m.group(1)).strip() if m else ''


def media_in_content(content):
    found = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', content, re.I)
    found += re.findall(r'<a[^>]+href=["\']([^"\']+\.(?:jpe?g|png|gif|webp|mp4|mov))["\']', content, re.I)
    found += re.findall(r'<(?:video|source)[^>]+src=["\']([^"\']+)["\']', content, re.I)
    return found


def parse_wxr(key, src):
    path = src['path']
    if not os.path.exists(path):
        print(f"File not found: {path}")
        return None

    print(f"Parsing {src['name']} ({os.path.basename(path)})...")
    channel = ET.parse(path).getroot().find('channel')
    site_url = (channel.find('link').text or '').rstrip('/')
    items = channel.findall('item')

    # Attachments by id and by URL, with their alt text
    by_id, by_url, by_parent = {}, {}, {}
    for it in items:
        if text(it, 'wp:post_type') != 'attachment':
            continue
        width, height = size(meta(it, '_wp_attachment_metadata'))
        att = {
            'id': text(it, 'wp:post_id'),
            'url': base_url(text(it, 'wp:attachment_url')),
            'title': html.unescape(it.find('title').text or ''),
            'alt': html.unescape(meta(it, '_wp_attachment_image_alt')),
            'caption': plain(text(it, 'excerpt:encoded')),
            'description': plain(text(it, 'content:encoded')),
            'width': width,
            'height': height,
        }
        if not att['url']:
            continue
        by_id[att['id']] = att
        by_url[att['url']] = att
        parent = text(it, 'wp:post_parent')
        if parent and parent != '0':
            by_parent.setdefault(parent, []).append(att)

    def media_for(url):
        url = base_url(url)
        # WordPress size variants like photo-300x200.jpg point at the original upload
        original = re.sub(r'-\d+x\d+(\.\w+)$', r'\1', url)
        if original in by_url:
            url = original
        att = by_url.get(url, {'id': '', 'url': url, 'title': '', 'alt': '', 'caption': '',
                               'description': '', 'width': None, 'height': None})
        lower = url.lower()
        kind = 'video' if lower.endswith(VIDEO_EXT) else 'image' if lower.endswith(IMAGE_EXT) else 'file'
        return {**att, 'type': kind}

    def own(url):
        """Pictures hosted by the post's own WordPress site; third-party hotlinks are left out"""
        return urlparse(url).netloc.endswith('wordpress.com')

    def place(raw):
        """Post html with each placed picture swapped for a <figure data-media> placeholder"""
        media, index = [], {}

        def ref(att, caption='', alt=''):
            if att['url'] not in index:
                index[att['url']] = len(media)
                media.append(att)
            m = media[index[att['url']]]
            if caption and not m['caption']:
                m['caption'] = caption
            if alt and not m['alt']:
                m['alt'] = alt
            return index[att['url']]

        def img(tag, caption=''):
            wp_id = re.search(r'wp-image-(\d+)', tag)
            src = attr(tag, 'src')
            att = by_id.get(wp_id.group(1)) if wp_id else None
            if att is None:
                if not src or not own(src):
                    return None
                att = media_for(src)
            if not att['url'].lower().endswith(IMAGE_EXT):
                return None
            return ref({**att, 'type': 'image'}, caption, attr(tag, 'alt'))

        def figure(indices):
            indices = [i for i in indices if i is not None]
            return f'\n\n<figure data-media="{",".join(map(str, indices))}"></figure>\n\n' if indices else ''

        def captioned(m):
            tag = re.search(IMG_TAG, m.group(1), re.I)
            if not tag:
                return ''
            caption = plain(re.sub(IMG_TAG, '', m.group(1), flags=re.I))
            return figure([img(tag.group(1), caption)])

        def gallery(m):
            ids = [g.strip() for g in m.group(1).split(',')]
            return figure([ref({**by_id[g], 'type': 'image'}) for g in ids if g in by_id])

        t = re.sub(r'\[caption[^\]]*\]([\s\S]*?)\[/caption\]', captioned, raw)
        t = re.sub(r'\[gallery[^\]]*ids=["\']([^"\']+)["\'][^\]]*\]', gallery, t)
        t = re.sub(IMG_TAG, lambda m: figure([img(m.group(1))]), t, flags=re.I)
        # a placeholder alone in a paragraph is a block of its own
        t = re.sub(r'<p\b[^>]*>\s*(<figure data-media="[^"]*"></figure>)\s*</p>', r'\1', t)
        return clean_html(re.sub(r'\n{3,}', '\n\n', t)), media

    posts = []
    for it in items:
        post_type = text(it, 'wp:post_type')
        if post_type not in ('post', 'page'):
            continue
        status = text(it, 'wp:status') or 'publish'
        if status not in ('publish', 'private'):
            continue

        post_id = text(it, 'wp:post_id')
        raw = text(it, 'content:encoded')
        body_text = plain(raw)
        excerpt = plain(text(it, 'excerpt:encoded')) or body_text
        if len(excerpt) > 220:
            excerpt = excerpt[:220].rsplit(' ', 1)[0] + '…'

        categories, tags = [], []
        for cat in it.findall('category'):
            val = html.unescape(cat.text or '').strip()
            if cat.attrib.get('domain') == 'category' and val and val != 'Uncategorized':
                categories.append(val)
            elif cat.attrib.get('domain') == 'post_tag' and val:
                tags.append(val)

        content, media = place(raw)
        # videos and documents linked in the text; uploads only when the post placed no picture
        urls = [u for u in media_in_content(raw) if not base_url(u).lower().endswith(IMAGE_EXT)]
        if not media:
            urls += [a['url'] for a in by_parent.get(post_id, [])]
        seen = {m['url'] for m in media}
        for u in urls:
            m = media_for(u)
            if m['url'] not in seen and (m['type'] != 'image' or own(m['url'])):
                seen.add(m['url'])
                media.append(m)

        featured_id = meta(it, '_thumbnail_id')
        images = [m for m in media if m['type'] == 'image']
        featured = by_id.get(featured_id) or (images[0] if images else None)
        if featured is not None and not featured['url'].lower().endswith(IMAGE_EXT):
            featured = images[0] if images else None

        old_link = (it.find('link').text or '').strip()
        title = html.unescape(it.find('title').text or '').strip() or '(Untitled)'
        slug = text(it, 'wp:post_name') or f'project-{post_id}'
        # Percent-encoded slugs (e.g. str%e2%96%b3f) don't match the decoded route param
        if '%' in slug:
            slug = re.sub(r'[^A-Za-z0-9_-]+', '-', unquote(slug)).strip('-') or f'project-{post_id}'

        posts.append({
            'id': post_id,
            'type': post_type,
            'title': title,
            'slug': slug,
            'date': text(it, 'wp:post_date'),
            'published': utc(text(it, 'wp:post_date_gmt')),
            'modified': utc(text(it, 'wp:post_modified_gmt')),
            'status': status,
            'old_url': old_link,
            'excerpt': excerpt,
            'content': content,
            'categories': sorted(set(categories)),
            'tags': sorted(set(tags)),
            'featured': featured and {k: featured[k] for k in ('id', 'url', 'alt', 'caption', 'width', 'height')},
            'media': media,
        })

    posts.sort(key=lambda p: p.get('date', ''), reverse=True)

    # Unique slugs within a portfolio
    seen_slugs = {}
    for p in posts:
        n = seen_slugs.get(p['slug'], 0)
        seen_slugs[p['slug']] = n + 1
        if n:
            p['slug'] = f"{p['slug']}-{n + 1}"

    return {
        'id': key,
        'title': html.unescape(channel.find('title').text or src['name']),
        'name': src['name'],
        'subtitle': src['subtitle'],
        'old_site': site_url,
        'post_count': len(posts),
        'media_count': len(by_id),
        'posts': posts,
    }


def main():
    out_dir = os.path.join(ROOT, 'src', 'data')
    os.makedirs(out_dir, exist_ok=True)
    for key, src in SOURCES.items():
        data = parse_wxr(key, src)
        if not data:
            continue
        with open(os.path.join(out_dir, f'{key}.json'), 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        imgs = [m for p in data['posts'] for m in p['media'] if m['type'] == 'image']
        n_inline = sum(len(re.findall(r'data-media="([^"]*)"', p['content'])) for p in data['posts'])
        print(f"  {key}.json: {data['post_count']} posts/pages, {len(imgs)} pictures"
              f" ({n_inline} placements, {sum(1 for m in imgs if m['caption'])} captioned,"
              f" {sum(1 for m in imgs if m['width'])} with size),"
              f" {sum(1 for p in data['posts'] if p['featured'])} with a featured image")


if __name__ == '__main__':
    main()
