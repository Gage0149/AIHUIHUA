'use strict';
/* 自定义主页、提示词、画廊、作品四大页面；相对路径适配 GitHub Pages。 */
(() => {
  const $ = selector => document.querySelector(selector);
  const base = new URL('.', document.currentScript?.src || location.href);
  const siteFile = path => new URL(String(path).replace(/^\/+/, ''), base).href;
  const datasets = {
    gallery: {path:'gallery/gallery.json', items:null, pending:null, error:null, filter:'全部', visible:[]},
    works: {path:'gallery/works.json', items:null, pending:null, error:null, filter:'全部', visible:[]}
  };
  const safeURL = value => {
    try {
      const result = new URL(String(value || ''), base);
      return /^https?:$/.test(result.protocol) ? result.href : '';
    } catch { return ''; }
  };
  const viewForHash = () => {
    const section = location.hash.slice(1).split('/')[0];
    if (!section || section === 'home') return 'home';
    if (section === 'gallery' || section === 'custom-gallery') return 'gallery';
    if (section === 'works') return 'works';
    return 'prompts';
  };
  function sync() {
    const view = viewForHash();
    document.body.dataset.view = view;
    document.querySelectorAll('[data-view-link]').forEach(link => {
      const active = link.dataset.viewLink === view;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    if (view === 'home') document.title = '绘影 · AI 摄影与视觉叙事';
    if (view === 'gallery') { document.title = '画廊 · 绘影'; load('gallery'); }
    if (view === 'works') { document.title = '作品 · 绘影'; load('works'); }
  }
  async function load(view) {
    const state = datasets[view];
    if (state.items !== null) { render(view); return; }
    if (!state.pending) {
      state.pending = fetch(siteFile(state.path), {cache:'no-cache'})
        .then(response => {
          if (!response.ok) throw Error('HTTP ' + response.status);
          return response.json();
        })
        .then(data => {
          state.items = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
          state.error = null;
        })
        .catch(error => {
          state.items = [];
          state.error = '读取失败：' + error.message;
          console.warn(state.path, error);
        });
    }
    await state.pending;
    if (document.body.dataset.view === view) render(view);
  }
  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = String(content);
    return node;
  }
  function render(view) {
    const state = datasets[view];
    const grid = $('#' + view + 'Masonry');
    const filters = $('#' + view + 'Filters');
    const empty = $('#' + view + 'Empty');
    const items = state.items || [];
    const categories = [...new Set(items.map(item => item.subcategory || item.category || '其他'))];
    if (state.filter !== '全部' && !categories.includes(state.filter)) state.filter = '全部';
    filters.replaceChildren();
    if (categories.length > 1) {
      ['全部', ...categories].forEach(category => {
        const chip = element('button', category === state.filter ? 'active' : '', category);
        chip.type = 'button';
        chip.setAttribute('aria-pressed', String(category === state.filter));
        chip.onclick = () => { state.filter = category; render(view); };
        filters.append(chip);
      });
    }
    const query = ($('#q')?.value || '').trim().toLowerCase();
    state.visible = items.filter(item => {
      const category = item.subcategory || item.category || '其他';
      const tags = Array.isArray(item.tags) ? item.tags : [];
      const terms = [item.title, category, item.description, item.prompt_zh, item.prompt_en, ...tags].join(' ').toLowerCase();
      return (state.filter === '全部' || state.filter === category) && (!query || terms.includes(query));
    });
    $('#' + view + 'Count').textContent = state.visible.length + ' 张图片';
    grid.replaceChildren();
    state.visible.forEach((item, index) => {
      const title = item.title || '未命名作品';
      const button = element('button', 'masonry-card');
      button.type = 'button';
      button.setAttribute('aria-label', '查看 ' + title + ' 详情');
      button.onclick = () => openCard(item);
      const visual = element('span', 'masonry-visual');
      const url = safeURL(item.image || item.thumbnail);
      const error = element('span', 'masonry-image-error', '图片暂时无法加载，点击查看提示词或原图地址');
      error.hidden = !!url;
      if (url) {
        const image = element('img');
        image.src = url;
        image.alt = title;
        image.loading = 'lazy';
        image.decoding = 'async';
        image.referrerPolicy = 'no-referrer';
        image.onerror = () => {image.hidden = true; error.hidden = false; visual.classList.add('image-failed');};
        visual.append(image);
      }
      visual.append(error);
      if (item.demo) visual.append(element('span', 'masonry-demo', '示例 · 可替换'));
      const caption = element('span', 'masonry-caption');
      caption.append(element('span', 'masonry-cat', item.subcategory || item.category || '其他'));
      caption.append(element('strong', '', title));
      const excerpt = item.prompt_zh || item.prompt_en || item.description;
      if (excerpt) caption.append(element('span', 'masonry-description', excerpt));
      button.append(visual, caption);
      grid.append(button);
    });
    empty.hidden = state.visible.length > 0;
    if (!state.visible.length) {
      empty.replaceChildren();
      if (state.error) {
        empty.append(element('strong', '', '内容读取失败'));
        empty.append(element('p', '', state.error + '；请检查 ' + state.path));
      } else if (items.length && query) {
        empty.append(element('strong', '', '没有找到匹配的内容'));
        empty.append(element('p', '', '试试其他搜索词，或清空顶部搜索框。'));
      } else if (items.length) {
        empty.append(element('strong', '', '这个分类暂时没有内容'));
        empty.append(element('p', '', '切换到“全部”继续浏览。'));
      } else if (view === 'works') {
        empty.append(element('strong', '', '作品集，等待第一幅创作。'));
        empty.append(element('p', '', '编辑 GitHub 仓库里的 gallery/works.json，添加图片外链和作品介绍，这里便会显示瀑布流作品。'));
      } else {
        empty.append(element('strong', '', '画廊还没有图片'));
        empty.append(element('p', '', '编辑 gallery/gallery.json 即可添加图片和提示词。'));
      }
    }
  }
  function openCard(item) {
    const dialog = $('#collectionDialog');
    const url = safeURL(item.image || item.thumbnail);
    const image = $('#collectionDialogImage');
    image.hidden = !url;
    image.src = url;
    image.alt = item.title || '图片';
    $('#collectionDialogImageFallback').hidden = !!url;
    $('#collectionDialogCategory').textContent = item.subcategory || item.category || '视觉灵感';
    $('#collectionDialogTitle').textContent = item.title || '未命名作品';
    $('#collectionDialogDescription').textContent = item.description || '';
    $('#collectionDialogPrompt').textContent = item.prompt_zh || '';
    $('#collectionDialogPromptEn').textContent = item.prompt_en || '';
    $('#collectionDialogPromptWrap').hidden = !item.prompt_zh;
    $('#collectionDialogEnWrap').hidden = !item.prompt_en;
    $('#collectionDialogTags').replaceChildren();
    (Array.isArray(item.tags) ? item.tags : []).forEach(tag =>
      $('#collectionDialogTags').append(element('span', '', tag))
    );
    const link = $('#collectionDialogSource');
    link.href = url || '#';
    link.hidden = !url;
    $('#collectionDialogFeedback').textContent = '';
    $('#collectionDialogCopy').onclick = async () => {
      const prompt = item.prompt_zh || item.prompt_en;
      if (!prompt) { $('#collectionDialogFeedback').textContent = '这张图片尚未填写提示词'; return; }
      try {
        await navigator.clipboard.writeText(prompt);
        $('#collectionDialogFeedback').textContent = '提示词已复制';
      } catch {
        $('#collectionDialogFeedback').textContent = '复制失败，请手动选择提示词复制';
      }
    };
    if (!dialog.open) dialog.showModal();
  }
  $('#collectionDialogImage').onerror = () => {
    $('#collectionDialogImage').hidden = true;
    $('#collectionDialogImageFallback').hidden = false;
  };
  $('#collectionDialogClose').onclick = () => $('#collectionDialog').close();
  $('#collectionDialog').onclick = event => {
    if (event.target === $('#collectionDialog')) event.target.close();
  };
  const search = $('#q');
  search.addEventListener('input', () => {
    const view = viewForHash();
    if (datasets[view]) render(view);
    if (view === 'home' && search.value.trim()) {
      const term = search.value;
      location.hash = '#pose';
      setTimeout(() => {
        search.value = term;
        search.dispatchEvent(new Event('input', {bubbles:true}));
      }, 50);
    }
  });
  $('#qx').addEventListener('click', () => {
    const view = viewForHash();
    if (datasets[view]) setTimeout(() => render(view), 0);
  });
  $('#qDone').onclick = () => search.blur();
  window.addEventListener('hashchange', sync);
  window.addEventListener('popstate', sync);
  window.SITE_SHELL = {sync};
  sync();
})();