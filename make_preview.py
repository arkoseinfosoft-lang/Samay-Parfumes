import re

with open('sections/zayro-storefront.liquid', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'{%\s*schema\s*%}.*?{%\s*endschema\s*%}', '', content, flags=re.DOTALL)
content = re.sub(r'{%\s*comment\s*%}.*?{%\s*endcomment\s*%}', '', content, flags=re.DOTALL)
content = re.sub(r'{%-\s*liquid.*?-%}', '', content, flags=re.DOTALL)

content = re.sub(r"\{\{\s*'zayro\.css'\s*\|\s*asset_url\s*\|\s*stylesheet_tag\s*\}\}", '<link rel="stylesheet" href="assets/zayro.css">', content)
content = re.sub(r"\{\{\s*'zayro\.js'\s*\|\s*asset_url\s*\|\s*script_tag\s*\}\}", '<script src="assets/zayro.js"></script>', content)
content = re.sub(r"\{\{\s*'([^']+)'\s*\|\s*asset_url\s*\}\}", r'assets/\1', content)
content = re.sub(r"\{\{\s*'now'\s*\|\s*date:[^}]+\}\}", '2026', content)
content = re.sub(r"\{\{\s*cart\.item_count\s*\}\}", '0', content)
content = re.sub(r"\{\{\s*cart\.total_price\s*\|\s*money\s*\}\}", '₹0', content)
content = re.sub(r"\{\%\-\s*if\s+cart\.item_count\s*==\s*0\s*\-\%\}.*?\{\%\-\s*else\s*\-\%\}.*?\{\%\-\s*endif\s*\-\%\}", '<div class="cart-empty-state"><div class="cart-empty-icon">&#128717;</div><p class="cart-empty-title">Your Bag is Empty</p><p class="cart-empty-sub">Experience the timeless olfactory essence of Zayro Eau de Parfum.</p><a href="#packs" class="btn-sand-solid" data-close-cart-link>EXPLORE PACKS &rarr;</a></div>', content, flags=re.DOTALL)
content = re.sub(r"\{\{\s*variant_single\.id[^}]*\}\}", 'variant-1', content)
content = re.sub(r"\{\{\s*variant_duo\.id[^}]*\}\}", 'variant-2', content)
content = re.sub(r"\{\{\s*variant_triple\.id[^}]*\}\}", 'variant-3', content)
content = re.sub(r"\{\{\s*section\.settings\.brand_title[^}]*\}\}", 'SAMAY PARFUMES', content)

full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SAMAY PARFUMES — ZAYRO Eau de Parfum</title>
  <link rel="stylesheet" href="assets/zayro.css">
</head>
<body>
{content}
</body>
</html>"""

with open('preview.html', 'w', encoding='utf-8') as f:
    f.write(full_html)

print('Successfully generated preview.html!')
