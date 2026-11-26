'use strict';
/* 自定义主页、提示词、画廊、作品、视频五大页面；相对路径适配 GitHub Pages。 */
(() => {
  const $ = selector => document.querySelector(selector);
  const base = new URL('.', document.currentScript?.src || location.href);
  const siteFile = path => new URL(String(path).replace(/^\/+/, ''), base).href;
  const datasets = {
    gallery: {path:'gallery/gallery.json', items:null, pending:null, error:null, filter:'全部', visible:[]},
    works: {path:'gallery/works.json', items:null, pending:null, error:null, filter:'全部', visible:[]},
    video: {path:'gallery/video-assets.json', items:null, pending:null, error:null, filter:'全部', visible:[]}
  };
  // 菜单分类只来自 categories.json 的 collectionFilters；图片的 subcategory 和 tags 均不会自动新增菜单。
  // 分类 R18 与图片 R18 完全独立，图片未配置成人标记时默认公开。
  const collectionFilters = {gallery:[],works:[]};
  let collectionFiltersPending;
  function loadCollectionFilters() {
    if (!collectionFiltersPending) collectionFiltersPending = fetch(siteFile('gallery/categories.json'), {cache:'no-cache'})
      .then(response => {if (!response.ok) throw Error('HTTP '+response.status);return response.json();})
      .then(config => {
        for (const view of ['gallery','works']) {
          const rows = config.collectionFilters?.[view];
          collectionFilters[view] = Array.isArray(rows) ? rows.filter(row => row && typeof row.name === 'string' && row.name.trim()) : [];
        }
      }).catch(error => console.warn('画廊/作品分类显示配置读取失败，使用默认公开规则', error));
    return collectionFiltersPending;
  }
  // 画廊、作品共用顶部 R18 状态；未标记的素材默认公开。
  const isAdultItem = item => !!item && (item.adult === true || item.r18 === true || item.nsfw === true);
  const itemCategory = item => String(item?.subcategory || item?.category || '未分类').trim() || '未分类';
  let selectedItem = null;
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
    if (section === 'video') return 'video';
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
    if (view === 'video') { document.title = '视频 · 绘影'; load('video'); }
  }
  async function load(view) {
    const state = datasets[view];
    const filtersReady = loadCollectionFilters();
    if (state.items !== null) { await filtersReady; render(view); return; }
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
    await Promise.all([state.pending, filtersReady]);
    if (document.body.dataset.view === view) render(view);
  }
  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = String(content);
    return node;
  }
  function renderVideoCollection() {
    const state = datasets.video;
    const grid = $('#videoMasonry');
    const filters = $('#videoFilters');
    const empty = $('#videoEmpty');
    if (!state || !grid || !filters || !empty) return;

    const items = state.items || [];
    const adultAllowed = document.body.classList.contains('adult');
    const available = adultAllowed ? items : items.filter(item => !isAdultItem(item));
    const adultHidden = items.length - available.length;
    const categories = [...new Set(available.map(itemCategory).filter(name => name && name !== '未分类'))];
    if (state.filter !== '全部' && !categories.includes(state.filter)) state.filter = '全部';

    filters.replaceChildren();
    if (categories.length) {
      ['全部', ...categories].forEach(category => {
        const chip = element('button', category === state.filter ? 'active' : '', category);
        chip.type = 'button';
        chip.setAttribute('aria-pressed', String(category === state.filter));
        chip.onclick = () => { state.filter = category; renderVideoCollection(); };
        filters.append(chip);
      });
    }

    const query = ($('#q')?.value || '').trim().toLowerCase();
    state.visible = available.filter(item => {
      const tags = Array.isArray(item.tags) ? item.tags : [];
      const terms = [item.title, itemCategory(item), item.description, item.prompt_zh, item.prompt_en, ...tags].join(' ').toLowerCase();
      return (state.filter === '全部' || itemCategory(item) === state.filter) && (!query || terms.includes(query));
    });

    $('#videoCount').textContent = state.visible.length + ' 个视频' + (adultHidden ? ' · ' + adultHidden + ' 个 R18 已隐藏' : '');
    grid.replaceChildren();

    state.visible.forEach(item => {
      const title = item.title || '未命名视频';
      const card = element('article', 'masonry-card video-card');
      const visual = element('div', 'masonry-visual video-visual');
      const rawVideo = item.video_url || item.video || item.src || '';
      const videoUrl = rawVideo ? safeURL(rawVideo) : '';
      const rawPoster = item.thumbnail || item.cover || item.image || '';
      const posterUrl = rawPoster ? safeURL(rawPoster) : '';

      if (videoUrl) {
        const player = document.createElement('video');
        player.controls = true;
        player.preload = 'metadata';
        player.playsInline = true;
        player.src = videoUrl;
        player.setAttribute('aria-label', title);
        if (posterUrl) player.poster = posterUrl;
        const fallback = element('span', 'masonry-image-error', '视频无法播放，请检查视频直链是否可访问');
        fallback.hidden = true;
        player.onerror = () => { player.hidden = true; fallback.hidden = false; };
        visual.append(player, fallback);
      } else if (posterUrl) {
        const image = element('img');
        image.src = posterUrl;
        image.alt = title;
        image.loading = 'lazy';
        image.decoding = 'async';
        image.referrerPolicy = 'no-referrer';
        visual.append(image, element('span', 'video-missing-source', '尚未填写视频地址'));
      } else {
        visual.append(element('span', 'masonry-image-error', '请为这条视频填写 video_url 和封面地址'));
      }

      if (item.demo) visual.append(element('span', 'masonry-demo', '示例 · 可替换'));
      const caption = element('span', 'masonry-caption');
      caption.append(element('span', 'masonry-cat', itemCategory(item)));
      caption.append(element('strong', '', title));
      if (item.description) caption.append(element('span', 'masonry-description', item.description));
      card.append(visual, caption);

      const prompt = item.prompt_zh || item.prompt_en;
      if (prompt) {
        const details = element('details', 'video-prompt');
        details.append(element('summary', '', '查看视频提示词'));
        details.append(element('p', '', prompt));
        card.append(details);
      }
      grid.append(card);
    });

    empty.hidden = state.visible.length > 0;
    if (!state.visible.length) {
      empty.replaceChildren();
      if (state.error) {
        empty.append(element('strong', '', '视频内容读取失败'));
        empty.append(element('p', '', state.error + '；请检查 gallery/video-assets.json'));
      } else if (items.length && adultHidden === items.length && !adultAllowed) {
        empty.append(element('strong', '', '当前视频均被 R18 开关隐藏'));
        empty.append(element('p', '', '如已年满 18 岁，可使用页面顶部 R18 开关查看。'));
      } else if (items.length && query) {
        empty.append(element('strong', '', '没有找到匹配的视频'));
        empty.append(element('p', '', '试试其他搜索词，或清空顶部搜索框。'));
      } else if (items.length) {
        empty.append(element('strong', '', '这个分类暂时没有视频'));
        empty.append(element('p', '', '切换到“全部”继续浏览。'));
      } else {
        empty.append(element('strong', '', '视频栏目已经准备好了'));
        empty.append(element('p', '', '添加视频数据后，就会在这里展示。数据文件：gallery/video-assets.json。每条内容可填写 title、video_url（MP4/WebM 直链）、thumbnail、description、prompt_zh 和 tags。'));
      }
    }
  }
  function render(view) {
    if (view === 'video') { renderVideoCollection(); return; }
    const state = datasets[view];
    const grid = $('#' + view + 'Masonry');
    const filters = $('#' + view + 'Filters');
    const empty = $('#' + view + 'Empty');
    const items = state.items || [];
    const adultAllowed = document.body.classList.contains('adult');
    const available = adultAllowed ? items : items.filter(item => !isAdultItem(item));
    const adultHidden = items.length - available.length;
    const categoryRules = new Map();
    for (const rule of collectionFilters[view]) {
      const name = rule.name.trim();
      if (!categoryRules.has(name)) categoryRules.set(name, rule.adult === true);
    }
    // 即使当前分类下没有可见图片，分类按钮仍受自己的配置控制；图片和标签无法修改按钮集合。
    const categories = [...categoryRules].filter(([,adult]) => adultAllowed || !adult).map(([name]) => name);
    if (state.filter !== '全部' && !categories.includes(state.filter)) state.filter = '全部';
    filters.replaceChildren();
    if (categories.length) {
      ['全部', ...categories].forEach(category => {
        const chip = element('button', category === state.filter ? 'active' : '', category);
        chip.type = 'button';
        chip.setAttribute('aria-pressed', String(category === state.filter));
        chip.onclick = () => { state.filter = category; render(view); };
        filters.append(chip);
      });
    }
    const query = ($('#q')?.value || '').trim().toLowerCase();
    state.visible = available.filter(item => {
      const category = itemCategory(item);
      const tags = Array.isArray(item.tags) ? item.tags : [];
      const terms = [item.title, category, item.description, item.prompt_zh, item.prompt_en, ...tags].join(' ').toLowerCase();
      return (state.filter === '全部' || state.filter === category) && (!query || terms.includes(query));
    });
    $('#' + view + 'Count').textContent = state.visible.length + ' 张图片' + (adultHidden ? ' · ' + adultHidden + ' 张 R18 已隐藏' : '');
    grid.replaceChildren();
    const width = grid.getBoundingClientRect().width;
    const columnCount = width >= 1020 ? 6 : width >= 830 ? 5 : width >= 620 ? 4 : width >= 420 ? 3 : 2;
    state.columnCount = columnCount;
    grid.style.setProperty('--masonry-columns', String(columnCount));
    const columns = Array.from({length: columnCount}, () => element('div', 'masonry-column'));
    grid.append(...columns);
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
      caption.append(element('span', 'masonry-cat', itemCategory(item)));
      caption.append(element('strong', '', title));
      const excerpt = item.prompt_zh || item.prompt_en || item.description;
      if (excerpt) caption.append(element('span', 'masonry-description', excerpt));
      button.append(visual, caption);
      columns[index % columnCount].append(button);
    });
    empty.hidden = state.visible.length > 0;
    if (!state.visible.length) {
      empty.replaceChildren();
      if (state.error) {
        empty.append(element('strong', '', '内容读取失败'));
        empty.append(element('p', '', state.error + '；请检查 ' + state.path));
      } else if (items.length && adultHidden === items.length && !adultAllowed) {
        empty.append(element('strong', '', '当前图片已被 R18 开关隐藏'));
        empty.append(element('p', '', '如已年满 18 岁，可使用页面顶部 R18 开关查看这部分素材。'));
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
  const promptPanels = [
    {wrap:$('#collectionDialogPromptWrap'), box:$('#collectionDialogPromptBox'), text:$('#collectionDialogPrompt'), toggle:$('#collectionDialogPromptToggle')},
    {wrap:$('#collectionDialogEnWrap'), box:$('#collectionDialogEnBox'), text:$('#collectionDialogPromptEn'), toggle:$('#collectionDialogEnToggle')}
  ];
  function resetPromptPanel(panel, content) {
    panel.wrap.hidden = !content;
    panel.text.textContent = content || '';
    panel.box.classList.remove('expanded', 'is-overflowing');
    panel.box.scrollTop = 0;
    panel.toggle.hidden = true;
    panel.toggle.textContent = '展开全文';
    panel.toggle.setAttribute('aria-expanded', 'false');
  }
  function updatePromptOverflow() {
    for (const panel of promptPanels) {
      if (panel.wrap.hidden || panel.box.classList.contains('expanded')) continue;
      const overflowing = panel.box.scrollHeight > panel.box.clientHeight + 2;
      panel.toggle.hidden = !overflowing;
      panel.box.classList.toggle('is-overflowing', overflowing);
    }
  }
  for (const panel of promptPanels) {
    panel.toggle.onclick = () => {
      const expanded = panel.box.classList.toggle('expanded');
      panel.box.classList.toggle('is-overflowing', !expanded);
      if (!expanded) panel.box.scrollTop = 0;
      panel.toggle.textContent = expanded ? '收起内容' : '展开全文';
      panel.toggle.setAttribute('aria-expanded', String(expanded));
    };
  }
  window.addEventListener('resize', () => {
    if ($('#collectionDialog').open) requestAnimationFrame(updatePromptOverflow);
  });
  function renderReferenceImages(value) {
    const wrap = $('#collectionDialogReferencesWrap');
    const grid = $('#collectionDialogReferences');
    grid.replaceChildren();
    const entries = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    const urls = entries.map(entry => typeof entry === 'string' ? entry : entry?.url || '').map(safeURL).filter(Boolean);
    wrap.hidden = !urls.length;
    $('#collectionDialogReferenceCount').textContent = urls.length ? `${urls.length} 张` : '';
    urls.forEach((url, index) => {
      const link = element('a', 'collection-reference-card');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', `在新标签页查看参考图 ${index + 1}`);
      const image = document.createElement('img');
      image.src = url;
      image.alt = `参考图 ${index + 1}`;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.referrerPolicy = 'no-referrer';
      const fallback = element('span', 'collection-reference-fallback', '图片无法加载');
      fallback.hidden = true;
      image.onerror = () => { image.hidden = true; fallback.hidden = false; };
      link.append(image, fallback, element('span', 'collection-reference-caption', `参考图 ${String(index + 1).padStart(2, '0')}`));
      grid.append(link);
    });
  }
  function openCard(item) {
    if (isAdultItem(item) && !document.body.classList.contains('adult')) return;
    selectedItem = item;
    const dialog = $('#collectionDialog');
    const url = safeURL(item.image || item.thumbnail);
    const image = $('#collectionDialogImage');
    image.hidden = !url;
    image.src = url;
    image.alt = item.title || '图片';
    $('#collectionDialogImageFallback').hidden = !!url;
    $('#collectionDialogCategory').textContent = itemCategory(item);
    $('#collectionDialogTitle').textContent = item.title || '未命名作品';
    $('#collectionDialogDescription').textContent = item.description || '';
    resetPromptPanel(promptPanels[0], item.prompt_zh);
    resetPromptPanel(promptPanels[1], item.prompt_en);
    renderReferenceImages(item.reference_images);
    $('#collectionDialogTags').replaceChildren();
    const tags = Array.isArray(item.tags) ? item.tags : [];
    $('#collectionDialogTagsWrap').hidden = !tags.length;
    tags.forEach(tag =>
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
    $('.collection-dialog-copy').scrollTop = 0;
    requestAnimationFrame(updatePromptOverflow);
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
  window.addEventListener('resize', () => {
    const view = viewForHash();
    const state = datasets[view];
    if (!state || state.items === null) return;
    const width = $('#' + view + 'Masonry').getBoundingClientRect().width;
    const columns = width >= 1020 ? 6 : width >= 830 ? 5 : width >= 620 ? 4 : width >= 420 ? 3 : 2;
    if (columns !== state.columnCount) render(view);
  });
  function refreshAdult() {
    if (selectedItem && isAdultItem(selectedItem) && !document.body.classList.contains('adult') && $('#collectionDialog').open) {
      $('#collectionDialog').close();
    }
    const view = viewForHash();
    if (datasets[view]?.items !== null && datasets[view]?.items !== undefined) render(view);
  }
  // 主导航改为即时更新历史记录和视图，避免旧提示词页异步路由抢走首次点击。
  document.querySelectorAll('[data-view-link]').forEach(link => {
    if (link.dataset.viewLink === 'prompts') return;
    link.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = link.getAttribute('href');
      if (!target || !target.startsWith('#')) return;
      event.preventDefault();
      if (location.hash !== target) history.pushState(null, '', target);
      sync();
    });
  });
  window.addEventListener('hashchange', sync);
  window.addEventListener('popstate', sync);
  window.SITE_SHELL = {sync, refreshAdult};
  sync();
})();
