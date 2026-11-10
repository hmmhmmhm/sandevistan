from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import hashlib,json,shutil
root=Path('output/public-release-prep-2026-11-09');store=root/'store'
icon=Image.open(store/'icon-24.png').convert('RGBA')
assert icon.size==(24,24)
assert all(a==0 or (r,g,b,a)==(244,244,244,255) for r,g,b,a in icon.getdata())
for y in range(0,24,2):
 for x in range(0,24,2):
  block=[icon.getpixel((x+dx,y+dy)) for dy in range(2) for dx in range(2)]
  assert len(set(block))==1
for name in ['ask-ai-key-setup','conversate-key-setup','quick-menu-return','phone-home','phone-ai-setup']:
 shutil.copyfile(root/'actual'/f'{name}.png',store/f'screenshot-{name}.png')
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',22)
small=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',16)
sheet=Image.new('RGB',(1200,790),'#171717');draw=ImageDraw.Draw(sheet)
draw.text((24,20),'SANDEVISTAN 0.2.7 — actual simulator captures',font=font,fill='white')
draw.text((24,55),'Keyless Korean profile / compiled public build / simulated telemetry',font=small,fill='#bbb')
draw.text((24,95),'Glasses: setup guidance',font=small,fill='white')
sheet.paste(Image.open(root/'actual/ask-ai-key-setup.png').convert('RGB'),(24,125))
draw.text((24,438),'Glasses: root quick menu',font=small,fill='white')
sheet.paste(Image.open(root/'actual/quick-menu-return.png').convert('RGB'),(24,468))
phone=Image.open(root/'actual/phone-ai-setup.png').convert('RGB');phone.thumbnail((550,660))
sheet.paste(phone,(630,110));draw.text((630,85),'Phone: key issuance and registration',font=small,fill='white')
sheet.save(root/'review-sheet.png')
files=[store/'icon-24.png',store/'background.png',root/'review-sheet.png',*sorted(store.glob('screenshot-*.png'))]
records=[]
for path in files:
 im=Image.open(path)
 records.append({'path':str(path),'bytes':path.stat().st_size,'width':im.width,'height':im.height,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
(root/'asset-manifest.json').write_text(json.dumps({'iconPixelRulesVerified':True,'screenshots':'Actual native simulator framebuffer/WebView exports; fixture only overrides local storage. No physical-device claim.','files':records},indent=2)+'\n')
print('Verified icon pixel rules and prepared actual screenshots, review sheet and hashes.')
