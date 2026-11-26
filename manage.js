'use strict';
// 纯静态的本地编辑器：读取公开 JSON，只将编辑结果导出到用户的电脑。
(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => document.querySelectorAll(selector);
  const builtins = [
    ['pose','姿势','poses.json'],['depth','深度姿势','depths.json'],
    ['costume','服装','costumes.json'],['anime','动画服装','anime.json'],
    ['portrait','人像','portraits.json'],['expr','表情','expressions.json'],
    ['hair','发型','hair.json'],['dyn','历代服饰','dynasties.json'],
    ['scene','场景','scenes.json'],['light','光影','lights.json'],
    ['prop','道具','props.json'],['furn','家具','furniture.json']
  ];
  const configPath = 'gallery/categories.json';
  const imageKeys = new Set(['image','thumbnail','cover','poster','preview','original','t','m','i','o']);
  const states = new Map();
  let config = {groups:[],categories:[],collectionFilters:{gallery:[],works:[]}};
  let configDirty = false;
  let selectedGroup = -1, selectedCategory = -1;
  let selectedCollectionFilter = '';
  let sourcePath = 'gallery/gallery.json', selectedIndex = -1, draft = null, draftNew = false, formDirty = false;
  let toastTimer;

  const clone = data => JSON.parse(JSON.stringify(data));
  const cleanPath = path => String(path || '').replace(/^\/+/, '');
  const validPath = path => /^gallery\/[a-z0-9_/-]+\.json$/.test(cleanPath(path)) && !cleanPath(path).includes('..');
  const validId = id => /^[a-z0-9-]+$/.test(id);
  const validUrl = url => { try { const p = new URL(url); return p.protocol === 'https:' || p.protocol === 'http:'; } catch { return false; } };
  const setText = (selector, value) => { $(selector).textContent = String(value ?? ''); };
  function toast(message) {
    const el = $('#toast');el.textContent = message;el.classList.add('show');
    clearTimeout(toastTimer);toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
  }
  function fileText(path) {
    if (path === configPath) return JSON.stringify(config, null, 2) + '\n';
    const source = states.get(path);
    return source ? JSON.stringify(source.raw, null, 2) + '\n' : '[]\n';
  }
  function markDirty(path) {
    if (path === configPath) configDirty = true;
    else if (states.has(path)) states.get(path).dirty = true;
    updateDirty();
  }
  function dirtyPaths() {
    const result = configDirty ? [configPath] : [];
    for (const [path,source] of states) if(source.dirty) result.push(path);
    return result;
  }
  function updateDirty() {
    const files = dirtyPaths(),badge = $('#dirtyBadge');
    badge.textContent = files.length ? `${files.length} 个文件待导出` : '尚未修改';
    badge.classList.toggle('dirty',!!files.length);
    const list = $('#changedFiles');list.replaceChildren();
    if(!files.length)list.textContent='暂无修改';
    else for(const path of files){const code=document.createElement('code');code.textContent=path;list.append(code);}
    $('#exportAll').disabled = !files.length;
  }
  const filenames = () => [
    {path:'gallery/gallery.json',name:'画廊',kind:'gallery'},
    {path:'gallery/works.json',name:'作品',kind:'works'},
    {path:'gallery/video-assets.json',name:'视频',kind:'video'},
    ...config.categories.filter(c => c.id !== 'gallery' && validPath(c.file)).map(c => ({path:cleanPath(c.file),name:`自定义 · ${c.name}`,kind:'custom'})),
    ...builtins.map(([id,name,path]) => ({path,name:`原图库 · ${name}`,kind:'builtin',id}))
  ];
  const descriptor = path => filenames().find(x => x.path === path);
  function refreshSourceOptions() {
    const sources = filenames();
    for(const selector of ['#sourceSelect','#migrationSource']){
      const select = $(selector),before = select.value;select.replaceChildren();
      for(const src of sources){const option=document.createElement('option');option.value=src.path;option.textContent=src.name;select.append(option);}
      select.value=sources.some(x=>x.path===before)?before:sourcePath;
    }
  }
  async function loadSource(path) {
    path = cleanPath(path);
    if(states.has(path))return states.get(path);
    const info=descriptor(path);
    if(!info)throw Error('未找到图库配置：' + path);
    const response=await fetch('./'+path,{cache:'no-cache'});
    if(!response.ok){
      if(response.status===404 && info.kind==='custom'){
        const fresh={raw:[],items:[],dirty:true,isNew:true};states.set(path,fresh);updateDirty();return fresh;
      }
      throw Error(`读取 ${path} 失败（HTTP ${response.status}），已停止以免覆盖原数据`);
    }
    const raw=await response.json();
    const items=Array.isArray(raw)?raw:Array.isArray(raw?.items)?raw.items:null;
    if(!items)throw Error(path+' 不是有效的图库 JSON 数组');
    const state={raw,items,dirty:false,isNew:false};states.set(path,state);return state;
  }
  function safeSelect(selector,value) { $(selector).value=String(value ?? ''); }
  function createRow(label,info,selected,onSelect,onUp,onDown,onDelete) {
    const row=document.createElement('div');row.className='menu-row'+(selected?' selected':'');
    const main=document.createElement('button');main.type='button';main.className='menu-info';
    const name=document.createElement('strong');name.textContent=label;
    const sub=document.createElement('span');sub.textContent=info;
    main.append(name,sub);main.onclick=onSelect;row.append(main);
    const tools=document.createElement('div');tools.className='menu-tools';
    for(const [text,title,fn] of [['↑','上移',onUp],['↓','下移',onDown],['×','删除',onDelete]]){
      const button=document.createElement('button');button.type='button';button.textContent=text;button.title=title;button.setAttribute('aria-label',title+' '+label);button.onclick=fn;tools.append(button);
    }
    row.append(tools);return row;
  }
  function reorder(list,index,direction) {
    const next=index+direction;if(next<0||next>=list.length)return;
    [list[index],list[next]]=[list[next],list[index]];
    markDirty(configPath);return next;
  }
  function categoryCount(category) {
    const src=states.get(cleanPath(category.file));
    return src ? src.items.length : (Number.isSafeInteger(category.count)?category.count:0);
  }
  function renderGroups() {
    const el=$('#groupList');el.replaceChildren();
    if(!config.groups.length){el.textContent='尚无自定义一级菜单；可以先新建一个。';el.classList.add('muted','small');}
    else{el.classList.remove('muted','small');config.groups.forEach((group,i)=>{
      el.append(createRow(group.name,group.id,i===selectedGroup,()=>selectGroup(i),
        ()=>{selectedGroup=reorder(config.groups,i,-1)??i;renderGroups();},
        ()=>{selectedGroup=reorder(config.groups,i,1)??i;renderGroups();},
        ()=>removeGroup(i)));
    });}
    if(selectedGroup>=config.groups.length)selectedGroup=-1;
  }
  function selectGroup(index) {
    selectedGroup=index;const value=config.groups[index]||{};
    safeSelect('#groupName',value.name);safeSelect('#groupId',value.id);
    $('#groupId').disabled=index>=0;renderGroups();
  }
  function removeGroup(index) {
    const group=config.groups[index];
    if(!confirm(`删除一级菜单「${group.name}」？其中的二级图库会移回默认「环境与物件」，不会删除图片。`))return;
    for(const item of config.categories)if(item.group===group.id)delete item.group;
    config.groups.splice(index,1);selectedGroup=-1;markDirty(configPath);
    renderGroups();renderCategories();refreshGroupChoices();
  }
  function refreshGroupChoices() {
    const select=$('#categoryGroup'),before=select.value;select.replaceChildren();
    const base=document.createElement('option');base.value='';base.textContent='环境与物件（默认）';select.append(base);
    for(const group of config.groups){const option=document.createElement('option');option.value=group.id;option.textContent=group.name;select.append(option);}
    select.value=config.groups.some(x=>x.id===before)?before:'';
  }
  function renderCategories() {
    const el=$('#categoryList');el.replaceChildren();
    config.categories.forEach((category,i)=>{
      const group=config.groups.find(x=>x.id===category.group)?.name||'环境与物件';
      const info=category.id==='gallery'?'画廊主页面（保留）':`${group} · ${categoryCount(category)} 项`;
      el.append(createRow(category.name,info,i===selectedCategory,()=>selectCategory(i),
        ()=>{selectedCategory=reorder(config.categories,i,-1)??i;renderCategories();},
        ()=>{selectedCategory=reorder(config.categories,i,1)??i;renderCategories();},
        ()=>removeCategory(i)));
    });
  }
  const collectionPaths = {gallery:'gallery/gallery.json',works:'gallery/works.json'};
  const collectionKind = path => Object.keys(collectionPaths).find(view=>collectionPaths[view]===path);
  function filterRows(view) {
    return Array.isArray(config.collectionFilters?.[view]) ? config.collectionFilters[view] : [];
  }
  function refreshItemCategoryChoices(value='') {
    const view=collectionKind(sourcePath),select=$('#itemCategorySelect');
    if(!view)return;
    select.replaceChildren();
    const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='请选择已配置的二级分类';select.append(placeholder);
    const names=new Set();
    for(const row of filterRows(view)){
      const name=String(row.name||'').trim();
      if(!name||names.has(name))continue;
      names.add(name);
      const option=document.createElement('option');option.value=name;
      option.textContent=name+(row.adult===true?' · 仅 R18 开启后显示':'');select.append(option);
    }
    if(value&&!names.has(value)){
      const legacy=document.createElement('option');legacy.value=value;legacy.textContent=value+' · 未配置（不会出现筛选按钮）';select.append(legacy);
    }
    select.value=value||'';
    $('#itemCategoryHelp').textContent=value&&!names.has(value)
      ? '⚠ 这个分类尚未在「分类配置」中登记。图片仍可在「全部」中显示，但不会自动生成筛选按钮。'
      : '这里只能选择已配置的分类。新增菜单请使用「01 分类配置」；图片 tags 不会创建任何菜单。';
  }
  function selectCollectionFilter(name='') {
    selectedCollectionFilter = name;
    const row=filterRows($('#collectionFilterView').value).find(item=>item.name===name);
    safeSelect('#collectionFilterName',name);
    $('#collectionFilterName').disabled=!!name;
    $('#collectionFilterAdult').checked=row?.adult===true;
    $('#resetCollectionFilter').disabled=!row;
    $('#removeCollectionFilter').disabled=!row;
    renderCollectionFilterList();
  }
  async function renderCollectionFilterList() {
    const view=$('#collectionFilterView').value,list=$('#collectionFilterList');
    const records=new Map();
    for(const row of filterRows(view))if(row?.name?.trim())records.set(row.name.trim(),row.adult===true);
    const unconfigured=[];
    try{
      const source=await loadSource(collectionPaths[view]);
      if(view!==$('#collectionFilterView').value)return;
      for(const item of source.items){
        const name=String(item.subcategory||item.category||'其他').trim();
        if(name&&name!=='未分类'&&!records.has(name)&&!unconfigured.includes(name))unconfigured.push(name);
      }
    }catch(error){toast('分类读取失败：'+error.message);}
    if(view!==$('#collectionFilterView').value)return;
    list.replaceChildren();
    if(!records.size)list.textContent='暂无已配置分类。点击右侧「新建」添加第一项。';
    for(const [name,adult] of records){
      const button=document.createElement('button');button.type='button';
      button.className='collection-filter-choice'+(name===selectedCollectionFilter?' selected':'');
      const label=document.createElement('strong');label.textContent=name;
      const status=document.createElement('small');status.textContent=adult?'仅 R18 开启后显示':'普通分类 · 始终显示';
      status.className=adult?'adult-label':'public-label';
      button.append(label,status);button.onclick=()=>selectCollectionFilter(name);list.append(button);
    }
    const notice=$('#collectionUnconfigured');notice.replaceChildren();notice.hidden=!unconfigured.length;
    if(unconfigured.length){
      const hint=document.createElement('p');hint.textContent='以下名称已出现在图片的 subcategory 中，但没有配置菜单。它们不会自动成为筛选按钮：';notice.append(hint);
      const actions=document.createElement('div');actions.className='unconfigured-buttons';
      for(const name of unconfigured){
        const button=document.createElement('button');button.type='button';button.textContent='+ 登记 '+name;
        button.onclick=()=>{selectCollectionFilter('');safeSelect('#collectionFilterName',name);$('#collectionFilterName').focus();};actions.append(button);
      }
      notice.append(actions);
    }
  }
  function saveCollectionFilter(event) {
    event.preventDefault();
    const view=$('#collectionFilterView').value,name=$('#collectionFilterName').value.trim();
    if(!name)return toast('请填写二级分类名称');
    if(name==='全部')return toast('「全部」是系统保留选项，请换一个分类名');
    const rows=filterRows(view),adult=$('#collectionFilterAdult').checked;
    const existing=rows.find(row=>row.name===name);
    if(existing)existing.adult=adult;
    else rows.push({name,adult});
    config.collectionFilters[view]=rows;
    markDirty(configPath);selectCollectionFilter(name);
    if(collectionKind(sourcePath)===view&&draft)refreshItemCategoryChoices($('#itemCategorySelect').value);
    toast('分类可见性规则已保存；请导出 categories.json 并提交 GitHub');
  }
  function resetCollectionFilter() {
    const view=$('#collectionFilterView').value,name=selectedCollectionFilter;
    if(!name)return;
    const row=filterRows(view).find(item=>item.name===name);
    if(!row)return;
    row.adult=false;
    markDirty(configPath);selectCollectionFilter(name);
    if(collectionKind(sourcePath)===view&&draft)refreshItemCategoryChoices($('#itemCategorySelect').value);
    toast('该分类已设为普通分类；R18 关闭时也会显示按钮');
  }
  function removeCollectionFilter() {
    const view=$('#collectionFilterView').value,name=selectedCollectionFilter;
    if(!name)return;
    if(!confirm(`从「${view==='gallery'?'画廊':'作品'}」筛选菜单中移除「${name}」？图片不会删除，但该分类按钮将不再显示。`))return;
    config.collectionFilters[view]=filterRows(view).filter(row=>row.name!==name);
    markDirty(configPath);selectCollectionFilter('');
    if(collectionKind(sourcePath)===view&&draft)refreshItemCategoryChoices($('#itemCategorySelect').value);
    toast('分类按钮已移除；已有图片仍可在「全部」中查看');
  }
  function selectCategory(index) {
    selectedCategory=index;const c=config.categories[index]||{};
    safeSelect('#categoryName',c.name);safeSelect('#categoryId',c.id);
    safeSelect('#categoryFile',c.file|| (c.id?'/gallery/'+c.id+'.json':''));
    safeSelect('#categorySuggestions',(c.suggestions||[]).join(', '));
    safeSelect('#categoryGroup',c.group||'');
    $('#categoryId').disabled=index>=0;$('#categoryFile').disabled=index>=0;
    renderCategories();
  }
  function removeCategory(index) {
    const c=config.categories[index];
    if(c.id==='gallery')return toast('画廊主页面的配置不能在这里删除');
    if(!confirm(`从菜单中移除「${c.name}」？已在 GitHub 存在的 JSON 不会自动删除。`))return;
    config.categories.splice(index,1);selectedCategory=-1;markDirty(configPath);
    renderCategories();refreshSourceOptions();
  }
  async function saveGroup(event) {
    event.preventDefault();const name=$('#groupName').value.trim(),id=$('#groupId').value.trim().toLowerCase();
    if(!name||!validId(id))return toast('菜单 ID 只能使用小写字母、数字和连字符');
    if(selectedGroup<0){
      if(config.groups.some(x=>x.id===id))return toast('此一级菜单 ID 已存在');
      config.groups.push({id,name});selectedGroup=config.groups.length-1;
    }else config.groups[selectedGroup].name=name;
    markDirty(configPath);renderGroups();refreshGroupChoices();renderCategories();selectGroup(selectedGroup);
    toast('一级菜单已保存，记得导出后提交 GitHub');
  }
  function saveCategory(event) {
    event.preventDefault();const name=$('#categoryName').value.trim(),id=$('#categoryId').value.trim().toLowerCase();
    const group=$('#categoryGroup').value,file=cleanPath($('#categoryFile').value.trim());
    if(!name||!validId(id)||!validPath(file))return toast('请输入有效名称、英文 ID 和 gallery/ 下的 JSON 路径');
    const suggestions=$('#categorySuggestions').value.split(/[,，]/).map(s=>s.trim()).filter(Boolean);
    if(selectedCategory<0){
      if(config.categories.some(x=>x.id===id))return toast('二级图库 ID 已存在');
      if(config.categories.some(x=>cleanPath(x.file)===file))return toast('该 JSON 文件已被其他图库使用');
      const entry={id,name,file:'/'+file,count:0,suggestions};if(group)entry.group=group;
      config.categories.push(entry);selectedCategory=config.categories.length-1;
      const newData={raw:[],items:[],dirty:true,isNew:true};states.set(file,newData);
    }else{
      const entry=config.categories[selectedCategory];entry.name=name;entry.suggestions=suggestions;
      if(group)entry.group=group;else delete entry.group;
    }
    markDirty(configPath);refreshSourceOptions();renderCategories();selectCategory(selectedCategory);
    toast('二级图库已保存；可以前往「图片与提示词」添加图片');
  }
  function unsavedGuard() {
    if(!formDirty)return true;
    return confirm('当前条目还有未保存的编辑，确定放弃这些改动吗？');
  }
  async function changeSource(path) {
    if(!unsavedGuard()){safeSelect('#sourceSelect',sourcePath);return false;}
    const requested=cleanPath(path),old=sourcePath;sourcePath=requested;
    safeSelect('#sourceSelect',requested);setText('#sourceStatus','正在读取 '+requested+' …');
    try{
      const source=await loadSource(requested);
      selectedIndex=-1;draft=null;draftNew=false;formDirty=false;
      setText('#sourceStatus',`${source.items.length} 条内容 · ${requested}`);
      setText('#emptyEditor',descriptor(requested)?.kind==='video'?'从左侧选择一条视频，编辑视频直链、封面、介绍和提示词。':'从左侧选择一张图片，即可编辑图片直链、提示词和 R18 标记。');
      renderItems();renderEditor();updateDirty();return true;
    }catch(error){sourcePath=old;safeSelect('#sourceSelect',old);toast(error.message);setText('#sourceStatus',error.message);return false;}
  }
  function itemLabel(item) {return String(item?.title||item?.ti||item?.zh||item?.no||item?.id||'未命名');}
  function itemCategoryValue(item,info) {
    if(info?.kind!=='builtin')return String(item?.subcategory||item?.category||item?.cat||'');
    const key={portrait:'sec',expr:'emo',dyn:'era'}[info.id]||'cat';
    return String(item?.[key]||'');
  }
  function renderItems() {
    const source=states.get(sourcePath),info=descriptor(sourcePath),el=$('#itemList');el.replaceChildren();
    if(!source)return;
    const query=$('#itemSearch').value.trim().toLowerCase();
    const matches=source.items.map((item,i)=>({item,i})).filter(({item})=>{
      return !query || [item.id,item.no,itemLabel(item),itemCategoryValue(item,info)].some(v=>String(v||'').toLowerCase().includes(query));
    });
    for(const {item,i} of matches.slice(0,150)){
      const button=document.createElement('button');button.type='button';button.className='item-choice'+(selectedIndex===i&&!draftNew?' on':'');
      const name=document.createElement('span');name.textContent=itemLabel(item);
      const num=document.createElement('small');num.textContent=item.no||item.id||String(i+1);
      button.append(name,num);button.onclick=()=>selectItem(i);el.append(button);
    }
    if(!matches.length)el.textContent='没有匹配的素材';
    setText('#listNote',`匹配 ${matches.length} 条，最多显示前 150 条。可通过搜索精确定位。`);
    const isNewAllowed=info?.kind!=='builtin';
    $('#newItem').disabled=!isNewAllowed;$('#newItem').textContent=info?.kind==='video'?'+ 新增视频':'+ 新增图片';
    $('#duplicateItem').disabled=!isNewAllowed||!draft;
  }
  function selectItem(index) {
    if(!unsavedGuard())return;
    const source=states.get(sourcePath);selectedIndex=index;
    draft=clone(source.items[index]);draftNew=false;formDirty=false;
    renderItems();renderEditor();
  }
  function newItem(duplicate=false) {
    if(!unsavedGuard())return;
    const info=descriptor(sourcePath);if(!info||info.kind==='builtin')return toast('原始图库建议只编辑已有内容；新增素材请使用自定义图库');
    const items=states.get(sourcePath)?.items||[];
    const id='new-'+Date.now();
    const fresh=info.kind==='video'
      ? {id,title:'新视频',subcategory:'未分类',video_url:'',thumbnail:'',description:'',prompt_zh:'',prompt_en:'',adult:false,tags:[]}
      : {id,title:'新图片',subcategory:collectionKind(sourcePath)?'':'未分类',image:'',prompt_zh:'',prompt_en:'',adult:false,tags:[],...(collectionKind(sourcePath)?{reference_images:[]}:{})};
    draft=duplicate&&draft?clone(draft):fresh;
    draft.id=id;draftNew=true;selectedIndex=-1;formDirty=true;
    renderItems();renderEditor();
  }
  function valuesFor(item,info){
    const key=info?.kind==='builtin'?({portrait:'sec',expr:'emo',dyn:'era'}[info.id]||'cat'):'subcategory';
    const titleKey=info?.kind==='video'?'title':'title'in item?'title':'ti'in item?'ti':null;
    const zhKey='prompt_zh'in item?'prompt_zh':'zh'in item?'zh':'prompt_zh';
    const enKey='prompt_en'in item?'prompt_en':'en'in item?'en':'prompt_en';
    return {categoryKey:key,titleKey,zhKey,enKey};
  }
  function imageFields(item) {
    const fields=[];
    for(const key of imageKeys)if(typeof item[key]==='string')fields.push({key,path:[key],label:key,value:item[key]});
    if(Array.isArray(item.angles))item.angles.forEach((angle,i)=>{
      for(const key of imageKeys)if(typeof angle[key]==='string')fields.push({key,path:['angles',i,key],label:key,value:angle[key],angle:angle.zh||angle.en||`视角 ${i+1}`});
    });
    return fields;
  }
  function renderImageFields() {
    const el=$('#imageFields');el.replaceChildren();if(!draft)return;
    const fields=imageFields(draft),groups=new Map();
    for(const field of fields){const group=field.angle||'默认图片';
      if(!groups.has(group))groups.set(group,[]);groups.get(group).push(field);
    }
    if(!fields.length && !Array.isArray(draft.angles)){
      draft.image='';groups.set('默认图片',[{key:'image',path:['image'],label:'image',value:''}]);
    }
    for(const [title,entries] of groups){
      const group=document.createElement('div');group.className='image-group';
      const heading=document.createElement('h5');heading.textContent=title;group.append(heading);
      for(const field of entries){
        const row=document.createElement('div');row.className='image-row';
        const label=document.createElement('label');
        const videoSource=descriptor(sourcePath)?.kind==='video';
        label.textContent=({t:'缩略图 t',m:'中图 m',i:'高清图 i',o:'原图 o',image:videoSource?'视频封面':'展示图',thumbnail:videoSource?'视频封面':'缩略图',cover:'视频封面',poster:'视频封面 Poster',preview:'预览图',original:'原图'})[field.key]||field.label;
        const input=document.createElement('input');input.type='url';input.placeholder='https://你的图床/...';input.value=field.value;
        input.dataset.path=JSON.stringify(field.path);input.addEventListener('input',()=>{
          let target=draft;for(const part of field.path.slice(0,-1))target=target[part];target[field.path[field.path.length-1]]=input.value.trim();
          formDirty=true;updateImagePreview();
        });
        row.append(label,input);group.append(row);
      }el.append(group);
    }
    updateImagePreview();
  }
  function updateImagePreview(){
    const item=draft,fields=item?imageFields(item):[];
    const url=(fields.find(f=>['cover','poster','image','t','thumbnail','preview','i','m'].includes(f.key)&&validUrl(f.value))||fields.find(f=>validUrl(f.value)))?.value;
    const image=$('#itemPreview'),player=$('#itemVideoPreview');
    const isVideo=descriptor(sourcePath)?.kind==='video';
    const videoUrl=isVideo?String(item?.video_url||item?.video||item?.src||'').trim():'';
    const playable=isVideo&&validUrl(videoUrl);
    player.hidden=!playable;
    if(playable){
      if(player.src!==videoUrl)player.src=videoUrl;
      if(url)player.poster=url;else player.removeAttribute('poster');
      image.hidden=true;$('#previewHint').hidden=true;
    }else{
      if(!player.paused)player.pause();
      player.removeAttribute('src');player.load();
      image.hidden=!url;$('#previewHint').hidden=!!url;
      if(url)image.src=url;else image.removeAttribute('src');
    }
  }
  function renderEditor() {
    const hasItem=!!draft,info=descriptor(sourcePath);
    $('#itemForm').hidden=!hasItem;$('#emptyEditor').hidden=hasItem;
    $('#deleteItem').disabled=!hasItem||draftNew||info?.kind==='builtin';
    $('#copyCurrentItem').disabled=!hasItem;
    setText('#editTitle',!hasItem?'选择一条内容开始编辑':draftNew?(info?.kind==='video'?'新增视频':'新增图片'):itemLabel(draft));
    if(!hasItem){
      const player=$('#itemVideoPreview');if(!player.paused)player.pause();player.removeAttribute('src');player.load();player.hidden=true;
      $('#itemPreview').hidden=true;$('#previewHint').hidden=false;
      return;
    }
    const keys=valuesFor(draft,info);
    const isVideo=info?.kind==='video';
    safeSelect('#itemId',draft.id||'');
    $('#itemId').disabled=!draftNew;
    $('#itemTitle').disabled=!keys.titleKey;
    safeSelect('#itemTitle',keys.titleKey?draft[keys.titleKey]:'');
    $('#titleLabel').firstChild.textContent=isVideo?'视频标题':keys.titleKey?'图片标题':'图片标题（使用中文描述）';
    $('#itemTitle').placeholder=isVideo?'输入视频标题':'图片名称';
    const collection=!!collectionKind(sourcePath);
    $('#referenceImagesField').hidden=!collection;
    const referenceImages=Array.isArray(draft.reference_images)?draft.reference_images.map(entry=>typeof entry==='string'?entry:entry?.url||'').filter(Boolean):typeof draft.reference_images==='string'?[draft.reference_images]:[];
    safeSelect('#itemReferenceImages',referenceImages.join('\n'));
    $('#itemCategoryTextWrap').firstChild.textContent=isVideo?'视频分类（可选）':collection?'二级分类':'内容分类';
    $('#itemCategory').placeholder=isVideo?'如：AI短片、动态写真':'如：人物写真';
    $('#videoUrlField').hidden=!isVideo;
    safeSelect('#itemVideoUrl',draft.video_url||draft.video||draft.src||'');
    $('#itemVideoUrl').required=isVideo;
    $('#itemDescription').parentElement.firstChild.textContent=isVideo?'视频介绍':'图片介绍';
    $('#itemTags').parentElement.firstChild.textContent=isVideo?'视频标签（逗号分隔）':'图片标签（仅说明图片，不影响菜单）';
    $('#itemZh').parentElement.firstChild.textContent=isVideo?'中文视频提示词':'中文提示词';
    $('#itemEn').parentElement.firstChild.textContent=isVideo?'英文视频提示词':'英文提示词';
    $('.image-editor-heading h4').textContent=isVideo?'视频封面地址':'图片地址';
    $('.image-editor-heading .muted').textContent=isVideo?'填写封面图直链，用于视频播放前展示':'可分别修改缩略图、预览图、原图及多角度图片';
    $('#copyCurrentItem').textContent=isVideo?'复制这条视频的 JSON':'复制这条图片的 JSON';
    $('#itemCategoryTextWrap').hidden=collection;
    $('#itemCategorySelectWrap').hidden=!collection;
    $('#itemCategoryActions').hidden=!collection;
    safeSelect('#itemCategory',draft[keys.categoryKey]||'');
    if(collection)refreshItemCategoryChoices(String(draft[keys.categoryKey]||'').trim());
    else if(isVideo)$('#itemCategoryHelp').textContent='视频分类直接填写即可；前台会根据视频条目的分类自动生成筛选按钮，无需到「01 分类配置」重复创建。';
    else $('#itemCategoryHelp').textContent='这是提示词图库的数据分类。画廊和作品的筛选菜单另在「01 分类配置」管理；tags 不会变成菜单。';
    safeSelect('#itemZh',draft[keys.zhKey]||'');safeSelect('#itemEn',draft[keys.enKey]||'');
    safeSelect('#itemDescription',draft.description||'');safeSelect('#itemTags',Array.isArray(draft.tags)?draft.tags.join(', '):'');
    $('#itemAdult').checked=!!(draft.a||draft.adult===true||draft.r18===true||draft.nsfw===true);
    $('#itemRaw').value=JSON.stringify(draft,null,2);$('.raw-details').open=false;
    renderImageFields();
  }
  function saveItem(event) {
    event.preventDefault();if(!draft)return;
    const source=states.get(sourcePath),info=descriptor(sourcePath),keys=valuesFor(draft,info);
    const id=$('#itemId').value.trim();
    if(!id)return toast('素材 ID 不能为空');
    if(source.items.some((item,i)=>item.id===id && (draftNew||i!==selectedIndex)))return toast('此素材 ID 已存在，请换一个');
    draft.id=id;
    if(keys.titleKey)draft[keys.titleKey]=$('#itemTitle').value.trim();
    const collection=!!collectionKind(sourcePath);
    const category=collection?$('#itemCategorySelect').value.trim():$('#itemCategory').value.trim();
    if(collection&&!category)return toast('请先选择二级分类。如需新分类，请先到「01 分类配置」创建。');
    draft[keys.categoryKey]=category;
    draft[keys.zhKey]=$('#itemZh').value.trim();draft[keys.enKey]=$('#itemEn').value.trim();
    if('description'in draft||$('#itemDescription').value.trim())draft.description=$('#itemDescription').value.trim();
    if('tags'in draft||$('#itemTags').value.trim())draft.tags=$('#itemTags').value.split(/[,，]/).map(s=>s.trim()).filter(Boolean);
    if(collection){
      const references=$('#itemReferenceImages').value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
      const invalidReference=references.find(value=>!validUrl(value));
      if(invalidReference)return toast('参考图地址必须是完整的 HTTP(S) 直链：'+invalidReference);
      if(references.length)draft.reference_images=references;
      else delete draft.reference_images;
    }
    const adult=$('#itemAdult').checked;
    if(info.kind==='builtin')draft.a=adult;
    else {draft.adult=adult;delete draft.r18;delete draft.nsfw;delete draft.a;}
    const isVideo=info.kind==='video';
    if(isVideo){
      const videoUrl=$('#itemVideoUrl').value.trim();
      if(!validUrl(videoUrl))return toast('请填写有效的视频直链（HTTP 或 HTTPS，建议 MP4 / WebM）');
      draft.video_url=videoUrl;
    }
    const invalid=imageFields(draft).find(f=>f.value && !validUrl(f.value));
    if(invalid)return toast((isVideo?'视频封面':'图片')+'地址必须是完整的 HTTP(S) 直链：'+invalid.label);
    if(info.kind!=='builtin'&&!isVideo&&!draft.image&&!draft.thumbnail)return toast('请先填写展示图片地址');
    if(draftNew){source.items.push(clone(draft));selectedIndex=source.items.length-1;draftNew=false;}
    else source.items[selectedIndex]=clone(draft);
    if(info.kind==='custom'){
      const category=config.categories.find(c=>cleanPath(c.file)===sourcePath);
      if(category){category.count=source.items.length;markDirty(configPath);}
    }
    markDirty(sourcePath);formDirty=false;
    draft=clone(source.items[selectedIndex]);renderItems();renderCategories();renderEditor();
    if(collection)renderCollectionFilterList();
    toast((isVideo?'视频':'图片')+'已保存到本次编辑会话；可以直接复制完整 JSON 发布');
  }
  function applyRaw(){
    try{const value=JSON.parse($('#itemRaw').value);
      if(!value||typeof value!=='object'||Array.isArray(value))throw Error('应为单个 JSON 对象');
      draft=value;formDirty=true;renderEditor();toast('JSON 校验通过，已应用到编辑表单；请继续保存当前条目');
    }catch(error){toast('JSON 无法应用：'+error.message);}
  }
  function deleteItem(){
    const info=descriptor(sourcePath),source=states.get(sourcePath);
    if(info?.kind==='builtin'||selectedIndex<0)return;
    if(!confirm('从本图库删除「'+itemLabel(draft)+'」？仅在导出并提交 GitHub 后生效。'))return;
    source.items.splice(selectedIndex,1);selectedIndex=-1;draft=null;formDirty=false;
    markDirty(sourcePath);renderItems();renderEditor();
    if(info.kind==='custom'){
      const category=config.categories.find(c=>cleanPath(c.file)===sourcePath);
      if(category){category.count=source.items.length;markDirty(configPath);renderCategories();}
    }
    if(collectionKind(sourcePath))renderCollectionFilterList();
  }
  function transformImages(items,transform,apply=false){
    let changed=0;
    const visit=value=>{
      if(Array.isArray(value))return value.forEach(visit);
      if(!value||typeof value!=='object')return;
      for(const [key,v] of Object.entries(value)){
        if(key==='reference_images'&&Array.isArray(v)){
          v.forEach((url,index)=>{
            if(typeof url!=='string')return;
            const next=transform(url);
            if(next!==url){changed++;if(apply)value[key][index]=next;}
          });
        }else if(imageKeys.has(key)&&typeof v==='string'){
          const next=transform(v);
          if(next!==v){changed++;if(apply)value[key]=next;}
        }else if(v&&typeof v==='object')visit(v);
      }
    };
    visit(items);return changed;
  }
  async function sourceForMigration(){
    const path=$('#migrationSource').value;
    if(path===sourcePath&&formDirty){toast('请先保存当前条目，再进行批量图床替换');return null;}
    try{return {path,source:await loadSource(path)};}
    catch(error){toast(error.message);return null;}
  }
  async function previewPrefix(apply){
    const result=await sourceForMigration();if(!result)return;
    const old=$('#oldPrefix').value.trim(),next=$('#newPrefix').value.trim();
    if(!old||!validUrl(old)||!validUrl(next))return toast('请填写完整的旧 URL 前缀和新 HTTPS/HTTP 前缀');
    const count=transformImages(result.source.items,v=>v.startsWith(old)?next+v.slice(old.length):v,false);
    if(apply&&count){
      if(!confirm(`将替换 ${count} 个图片地址。请先确认对应的图片已经上传到新图床。继续吗？`))return;
      // 上方只是计算数量；确认后才实际修改数据。
      transformImages(result.source.items,v=>v.startsWith(old)?next+v.slice(old.length):v,true);
      markDirty(result.path);
    }
    reportMigration(result.source,`${apply?'已尝试替换':'预览'}：匹配 ${count} 个图片地址。`);
    if(result.path===sourcePath){selectedIndex=-1;draft=null;formDirty=false;renderItems();renderEditor();}
  }
  async function applyMapping(){
    const result=await sourceForMigration();if(!result)return;
    try{
      const map=JSON.parse($('#mappingText').value);
      if(!map||typeof map!=='object'||Array.isArray(map))throw Error('应为旧 URL 到新 URL 的 JSON 对象');
      for(const [old,next] of Object.entries(map))if(!validUrl(old)||!validUrl(next))throw Error('映射中的地址必须是完整的 HTTP(S) URL');
      const convert=v=>Object.hasOwn(map,v)?map[v]:v;
      const count=transformImages(result.source.items,convert,false);
      if(!count)return reportMigration(result.source,'没有找到与映射表完全一致的旧地址。');
      if(!confirm(`映射将替换 ${count} 个图片地址，确认对应图片已上传并继续吗？`))return;
      transformImages(result.source.items,convert,true);markDirty(result.path);
      reportMigration(result.source,`已替换 ${count} 个图片地址。`);
      if(result.path===sourcePath){selectedIndex=-1;draft=null;formDirty=false;renderItems();renderEditor();}
    }catch(error){toast('映射格式有误：'+error.message);}
  }
  function reportMigration(source,summary=''){
    const domains=new Map();
    transformImages(source.items,v=>{if(validUrl(v)){
      const host=new URL(v).hostname;domains.set(host,(domains.get(host)||0)+1);
    }return v;},false);
    const lines=[summary,`共 ${source.items.length} 条素材。`];
    for(const [host,count] of [...domains].sort((a,b)=>b[1]-a[1]))lines.push(`${host}：${count} 个图片地址`);
    setText('#migrationReport',lines.filter(Boolean).join('\n'));
  }
  async function copyText(text,success){
    try{
      if(!navigator.clipboard?.writeText)throw Error('剪贴板 API 不可用');
      await navigator.clipboard.writeText(text);
    }catch{
      // GitHub Pages 为 HTTPS，正常会使用上方 Clipboard API；不支持时尝试浏览器兼容方案。
      const field=document.createElement('textarea');field.value=text;field.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';
      document.body.append(field);field.focus();field.select();
      const copied=document.execCommand('copy');field.remove();
      if(!copied)throw Error('浏览器拒绝访问剪贴板，请在下方 JSON 预览框手动全选复制');
    }
    toast(success);
  }
  async function copyCurrentItem(){
    if(!draft)return toast('请先在左侧选择内容');
    if(formDirty||draftNew)return toast('请先点击「保存当前条目」，再复制 JSON');
    try{await copyText(JSON.stringify(draft,null,2)+'\n','已复制当前条目的 JSON 对象；追加到数组时记得用英文逗号分隔');}
    catch(error){toast(error.message);}
  }
  async function copyCurrentSource(){
    if(formDirty)return toast('请先保存当前条目，再复制完整图库 JSON');
    try{
      await loadSource(sourcePath);
      await copyText(fileText(sourcePath),'已复制 '+sourcePath+' 的完整 JSON，可以粘贴到 GitHub 同名文件');
    }catch(error){toast('复制失败：'+error.message);}
  }
  function refreshCopyFileOptions(preferred=''){
    const select=$('#copyFileSelect'),before=preferred||select.value;
    const paths=[configPath,'gallery/gallery.json','gallery/works.json',sourcePath,...dirtyPaths()];
    const unique=[...new Set(paths)];select.replaceChildren();
    for(const path of unique){
      const option=document.createElement('option');option.value=path;
      const title=path===configPath?'分类配置':descriptor(path)?.name||path.split('/').pop();
      option.textContent=(dirtyPaths().includes(path)?'● 待发布 · ':'')+title+' — '+path;
      select.append(option);
    }
    select.value=unique.includes(before)?before:sourcePath;
  }
  async function renderJsonPreview(){
    const path=$('#copyFileSelect').value;
    if(!path)return;
    const preview=$('#jsonPreview');preview.value='正在读取 '+path+' …';
    try{
      if(path!==configPath)await loadSource(path);
      if($('#copyFileSelect').value!==path)return;
      const content=fileText(path),limit=14000;
      preview.value=content.length>limit?content.slice(0,limit):content;
      $('#jsonPreviewNote').textContent=content.length>limit
        ?`预览只展示前 ${limit.toLocaleString()} 个字符（完整文件共 ${content.length.toLocaleString()} 个字符）。复制按钮始终复制全部内容。`
        :`完整预览 · ${content.length.toLocaleString()} 个字符`;
      const isNew=states.get(path)?.isNew;
      $('#copyFileNote').textContent=isNew
        ?`这是新建文件：${path}。请先在 GitHub 的对应目录创建同名文件，再粘贴完整 JSON。`
        :`目标文件：${path}。请在 GitHub 同名文件中全选旧内容、粘贴完整 JSON 并提交。`;
      const link=$('#githubEditFile');
      link.href=isNew?'https://github.com/Gage0149/AIHUIHUA/tree/main/gallery':'https://github.com/Gage0149/AIHUIHUA/edit/main/'+path;
      link.textContent=isNew?'在 GitHub 创建新文件 ↗':'在 GitHub 编辑此文件 ↗';
    }catch(error){
      if($('#copyFileSelect').value!==path)return;
      preview.value='';$('#jsonPreviewNote').textContent='读取失败：'+error.message;
    }
  }
  async function copySelectedFile(){
    if(formDirty)return toast('当前图片的编辑尚未保存，请先点「保存当前条目」');
    const path=$('#copyFileSelect').value;
    try{
      validateExport();
      if(path!==configPath)await loadSource(path);
      await copyText(fileText(path),'已复制 '+path+' 的全部 JSON，请在 GitHub 同名文件里粘贴并提交');
    }catch(error){toast('复制失败：'+error.message);}
  }
  async function exportCurrent(){
    if(formDirty)return toast('请先保存当前条目，再导出数据');
    try{
      const current=$('#copyFileSelect').value;if(current!==configPath)await loadSource(current);
      download(new Blob([fileText(current)],{type:'application/json;charset=utf-8'}),current.split('/').pop());
    }catch(error){toast(error.message);}
  }
  function validateExport() {
    const ids=new Set(),groupIds=new Set();
    for(const view of ['gallery','works']){
      const names=new Set();
      for(const row of filterRows(view)){
        const name=typeof row.name==='string'?row.name.trim():'';
        if(!name||names.has(name)||typeof row.adult!=='boolean')throw Error(view+' 的二级分类可见性规则无效或重复');
        names.add(name);
      }
    }
    for(const group of config.groups){if(!validId(group.id)||!String(group.name).trim()||groupIds.has(group.id))throw Error('一级菜单 ID 重复或无效');groupIds.add(group.id);}
    for(const c of config.categories){
      if(!validId(c.id)||ids.has(c.id)||!String(c.name).trim()||!validPath(c.file))throw Error('二级图库配置有重复 ID 或无效文件路径');
      if(c.group&&!groupIds.has(c.group))throw Error(c.name+' 指向了不存在的一级菜单');
      ids.add(c.id);
    }
    for(const [path,source] of states){
      if(!source.dirty)continue;
      const seen=new Set();
      for(const item of source.items){
        if(!item||typeof item!=='object'||!String(item.id||'').trim()||seen.has(String(item.id)))throw Error(path+' 存在空 ID 或重复素材 ID');
        seen.add(String(item.id));
      }
    }
  }
  async function exportAll(){
    if(formDirty)return toast('请先保存当前条目，再导出修改');
    const paths=dirtyPaths();if(!paths.length)return toast('目前没有修改');
    try{
      validateExport();
      if(typeof window.makeZip!=='function')throw Error('ZIP 下载组件未加载');
      const files=paths.map(path=>({name:path,blob:new Blob([fileText(path)],{type:'application/json;charset=utf-8'})}));
      const notes='AIHUIHUA 内容更新说明\n\n请将 ZIP 中各 JSON 文件放到 GitHub 仓库内的同名路径，提交 main 分支。\n只上传 ZIP 文件本身不会更新网站，请先解压。\n本管理页面不会自动写入 GitHub。\n\n本次文件：\n'+paths.join('\n')+'\n';
      files.push({name:'更新说明.txt',blob:new Blob([notes],{type:'text/plain;charset=utf-8'})});
      download(await window.makeZip(files),'AIHUIHUA-content-'+new Date().toISOString().slice(0,10)+'.zip');
      toast('已打包修改文件；请解压后按相对路径上传到 GitHub');
    }catch(error){toast(error.message);}
  }
  function download(blob,name){const link=document.createElement('a');const url=URL.createObjectURL(blob);link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  function activatePanel(key){
    for(const tab of $$('.manage-tabs button')){
      const active=tab.dataset.panel===key;
      tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));
    }
    for(const panel of $$('.workspace'))panel.hidden=panel.id!=='panel-'+key;
    if(key==='export'){
      updateDirty();refreshCopyFileOptions(dirtyPaths()[0]||sourcePath);renderJsonPreview();
    }
    if(key==='migration')sourceForMigration().then(result=>result&&reportMigration(result.source));
  }
  async function quickNew(path){
    if(!await changeSource(path))return;
    activatePanel('content');newItem();
    $('#itemTitle').focus();
  }
  function bind(){
    $$('.manage-tabs button').forEach(button=>button.onclick=()=>activatePanel(button.dataset.panel));
    $('#quickGallery').onclick=()=>quickNew('gallery/gallery.json');
    $('#quickWorks').onclick=()=>quickNew('gallery/works.json');
    $('#quickVideo').onclick=()=>quickNew('gallery/video-assets.json');
    $('#quickCategories').onclick=()=>{
      $('#collectionFilterView').value=collectionKind(sourcePath)||'gallery';selectCollectionFilter('');activatePanel('categories');
      $('.collection-visibility-section').scrollIntoView({behavior:'smooth',block:'start'});
    };
    $('#quickPublish').onclick=()=>activatePanel('export');
    $('#newGroup').onclick=()=>selectGroup(-1);$('#groupForm').onsubmit=saveGroup;
    $('#newCategory').onclick=()=>selectCategory(-1);$('#categoryForm').onsubmit=saveCategory;
    $('#collectionFilterView').onchange=()=>selectCollectionFilter('');
    $('#newCollectionFilter').onclick=()=>selectCollectionFilter('');
    $('#collectionFilterForm').onsubmit=saveCollectionFilter;
    $('#resetCollectionFilter').onclick=resetCollectionFilter;
    $('#removeCollectionFilter').onclick=removeCollectionFilter;
    $('#sourceSelect').onchange=event=>changeSource(event.target.value);
    $('#itemSearch').oninput=renderItems;
    $('#newItem').onclick=()=>newItem(false);$('#duplicateItem').onclick=()=>newItem(true);
    $('#itemForm').onsubmit=saveItem;$('#deleteItem').onclick=deleteItem;$('#applyRaw').onclick=applyRaw;
    $('#itemVideoUrl').addEventListener('input',()=>{if(draft){draft.video_url=$('#itemVideoUrl').value.trim();formDirty=true;updateImagePreview();}});
    $('#copyCurrentItem').onclick=copyCurrentItem;$('#copyCurrentSource').onclick=copyCurrentSource;
    for(const input of ['#itemId','#itemTitle','#itemCategory','#itemZh','#itemEn','#itemReferenceImages','#itemDescription','#itemTags','#itemAdult'])
      $(input).addEventListener('input',()=>{formDirty=true;});
    $('#itemCategorySelect').onchange=()=>{formDirty=true;refreshItemCategoryChoices($('#itemCategorySelect').value);};
    $('#goCategoryConfig').onclick=()=>{
      const view=collectionKind(sourcePath)||'gallery';
      $('#collectionFilterView').value=view;selectCollectionFilter('');activatePanel('categories');
      $('.collection-visibility-section').scrollIntoView({behavior:'smooth',block:'start'});
    };
    $('#migrationSource').onchange=async()=>{const result=await sourceForMigration();if(result)reportMigration(result.source);};
    $('#previewPrefix').onclick=()=>previewPrefix(false);$('#applyPrefix').onclick=()=>previewPrefix(true);
    $('#applyMapping').onclick=applyMapping;$('#exportAll').onclick=exportAll;$('#exportCurrent').onclick=exportCurrent;
    $('#copyFileSelect').onchange=renderJsonPreview;$('#copySelectedFile').onclick=copySelectedFile;
    window.addEventListener('beforeunload',event=>{if(dirtyPaths().length||formDirty){event.preventDefault();event.returnValue='';}});
  }
  async function initialize(){
    bind();
    try{
      const response=await fetch('./'+configPath,{cache:'no-cache'});if(!response.ok)throw Error('HTTP '+response.status);
      const result=await response.json();if(!Array.isArray(result.categories))throw Error('缺少 categories 数组');
      config={...result,groups:Array.isArray(result.groups)?result.groups:[],categories:result.categories,
        collectionFilters:{...(result.collectionFilters||{}),gallery:Array.isArray(result.collectionFilters?.gallery)?result.collectionFilters.gallery:[],works:Array.isArray(result.collectionFilters?.works)?result.collectionFilters.works:[]}};
      refreshGroupChoices();renderGroups();renderCategories();selectGroup(-1);selectCategory(-1);
      refreshSourceOptions();await changeSource(sourcePath);await renderCollectionFilterList();updateDirty();
      refreshCopyFileOptions(sourcePath);
    }catch(error){toast('读取分类配置失败：'+error.message);setText('#sourceStatus',error.message);}
  }
  document.addEventListener('DOMContentLoaded',initialize);
})();
