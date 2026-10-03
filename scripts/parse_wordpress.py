"""Extract the WordPress WXR exports into src/data/*.json.

Keeps everything the static site needs for SEO: the old URL (for redirects),
attachment ids and alt text per image, and the original post text.
Exports live in src/.zOld/ (git-ignored: they contain contact-form messages).
"""
import os
import re
import json
import html
import xml.etree.ElementTree as ET
from urllib.parse import urlparse

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


def clean_html(raw_html):
    """Post text without images, galleries or shortcodes; the gallery shows the media."""
    if not raw_html:
        return ''
    t = re.sub(r'\[/?(gallery|caption|wpvideo|embed|audio|video)[^\]]*\]', '', raw_html)
    t = re.sub(r'<a[^>]*>\s*(<img[^>]*>)\s*</a>', r'\1', t, flags=re.I)
    t = re.sub(r'<img[^>]*>', '', t, flags=re.I)
    t = re.sub(r'<p>\s*(&nbsp;)?\s*</p>', '', t)
    return t.strip()


def plain(raw_html):
    t = re.sub(r'<[^>]+>', ' ', clean_html(raw_html))
    return ' '.join(html.unescape(t).split())


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
        att = {
            'id': text(it, 'wp:post_id'),
            'url': base_url(text(it, 'wp:attachment_url')),
            'title': html.unescape(it.find('title').text or ''),
            'alt': html.unescape(meta(it, '_wp_attachment_image_alt')),
            'description': plain(text(it, 'content:encoded')),
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
        att = by_url.get(url, {'id': '', 'url': url, 'title': '', 'alt': '', 'description': ''})
        lower = url.lower()
        kind = 'video' if lower.endswith(VIDEO_EXT) else 'image' if lower.endswith(IMAGE_EXT) else 'file'
        return {**att, 'type': kind}

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

        urls = media_in_content(raw) + [a['url'] for a in by_parent.get(post_id, [])]
        for m in re.finditer(r'\[gallery[^\]]*ids=["\']([^"\']+)["\']', raw):
            urls += [by_id[g]['url'] for g in m.group(1).split(',') if g.strip() in by_id]
        media, seen = [], set()
        for u in urls:
            b = base_url(u)
            # skip WordPress size variants like photo-300x200.jpg when the original is known
            original = re.sub(r'-\d+x\d+(\.\w+)$', r'\1', b)
            if original in by_url:
                b = original
            if b not in seen:
                seen.add(b)
                media.append(media_for(b))

        featured_id = meta(it, '_thumbnail_id')
        featured = by_id[featured_id]['url'] if featured_id in by_id else (media[0]['url'] if media else None)

        old_link = (it.find('link').text or '').strip()
        title = html.unescape(it.find('title').text or '').strip() or '(Untitled)'
        slug = text(it, 'wp:post_name') or f'project-{post_id}'

        posts.append({
            'id': post_id,
            'type': post_type,
            'title': title,
            'slug': slug,
            'date': text(it, 'wp:post_date'),
            'status': status,
            'old_url': old_link,
            'excerpt': excerpt,
            'content': clean_html(raw),
            'categories': sorted(set(categories)),
            'tags': sorted(set(tags)),
            'featured_image': featured,
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
        n_media = sum(len(p['media']) for p in data['posts'])
        n_alt = sum(1 for p in data['posts'] for m in p['media'] if m['alt'])
        print(f"  {key}.json: {data['post_count']} posts/pages, {n_media} media used, {n_alt} with alt text")


if __name__ == '__main__':
    main()
