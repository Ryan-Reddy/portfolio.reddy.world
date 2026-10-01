import os
import re
import json
import html
import xml.etree.ElementTree as ET

SOURCES = {
    'rmaekers': {
        'name': 'RMaekers',
        'subtitle': 'Decors & Props for Theatre, Festivals & Performance',
        'path': r'F:\Online syncs\ONEDRIVE 2020 DEC\OneDrive\Documenten\reddymaekersproductions.wordpress.com-2026-10-01-09_14_28-qqu7fichoykjlcokkls0xmmjnwsexzoe\reddymaekersproductions.wordpress.com-2026-10-01-09_14_15\reddymaekersproductions.wordpress.com.2026-10-01.000.xml'
    },
    'rrproductions': {
        'name': 'RRproductions',
        'subtitle': "Ryan Reddy's Fine Art, Sculptures & Inventions",
        'path': r'F:\Online syncs\ONEDRIVE 2020 DEC\OneDrive\Documenten\ryanvanlil.wordpress.com-2026-10-01-09_13_40-bkr9q4dzikgrd7h3k0t1rdf3xkcg2ucw\ryanvanlil.wordpress.com-2026-10-01-09_13_32\ryanvanlil.wordpress.com.2026-10-01.000.xml'
    },
    'maup': {
        'name': 'Maup de Kleermaeker',
        'subtitle': 'Bespoke Furniture Design & Adaptive Craftsmanship',
        'path': r'F:\Online syncs\ONEDRIVE 2020 DEC\OneDrive\Documenten\mbdekleermaeker.WordPress.2026-10-01.xml'
    },
    'vaguelyvulgar': {
        'name': 'Vaguely Vulgar',
        'subtitle': 'Theatrical Acting & Performance Archive',
        'path': r'F:\Online syncs\ONEDRIVE 2020 DEC\OneDrive\Documenten\vaguelyvulgar.WordPress.2026-10-01.xml'
    }
}

NS = {
    'wp': 'http://wordpress.org/export/1.2/',
    'content': 'http://purl.org/rss/1.0/modules/content/',
    'excerpt': 'http://purl.org/rss/1.0/modules/excerpt/',
    'dc': 'http://purl.org/dc/elements/1.1/'
}

def clean_html(raw_html):
    if not raw_html:
        return ''
    # strip shortcodes like [gallery ids="..."]
    text = re.sub(r'\[gallery[^\]]*\]', '', raw_html)
    text = re.sub(r'\[caption[^\]]*\]', '', text)
    text = re.sub(r'\[/caption\]', '', text)
    return text.strip()

def extract_images_from_content(content):
    if not content:
        return []
    # match src="..."
    matches = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', content, re.IGNORECASE)
    # also match href links pointing to images
    hrefs = re.findall(r'<a[^>]+href=["\']([^"\']+\.(?:jpg|jpeg|png|gif|webp))["\']', content, re.IGNORECASE)
    all_imgs = []
    seen = set()
    for img in matches + hrefs:
        # strip query parameters like ?w=...
        base = img.split('?')[0]
        if base not in seen:
            seen.add(base)
            all_imgs.append(img)
    return all_imgs

def parse_wxr(key, meta):
    path = meta['path']
    if not os.path.exists(path):
        print(f"File not found: {path}")
        return None

    print(f"Parsing {meta['name']} ({path})...")
    tree = ET.parse(path)
    root = tree.getroot()
    channel = root.find('channel')

    site_title = channel.find('title').text or meta['name']
    site_desc = channel.find('description').text or meta['subtitle']

    # 1. Map attachments by post_id and parent_id
    attachments = {}
    parent_attachments = {}
    items = channel.findall('item')

    for it in items:
        pt = it.find('wp:post_type', NS)
        if pt is not None and pt.text == 'attachment':
            post_id = it.find('wp:post_id', NS).text if it.find('wp:post_id', NS) is not None else None
            parent_id = it.find('wp:post_parent', NS).text if it.find('wp:post_parent', NS) is not None else '0'
            url_node = it.find('wp:attachment_url', NS)
            url = url_node.text if url_node is not None else ''
            title = it.find('title').text or ''

            if post_id and url:
                attachments[post_id] = {'id': post_id, 'url': url, 'title': title}
                if parent_id != '0':
                    parent_attachments.setdefault(parent_id, []).append({'id': post_id, 'url': url, 'title': title})

    # 2. Extract posts and pages
    posts = []
    for it in items:
        pt = it.find('wp:post_type', NS)
        if pt is None or pt.text not in ('post', 'page'):
            continue

        status = it.find('wp:status', NS).text if it.find('wp:status', NS) is not None else 'publish'
        if status not in ('publish', 'private'):
            continue

        post_id = it.find('wp:post_id', NS).text if it.find('wp:post_id', NS) is not None else ''
        title = html.unescape(it.find('title').text or '(Untitled)')
        slug = it.find('wp:post_name', NS).text if it.find('wp:post_name', NS) is not None else ''
        date = it.find('wp:post_date', NS).text if it.find('wp:post_date', NS) is not None else ''

        content_node = it.find('content:encoded', NS)
        content_raw = content_node.text if content_node is not None and content_node.text else ''
        content = clean_html(content_raw)

        excerpt_node = it.find('excerpt:encoded', NS)
        excerpt = excerpt_node.text if excerpt_node is not None and excerpt_node.text else ''
        if not excerpt:
            # generate simple plain text excerpt
            plain = re.sub(r'<[^>]+>', ' ', content)
            plain = ' '.join(plain.split())
            excerpt = (plain[:220] + '...') if len(plain) > 220 else plain

        # Categories & Tags
        categories = []
        tags = []
        for cat in it.findall('category'):
            domain = cat.attrib.get('domain', '')
            val = html.unescape(cat.text or '')
            if domain == 'category' and val and val != 'Uncategorized':
                categories.append(val)
            elif domain == 'post_tag' and val:
                tags.append(val)

        # Images
        content_imgs = extract_images_from_content(content_raw)
        attached_imgs = [a['url'] for a in parent_attachments.get(post_id, [])]
        
        # Look for gallery shortcode ids
        gallery_ids = []
        for m in re.finditer(r'\[gallery[^\]]*ids=["\']([^"\']+)["\']', content_raw):
            gallery_ids.extend([gid.strip() for gid in m.group(1).split(',') if gid.strip()])

        for gid in gallery_ids:
            if gid in attachments:
                attached_imgs.append(attachments[gid]['url'])

        # Deduplicate images while keeping order
        all_imgs = []
        seen_img = set()
        for img in content_imgs + attached_imgs:
            clean = img.split('?')[0]
            if clean not in seen_img:
                seen_img.add(clean)
                all_imgs.append(img)

        # Featured thumbnail
        featured = None
        for meta_elem in it.findall('wp:postmeta', NS):
            k = meta_elem.find('wp:meta_key', NS)
            v = meta_elem.find('wp:meta_value', NS)
            if k is not None and k.text == '_thumbnail_id' and v is not None and v.text in attachments:
                featured = attachments[v.text]['url']
                break

        if not featured and all_imgs:
            featured = all_imgs[0]

        posts.append({
            'id': post_id,
            'title': title,
            'slug': slug or f'project-{post_id}',
            'date': date,
            'status': status,
            'excerpt': excerpt,
            'content': content,
            'categories': list(set(categories)),
            'tags': list(set(tags)),
            'featured_image': featured,
            'images': all_imgs
        })

    # Sort newest first
    posts.sort(key=lambda p: p.get('date', ''), reverse=True)

    # For galleries without posts (like Vaguely Vulgar which has 44 media attachments), generate media items
    standalone_media = []
    if not posts and attachments:
        for aid, att in attachments.items():
            standalone_media.append({
                'id': aid,
                'title': att['title'] or 'Archive Photo',
                'url': att['url']
            })

    result = {
        'id': key,
        'title': site_title,
        'name': meta['name'],
        'subtitle': meta['subtitle'],
        'post_count': len(posts),
        'media_count': len(attachments),
        'posts': posts,
        'standalone_media': standalone_media
    }
    return result

def main():
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')
    os.makedirs(out_dir, exist_ok=True)

    summary = {}
    for key, meta in SOURCES.items():
        data = parse_wxr(key, meta)
        if data:
            out_file = os.path.join(out_dir, f'{key}.json')
            with open(out_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"Saved {key}.json: {data['post_count']} posts, {data['media_count']} attachments.")
            summary[key] = {
                'name': data['name'],
                'subtitle': data['subtitle'],
                'post_count': data['post_count'],
                'media_count': data['media_count']
            }

    with open(os.path.join(out_dir, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print("\nAll portfolios extracted successfully!")

if __name__ == '__main__':
    main()
