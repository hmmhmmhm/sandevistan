from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import hashlib,json
root=Path('output/store-hud-english-2026-11-09');out=root/'publication';out.mkdir(exist_ok=True)
font_path='/System/Library/Fonts/Supplemental/Arial.ttf'
font=lambda size:ImageFont.truetype(font_path,size)
icon=Image.open('output/public-release-prep-2026-11-09/store/icon-24.png').convert('RGBA').resize((32,32),Image.Resampling.NEAREST)
manifest=[]
for city,place in [('london','London, United Kingdom'),('new-york','Times Square, New York')]:
 for page in ['overview','news']:
  name=f'{city}-{page}';raw=root/'renders'/f'{name}-native-raw.png'
  im=Image.open(raw).convert('RGBA');native=Image.new('RGBA',im.size,'black');native.alpha_composite(im);native=native.convert('RGB')
  native.save(root/'renders'/f'{name}-native.png')
  assert native.size==(576,288)
  card=Image.new('RGB',(1280,900),'#101212');d=ImageDraw.Draw(card)
  card.paste(icon,(64,40),icon);d.text((110,43),'SANDEVISTAN',font=font(22),fill='#f4f4f4')
  d.text((64,102),'Your day, at a glance.' if page=='overview' else 'Your news. In view.',font=font(48),fill='#f4f4f4')
  d.text((66,166),'Maps, weather and device status.' if page=='overview' else 'RSS headlines, right on your glasses.',font=font(23),fill='#aab3ae')
  hud=native.resize((1152,576),Image.Resampling.NEAREST)
  card.paste(hud,(64,228))
  d.text((64,842),place+'  /  English',font=font(20),fill='#cad2cd')
  label='SIMULATOR PREVIEW';box=d.textbbox((0,0),label,font=font(14));d.text((1216-box[2],848),label,font=font(14),fill='#7e8a83')
  path=out/f'{name}.png';card.save(path)
  record=json.loads((root/'renders'/f'{name}.json').read_text())
  assert record['city']==city and record['page']==page
  assert not any(any('\uac00'<=c<='\ud7a3' for c in value) for value in record['labels'])
  assert any('OSM' in value for value in record['labels'])
  if page=='news':assert len(record['news'])==6
  manifest.append({'name':name,'path':str(path),'width':1280,'height':900,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
sheet=Image.new('RGB',(1280,900),'#101212')
for index,item in enumerate(manifest):
 im=Image.open(item['path']).resize((640,450),Image.Resampling.LANCZOS);sheet.paste(im,((index%2)*640,(index//2)*450))
sheet.save(root/'comparison.png')
(root/'asset-manifest.json').write_text(json.dumps({'status':'owner-review-draft-not-uploaded','renderer':'Production drawFastCanvasHud with en locale and real provider snapshots; standard four-tile native simulator transport','nativeHudSize':[576,288],'nativeRenderCases':4,'files':manifest},indent=2)+'\n')
print('Prepared four publication cards and comparison; English labels and OSM attribution verified.')
