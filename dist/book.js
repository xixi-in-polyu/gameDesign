const SPRITE_SIZE=32;
const PREVIEW_SCALE=10;
const PREVIEW_SIZE=SPRITE_SIZE*PREVIEW_SCALE;
const MAX_COLORS=16;
const STORAGE_PREFIX='artbook.sprite.32.';
const characters={
 yueling:{name:'沈月玲',native:'assets/shen-yueling-32x32.png?rev=4',preview:'assets/shen-yueling-32x32-preview.png?rev=4',verification:'assets/shen-yueling-32x32-verification.json',title:'沈月玲 · 基础六色 + 自定义',copy:'红巾、短海青衣和左腰绳圈建立身份；默认稿使用六色，编辑时可导入或选择更多颜色。',palette:[
  ['#24232A','墨黑','外轮廓与五官'],['#383E53','靛灰','宽裤与布鞋'],
  ['#46766F','海青','短衣主体'],['#AD4939','砖红','头巾与腰带'],
  ['#EDB980','暖肤','面部与手臂'],['#F3DCAF','麻白','交领、绑腿与腰绳']
 ]},
 linsi:{name:'林巳',native:'assets/lin-si-32x32.png?rev=4',preview:'assets/lin-si-32x32-preview.png?rev=4',verification:'assets/lin-si-32x32-verification.json',title:'林巳 · 基础六色 + 自定义',copy:'方脸、布帽和长灰蓝衣形成更高、更直的轮廓；默认稿使用六色，编辑时可导入或选择更多颜色。',palette:[
  ['#24232A','墨黑','外轮廓与五官'],['#3C3B46','炭灰','布帽、裤脚与鞋'],
  ['#617178','灰蓝','长衣主体'],['#A54B2D','锈红','束带与垂带'],
  ['#956C43','皮褐','工具包与火器'],['#E4C391','暖米','面部、交领、手脚与工具高光']
 ]}
};
Object.entries(characters).forEach(([key,data])=>{
 data.originalNative=data.native;
 data.originalPreview=data.preview;
 try{
  const saved=JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${key}`));
  if(saved?.native&&saved?.preview){data.native=saved.native;data.preview=saved.preview}
 }catch(error){console.warn('Stored sprite could not be read',error)}
});
let currentCharacter='linsi';
function renderPalette(){
 const data=characters[currentCharacter];
 document.querySelector('#swatches').innerHTML=data.palette.map(([hex,name,area])=>`<div class="swatch"><i style="background:${hex}"></i><strong>${name}</strong><code>${hex}</code><em>${area}</em></div>`).join('');
 document.querySelector('#palette-title').textContent=data.title;
 document.querySelector('#palette-copy').textContent=data.copy;
 document.querySelector('#verification-link').href=data.verification;
}
const stage=document.querySelector('#pixel-stage');
const sprite=document.querySelector('#sprite');
const scales=[...document.querySelectorAll('[data-scale]')];
function setScale(scale){
 const data=characters[currentCharacter];
 sprite.width=sprite.height=SPRITE_SIZE*scale;
 sprite.src=scale===PREVIEW_SCALE?data.preview:data.native;
 stage.style.setProperty('--scale',scale+'px');
 scales.forEach(button=>button.setAttribute('aria-pressed',Number(button.dataset.scale)===scale));
}
scales.forEach(button=>button.addEventListener('click',()=>setScale(Number(button.dataset.scale))));
function selectCharacter(key){
 currentCharacter=key;
 const data=characters[key];
 document.querySelectorAll('[data-character]').forEach(button=>button.setAttribute('aria-selected',button.dataset.character===key));
 document.querySelectorAll('[data-character-panel]').forEach(panel=>panel.hidden=panel.dataset.characterPanel!==key);
 document.querySelector('#sprite-label').textContent=`${data.name} · 正面立姿`;
 sprite.alt=`${data.name}的正面静态像素角色`;
 const native=document.querySelector('#native-sprite');
 native.src=data.native;native.alt=`${data.name}原生尺寸角色`;
 const download=document.querySelector('#sprite-download');
 download.href=data.native;download.setAttribute('aria-label',`下载${data.name}原生像素 PNG`);
 renderPalette();
 const selectedScale=Number(document.querySelector('[data-scale][aria-pressed="true"]')?.dataset.scale||PREVIEW_SCALE);
 setScale(selectedScale);
}
document.querySelectorAll('[data-character]').forEach(button=>button.addEventListener('click',()=>{
 selectCharacter(button.dataset.character);
 loadEditorCharacter(button.dataset.character);
}));
const grid=document.querySelector('.grid-toggle');
grid.onclick=()=>grid.setAttribute('aria-pressed',stage.classList.toggle('grid-on'));
const editorCanvas=document.querySelector('#editor-canvas');
const editorContext=editorCanvas.getContext('2d',{willReadFrequently:true});
editorContext.imageSmoothingEnabled=false;
const editorStates={};
const editorCustomColors={yueling:new Set(),linsi:new Set()};
let editorTool='pencil';
let editorColor=characters.linsi.palette[0][0];
let editorDrawing=false;
let lastEditorPoint=null;

function copyImageData(imageData){return new ImageData(new Uint8ClampedArray(imageData.data),SPRITE_SIZE,SPRITE_SIZE)}
function hexToRgb(hex){return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)]}
function rgbToHex(r,g,b){return `#${[r,g,b].map(value=>value.toString(16).padStart(2,'0')).join('').toUpperCase()}`}
function imageDataToBase64(imageData){return btoa(String.fromCharCode(...imageData.data))}
function base64ToImageData(encoded){
 const binary=atob(encoded);if(binary.length!==SPRITE_SIZE*SPRITE_SIZE*4)throw new Error('共享像素数据尺寸无效');
 const pixels=new Uint8ClampedArray(binary.length);for(let index=0;index<binary.length;index++)pixels[index]=binary.charCodeAt(index);
 return new ImageData(pixels,SPRITE_SIZE,SPRITE_SIZE);
}
function currentEditorState(){return editorStates[currentCharacter]}
function imageColors(imageData){
 const colors=new Set();
 for(let index=0;index<imageData.data.length;index+=4){
  if(imageData.data[index+3]===255)colors.add(rgbToHex(imageData.data[index],imageData.data[index+1],imageData.data[index+2]));
 }
 return colors;
}
function editorPaletteEntries(key=currentCharacter){
 const colors=editorStates[key]?imageColors(editorStates[key].imageData):new Set();
 editorCustomColors[key].forEach(hex=>colors.add(hex));
 const baseNames=new Map(characters[key].palette.map(([hex,name])=>[hex.toUpperCase(),name]));
 return [...colors].map(hex=>[hex,baseNames.get(hex)||(editorCustomColors[key].has(hex)?'自定义色':'图片颜色')]);
}

async function sourceToImageData(source){
 const image=new Image();image.src=source;await image.decode();
 const canvas=document.createElement('canvas');canvas.width=SPRITE_SIZE;canvas.height=SPRITE_SIZE;
 const context=canvas.getContext('2d',{willReadFrequently:true});context.imageSmoothingEnabled=false;
 context.clearRect(0,0,SPRITE_SIZE,SPRITE_SIZE);context.drawImage(image,0,0,SPRITE_SIZE,SPRITE_SIZE);
 return context.getImageData(0,0,SPRITE_SIZE,SPRITE_SIZE);
}

async function loadEditorCharacter(key,force=false){
 const data=characters[key];
 if(force||!editorStates[key]){
  editorStates[key]={imageData:await sourceToImageData(data.native),history:[],future:[]};
  if(force)editorCustomColors[key].clear();
 }
 if(currentCharacter!==key)return;
 const palette=editorPaletteEntries(key);if(!palette.some(([hex])=>hex===editorColor))editorColor=palette[0]?.[0]||'#24232A';
 document.querySelector('#editor-character-name').textContent=`${data.name} · 像素编辑`;
 renderEditorPalette();renderEditorCanvas();
}

function renderEditorCanvas(message){
 const state=currentEditorState();if(!state)return;
 editorContext.putImageData(state.imageData,0,0);
 const opaque=new Set();let alphaValid=true;
 for(let index=0;index<state.imageData.data.length;index+=4){
  const alpha=state.imageData.data[index+3];
  if(alpha!==0&&alpha!==255)alphaValid=false;
  if(alpha===255)opaque.add(rgbToHex(state.imageData.data[index],state.imageData.data[index+1],state.imageData.data[index+2]));
 }
 document.querySelector('#editor-color-count').textContent=opaque.size;
 document.querySelector('#editor-status').textContent=message||`32 × 32 · ${opaque.size} / ${MAX_COLORS} 色 · Alpha ${alphaValid?'0 / 255':'包含半透明'}${opaque.size>MAX_COLORS?' · 颜色过多':''}`;
 document.querySelector('#editor-undo').disabled=!state.history.length;
 document.querySelector('#editor-redo').disabled=!state.future.length;
}

function renderEditorPalette(){
 const container=document.querySelector('#editor-palette');
 container.innerHTML=editorPaletteEntries().map(([hex,name])=>`<button data-editor-color="${hex}" title="${name} ${hex}" aria-label="${name} ${hex}" aria-pressed="${hex===editorColor}"><i style="background:${hex}"></i><code>${hex}</code></button>`).join('');
 container.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{
  editorColor=button.dataset.editorColor;setEditorTool('pencil');renderEditorPalette();
 }));
 const custom=document.querySelector('#editor-custom-color');if(custom)custom.value=editorColor;
}

document.querySelector('#editor-add-color').addEventListener('click',()=>{
 const hex=document.querySelector('#editor-custom-color').value.toUpperCase();editorCustomColors[currentCharacter].add(hex);
 editorColor=hex;setEditorTool('pencil');renderEditorPalette();
});

function setEditorTool(tool){
 editorTool=tool;
 document.querySelectorAll('[data-editor-tool]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.editorTool===tool));
}

function editorPoint(event){
 const rect=editorCanvas.getBoundingClientRect();
 return {x:Math.max(0,Math.min(SPRITE_SIZE-1,Math.floor((event.clientX-rect.left)*SPRITE_SIZE/rect.width))),y:Math.max(0,Math.min(SPRITE_SIZE-1,Math.floor((event.clientY-rect.top)*SPRITE_SIZE/rect.height)))};
}

function snapshotForUndo(){
 const state=currentEditorState();
 state.history.push(copyImageData(state.imageData));
 if(state.history.length>50)state.history.shift();
 state.future=[];
}

function replacementColor(){return editorTool==='eraser'?[0,0,0,0]:[...hexToRgb(editorColor),255]}
function setEditorPixel(x,y,color=replacementColor(),render=true){
 const state=currentEditorState();const offset=(y*SPRITE_SIZE+x)*4;let changed=false;
 for(let channel=0;channel<4;channel++)if(state.imageData.data[offset+channel]!==color[channel])changed=true;
 if(!changed)return;
 for(let channel=0;channel<4;channel++)state.imageData.data[offset+channel]=color[channel];
 if(render)renderEditorCanvas();
}

function drawEditorLine(from,to){
 let x=from.x,y=from.y;const dx=Math.abs(to.x-x),sx=x<to.x?1:-1,dy=-Math.abs(to.y-y),sy=y<to.y?1:-1;let error=dx+dy;
 while(true){setEditorPixel(x,y,replacementColor(),false);if(x===to.x&&y===to.y)break;const doubled=2*error;if(doubled>=dy){error+=dy;x+=sx}if(doubled<=dx){error+=dx;y+=sy}}
 renderEditorCanvas();
}

function fillEditorArea(x,y){
 const state=currentEditorState();const data=state.imageData.data;const start=(y*SPRITE_SIZE+x)*4;
 const target=[data[start],data[start+1],data[start+2],data[start+3]];
 const replacement=[...hexToRgb(editorColor),255];
 if(target.every((value,index)=>value===replacement[index]))return;
 snapshotForUndo();
 const visited=new Uint8Array(SPRITE_SIZE*SPRITE_SIZE);const stack=[y*SPRITE_SIZE+x];
 while(stack.length){
  const point=stack.pop();if(visited[point])continue;visited[point]=1;
  const offset=point*4;if(!target.every((value,index)=>data[offset+index]===value))continue;
  replacement.forEach((value,index)=>data[offset+index]=value);
  const px=point%SPRITE_SIZE,py=Math.floor(point/SPRITE_SIZE);
  if(px>0)stack.push(point-1);if(px<SPRITE_SIZE-1)stack.push(point+1);if(py>0)stack.push(point-SPRITE_SIZE);if(py<SPRITE_SIZE-1)stack.push(point+SPRITE_SIZE);
 }
 renderEditorCanvas();renderEditorPalette();
}

function pickEditorColor(x,y){
 const data=currentEditorState().imageData.data;const offset=(y*SPRITE_SIZE+x)*4;
 if(data[offset+3]!==255){setEditorTool('eraser');return}
 const hex=rgbToHex(data[offset],data[offset+1],data[offset+2]);
 editorColor=hex;setEditorTool('pencil');renderEditorPalette();
}

editorCanvas.addEventListener('pointerdown',event=>{
 event.preventDefault();editorCanvas.setPointerCapture(event.pointerId);
 const {x,y}=editorPoint(event);
 if(editorTool==='eyedropper'){pickEditorColor(x,y);return}
 if(editorTool==='fill'){fillEditorArea(x,y);return}
 snapshotForUndo();editorDrawing=true;lastEditorPoint={x,y};setEditorPixel(x,y);
});
editorCanvas.addEventListener('pointermove',event=>{
 const {x,y}=editorPoint(event);document.querySelector('#editor-coordinate').textContent=`X ${String(x).padStart(2,'0')} · Y ${String(y).padStart(2,'0')}`;
 if(editorDrawing){drawEditorLine(lastEditorPoint,{x,y});lastEditorPoint={x,y}}
});
editorCanvas.addEventListener('pointerup',()=>{editorDrawing=false;lastEditorPoint=null;renderEditorPalette()});
editorCanvas.addEventListener('pointercancel',()=>{editorDrawing=false;lastEditorPoint=null;renderEditorPalette()});
editorCanvas.addEventListener('pointerleave',()=>{document.querySelector('#editor-coordinate').textContent='X — · Y —'});

document.querySelectorAll('[data-editor-tool]').forEach(button=>button.addEventListener('click',()=>setEditorTool(button.dataset.editorTool)));
document.querySelector('#editor-undo').addEventListener('click',()=>{
 const state=currentEditorState();if(!state?.history.length)return;
 state.future.push(copyImageData(state.imageData));state.imageData=state.history.pop();renderEditorCanvas();renderEditorPalette();
});
document.querySelector('#editor-redo').addEventListener('click',()=>{
 const state=currentEditorState();if(!state?.future.length)return;
 state.history.push(copyImageData(state.imageData));state.imageData=state.future.pop();renderEditorCanvas();renderEditorPalette();
});

function previewDataUrl(){
 const preview=document.createElement('canvas');preview.width=preview.height=PREVIEW_SIZE;
 const context=preview.getContext('2d');context.imageSmoothingEnabled=false;context.drawImage(editorCanvas,0,0,PREVIEW_SIZE,PREVIEW_SIZE);
 return preview.toDataURL('image/png');
}
function imageDataUrls(imageData){
 const native=document.createElement('canvas');native.width=native.height=SPRITE_SIZE;
 const nativeContext=native.getContext('2d');nativeContext.putImageData(imageData,0,0);
 const preview=document.createElement('canvas');preview.width=preview.height=PREVIEW_SIZE;
 const previewContext=preview.getContext('2d');previewContext.imageSmoothingEnabled=false;previewContext.drawImage(native,0,0,PREVIEW_SIZE,PREVIEW_SIZE);
 return {native:native.toDataURL('image/png'),preview:preview.toDataURL('image/png')};
}
function applySpriteToPage(key,imageData){
 const data=characters[key];const urls=imageDataUrls(imageData);data.native=urls.native;data.preview=urls.preview;
 localStorage.setItem(`${STORAGE_PREFIX}${key}`,JSON.stringify(urls));
 if(currentCharacter===key){
  const scale=Number(document.querySelector('[data-scale][aria-pressed="true"]')?.dataset.scale||PREVIEW_SCALE);setScale(scale);
  document.querySelector('#native-sprite').src=data.native;document.querySelector('#sprite-download').href=data.native;
 }
}
async function loadSharedSprite(key){
 try{
  const response=await fetch(`/api/sprite?character=${encodeURIComponent(key)}`,{cache:'no-store'});
  if(response.status===404||response.status===503)return false;
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const shared=await response.json();const imageData=base64ToImageData(shared.pixels);
  applySpriteToPage(key,imageData);delete editorStates[key];
  if(currentCharacter===key)await loadEditorCharacter(key,true);
  return true;
 }catch(error){console.warn('Shared sprite could not be loaded',error);return false}
}
function downloadDataUrl(url,filename){const link=document.createElement('a');link.href=url;link.download=filename;link.click()}
function characterFilename(){return currentCharacter==='yueling'?'shen-yueling':'lin-si'}

document.querySelector('#editor-apply').addEventListener('click',async()=>{
 const button=document.querySelector('#editor-apply');const key=currentCharacter;const imageData=copyImageData(currentEditorState().imageData);
 const used=imageColors(imageData);if(used.size>MAX_COLORS){renderEditorCanvas(`发布失败：当前使用 ${used.size} 色，最多允许 ${MAX_COLORS} 色`);return}
 button.disabled=true;button.textContent='正在发布…';renderEditorCanvas('正在替换共享角色，请稍候');
 try{
  const response=await fetch('/api/sprite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({character:key,pixels:imageDataToBase64(imageData)})});
  const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||`HTTP ${response.status}`);
  applySpriteToPage(key,imageData);renderEditorCanvas(`已发布共享版本 · ${new Date(result.updatedAt).toLocaleString()}`);
 }catch(error){
  applySpriteToPage(key,imageData);renderEditorCanvas(`共享发布失败，仅保存到当前浏览器：${error.message}`);
 }finally{button.disabled=false;button.textContent='替换网页角色（共享）'}
});
document.querySelector('#editor-export').addEventListener('click',()=>downloadDataUrl(editorCanvas.toDataURL('image/png'),`${characterFilename()}-edited-32x32.png`));
document.querySelector('#editor-export-preview').addEventListener('click',()=>downloadDataUrl(previewDataUrl(),`${characterFilename()}-edited-preview-10x.png`));
document.querySelector('#editor-reset').addEventListener('click',async()=>{
 const data=characters[currentCharacter];localStorage.removeItem(`${STORAGE_PREFIX}${currentCharacter}`);
 editorCustomColors[currentCharacter].clear();
 data.native=data.originalNative;data.preview=data.originalPreview;delete editorStates[currentCharacter];
 await loadEditorCharacter(currentCharacter,true);selectCharacter(currentCharacter);renderEditorCanvas('已恢复项目中的原始像素稿');
});

document.querySelector('#editor-import').addEventListener('change',async event=>{
 const file=event.target.files[0];event.target.value='';if(!file)return;
 const image=new Image();image.src=URL.createObjectURL(file);
 try{
  await image.decode();if(image.naturalWidth!==SPRITE_SIZE||image.naturalHeight!==SPRITE_SIZE)throw new Error('图片必须严格为 32 × 32 像素');
  const canvas=document.createElement('canvas');canvas.width=canvas.height=SPRITE_SIZE;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
  const imported=context.getImageData(0,0,SPRITE_SIZE,SPRITE_SIZE);const used=new Set();
  for(let index=0;index<imported.data.length;index+=4){
   const alpha=imported.data[index+3];if(alpha!==0&&alpha!==255)throw new Error('图片包含半透明像素');
   if(alpha===255){const hex=rgbToHex(imported.data[index],imported.data[index+1],imported.data[index+2]);used.add(hex)}
  }
  if(used.size>MAX_COLORS)throw new Error(`图片使用超过 ${MAX_COLORS} 种不透明颜色`);
  snapshotForUndo();currentEditorState().imageData=imported;editorCustomColors[currentCharacter].clear();renderEditorPalette();renderEditorCanvas(`已导入 ${file.name} · ${used.size} 色`);
 }catch(error){renderEditorCanvas(`导入失败：${error.message}`)}finally{URL.revokeObjectURL(image.src)}
});

document.querySelectorAll('[data-pixel-mode]').forEach(button=>button.addEventListener('click',async()=>{
 const edit=button.dataset.pixelMode==='edit';
 document.querySelectorAll('[data-pixel-mode]').forEach(item=>item.setAttribute('aria-selected',item===button));
 document.querySelector('#pixel-view').hidden=edit;document.querySelector('#pixel-editor').hidden=!edit;
 if(edit)await loadEditorCharacter(currentCharacter);
}));

window.addEventListener('keydown',event=>{
 if(document.querySelector('#pixel-editor').hidden||/INPUT|TEXTAREA/.test(event.target.tagName))return;
 const key=event.key.toLowerCase();const shortcuts={p:'pencil',e:'eraser',f:'fill',i:'eyedropper'};
 if(shortcuts[key]){event.preventDefault();setEditorTool(shortcuts[key])}
 if((event.metaKey||event.ctrlKey)&&key==='z'){event.preventDefault();document.querySelector(event.shiftKey?'#editor-redo':'#editor-undo').click()}
});

selectCharacter('linsi');
loadEditorCharacter('linsi');
Promise.all(Object.keys(characters).map(loadSharedSprite));
const viewer=document.querySelector('#viewer');
document.querySelectorAll('[data-image]').forEach(button=>button.onclick=()=>{
 const image=viewer.querySelector('img');
 image.src=button.dataset.image; image.alt=button.dataset.label;
 document.querySelector('#viewer-title').textContent=button.dataset.label;
 viewer.showModal();
});
viewer.querySelector('button').onclick=()=>viewer.close();
viewer.onclick=event=>{if(event.target===viewer)viewer.close()};
const links=[...document.querySelectorAll('nav a')];
function updateNav(){
 let active=links[0];
 links.forEach(link=>{if(document.querySelector(link.hash).getBoundingClientRect().top<=135)active=link});
 if(window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-2)active=links.at(-1);
 links.forEach(link=>{link.classList.toggle('active',link===active); if(link===active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current')});
}
window.addEventListener('scroll',updateNav,{passive:true});updateNav();
