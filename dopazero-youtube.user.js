// ==UserScript==
// @name         DopaZero - YouTube 집중 모드
// @namespace    dopazero.local
// @version      1.0.7
// @description  홈 추천 피드, 영상 썸네일, 시청 페이지 추천 영상과 Shorts 진입점을 숨깁니다.
// @match        https://m.youtube.com/*
// @match        https://www.youtube.com/*
// @match        https://youtube.com/*
// @run-at       document-start
// @inject-into  content
// @grant        none
// @noframes
// ==/UserScript==

(() => {
  'use strict';
  if (window.top !== window.self) return;

  const STYLE_ID = 'dopazero-youtube-style';
  const PANEL_ID = 'dopazero-home';
  const PAGE_ATTR = 'data-dopazero-page';
  const SHORTS_ATTR = 'data-dopazero-shorts';
  const HOME_ATTR = 'data-dopazero-home-root';
  const HOME_BRANCH_ATTR = 'data-dopazero-home-branch';
  // Marks every element this script inserts into YouTube's own markup.
  const ADDED_ATTR = 'data-dopazero-added';
  if (document.getElementById(STYLE_ID)) return;

  // Keep these scoped to video cards: avatars, comments and the player stay intact.
  const VIDEO_CARDS = [
    'ytm-video-with-context-renderer', 'ytm-compact-video-renderer',
    'ytm-compact-playlist-renderer', 'ytm-compact-radio-renderer',
    'ytm-playlist-renderer', 'ytd-playlist-renderer', 'ytd-radio-renderer',
    'ytm-video-renderer', 'ytm-grid-video-renderer', 'ytm-playlist-video-renderer',
    'ytm-playlist-panel-video-renderer', 'ytm-rich-grid-media',
    'ytm-media-item', 'ytm-lockup-view-model',
    // "내 페이지" history and playlist carousels. Their images load lazily, so
    // the image-path fallback alone leaves a blank box until each one loads.
    'ytm-video-card-renderer', 'ytm-playlist-card-renderer',
    'ytd-video-renderer', 'ytd-grid-video-renderer', 'ytd-rich-grid-media',
    'ytd-compact-video-renderer', 'ytd-playlist-video-renderer',
    'ytd-playlist-panel-video-renderer', 'yt-lockup-view-model',
  ];
  const THUMBNAIL_BOXES = [
    '.video-thumbnail-container-large', '.video-thumbnail-container-compact',
    '.video-thumbnail-container-compact-rounded', '.media-item-thumbnail-container',
    '.thumbnail-cover', '.thumbnail-cover-rounded', 'ytm-thumbnail-cover',
    'ytm-thumbnail-view-model', 'yt-thumbnail-view-model', 'ytd-thumbnail',
    '.ytThumbnailViewModelHost',
    '.ytContentPreviewImageViewModelHost:not(.ytContentPreviewImageViewModelCircleImage)',
  ];
  // Every channel serves video thumbnails from these image paths. Avatars and
  // banners use yt3.* images, so matching the path is safe on any layout.
  const VIDEO_IMAGES = [
    'img[src*="/vi/"]', 'img[src*="/vi_webp/"]',
    'img[src*="/an_webp/"]', 'img[data-thumb*="/vi/"]',
  ];
  const THUMBNAILS = [...THUMBNAIL_BOXES, ...VIDEO_IMAGES];
  const SHORTS_LOCKUPS = [
    'ytm-shorts-lockup-view-model', 'ytm-shorts-lockup-view-model-v2',
    'yt-shorts-lockup-view-model', 'yt-shorts-lockup-view-model-v2',
  ];
  const SHORTS_SURFACES = [
    'ytm-reel-shelf-renderer', 'ytm-reel-item-renderer',
    'ytm-shorts-shelf-renderer', 'ytm-shorts-video-cell-view-model',
    'ytd-reel-shelf-renderer', 'ytd-reel-item-renderer', ...SHORTS_LOCKUPS,
    'yt-tab-shape[tab-title="Shorts"]', 'yt-tab-shape[tab-title="쇼츠"]',
    'ytm-tab-shape[tab-title="Shorts"]', 'ytm-tab-shape[tab-title="쇼츠"]',
    'ytm-pivot-bar-item-renderer[aria-label="Shorts"]',
    'ytm-pivot-bar-item-renderer[aria-label="쇼츠"]',
    `[${SHORTS_ATTR}]`,
  ];
  const SHORTS_CANDIDATES = [
    ...VIDEO_CARDS, 'ytm-rich-item-renderer', 'ytd-rich-item-renderer',
    'ytm-pivot-bar-item-renderer',
    'ytd-mini-guide-entry-renderer', 'ytd-guide-entry-renderer',
    'yt-tab-shape', 'ytm-tab-shape',
  ].join(',');
  const SHORTS_MARKERS = [
    '.pivot-shorts',
    'ytm-pivot-bar-item-renderer[aria-label="Shorts"]',
    'ytm-pivot-bar-item-renderer[aria-label="쇼츠"]',
    'ytm-pivot-bar-item-renderer [aria-label="Shorts"]',
    'ytm-pivot-bar-item-renderer [aria-label="쇼츠"]',
    'ytm-thumbnail-overlay-time-status-renderer[data-style="SHORTS"]',
    'ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]',
  ].join(',');
  const PRESERVE_CONTENT = [
    'ytm-comment-thread-renderer', 'ytm-comment-renderer',
    'ytm-comment-view-model', 'ytd-comment-thread-renderer',
    'ytd-comment-view-model', 'ytm-expandable-video-description-body-renderer',
    'ytd-text-inline-expander', '#movie_player', '#player-container-id',
  ].join(',');
  // Channel shelves can use different card renderers. Known video links are
  // also a safe thumbnail scope; leave their text and surrounding shelf alone.
  // Keep these separate from VIDEO_CARDS so a trailer's description cannot
  // cause its entire featured section to be treated as a Shorts card.
  const THUMBNAIL_SCOPES = [
    ...VIDEO_CARDS,
    'ytm-channel-featured-video-renderer', 'ytd-channel-featured-content-renderer',
    'a[href^="/watch?"]', 'a[href^="https://m.youtube.com/watch?"]',
    'a[href^="https://www.youtube.com/watch?"]', 'a[href^="https://youtube.com/watch?"]',
  ];
  const PRESERVE_THUMBNAILS = [
    PRESERVE_CONTENT, '#c4-player',
    'ytm-backstage-post-renderer', 'ytd-backstage-post-renderer',
  ].join(',');
  // A hidden thumbnail takes its length badge with it. Each card type gets the
  // badge text at the front of its own info line, cloned from that line's item
  // (and separator) so YouTube's styles and " · " / "•" separators still apply.
  const DURATION_TYPES = [
    { // Channel home lists: YouTube draws " · " before every later Stats item.
      card: 'ytm-compact-video-renderer',
      badge: 'ytm-thumbnail-overlay-time-status-renderer .ytBadgeShapeText',
      row: '.YtmCompactMediaItemSubhead', item: '.YtmCompactMediaItemStats',
    },
    { // Search results
      card: 'ytm-media-item',
      badge: 'ytm-thumbnail-overlay-time-status-renderer .ytBadgeShapeText',
      row: 'ytm-badge-and-byline-renderer', item: '.ytmBadgeAndBylineRendererItemByline',
      separator: '.ytmBadgeAndBylineRendererSeparator',
    },
    { // Playlists: the views row, the one with a delimiter.
      card: 'yt-lockup-view-model',
      badge: 'yt-thumbnail-badge-view-model .ytBadgeShapeText',
      row: '.ytContentMetadataViewModelMetadataRow', item: '.ytContentMetadataViewModelMetadataText',
      separator: '.ytContentMetadataViewModelDelimiter',
    },
  ];
  const DURATION_CARDS = DURATION_TYPES.map(type => type.card).join(',');
  const DURATION_BADGES = 'ytm-thumbnail-overlay-time-status-renderer, yt-thumbnail-badge-view-model';
  const FEATURED = 'ytm-channel-featured-video-renderer';

  // Keep the stylesheet small: the same card/thumbnail combinations need
  // only two selector lists, not hundreds of expanded descendant rules.
  const notPreserved = `:not(:is(${PRESERVE_THUMBNAILS}), :is(${PRESERVE_THUMBNAILS}) *)`;
  const thumbnailRules = `:is(${THUMBNAIL_SCOPES.join(',')}) :is(${THUMBNAILS.join(',')})${notPreserved}`;
  // Shelves outside the known cards (signed-in "For You", playlist header...)
  // still use the same video images. Hide those, and their thumbnail box once
  // it holds one; a channel avatar in the same box type stays visible.
  const videoImageRules = `:is(${VIDEO_IMAGES.join(',')})${notPreserved}`;
  const videoBoxRules = `:is(${THUMBNAIL_BOXES.join(',')}):has(${VIDEO_IMAGES.join(',')})${notPreserved}`;
  // Frames that stay behind as blank space: a playlist card's thumbnail link
  // (its title would start halfway across, or below the stacked-playlist
  // edge), and a search grid that held only Shorts. A grid that also holds
  // regular videos stays.
  const emptyFrameRules = [
    `yt-lockup-view-model .ytLockupViewModelContentImage:has(yt-thumbnail-view-model)${notPreserved}`,
    `ytm-playlist-card-renderer .playlist-card-image:has(.video-thumbnail-container-compact)${notPreserved}`,
    `grid-shelf-view-model:has(${SHORTS_LOCKUPS.join(',')}):not(:has(${VIDEO_CARDS.join(',')}))`,
  ];
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Declarative rules also cover lazy-loaded cards before JS rescans. */
    ${thumbnailRules},
    ${videoImageRules},
    ${SHORTS_SURFACES.join(',\n')} { display: none !important; }
    /* A separate rule: a browser without :has() drops only this one. */
    ${videoBoxRules},
    ${emptyFrameRules.join(',\n')} { display: none !important; }

    html[${PAGE_ATTR}="home"] .tab-content[tab-identifier="FEwhat_to_watch"] > :not(#${PANEL_ID}),
    html[${PAGE_ATTR}="home"] ytd-browse[page-subtype="home"] > :not(#${PANEL_ID}),
    html[${PAGE_ATTR}="home"] ytm-browse > :not(#${PANEL_ID}):not([${HOME_BRANCH_ATTR}]),
    html[${PAGE_ATTR}="home"] [${HOME_ATTR}] > :not(#${PANEL_ID}):not([${HOME_BRANCH_ATTR}]) {
      display: none !important;
    }

    html[${PAGE_ATTR}="watch"] ytm-item-section-renderer[section-identifier="related-items"],
    html[${PAGE_ATTR}="watch"] ytm-watch-next-secondary-results-renderer,
    html[${PAGE_ATTR}="watch"] ytd-watch-next-secondary-results-renderer,
    html[${PAGE_ATTR}="watch"] ytd-watch-flexy #related {
      display: none !important;
    }

    /* Channel home featured video: a header like the "동영상" shelf title
       (YouTube styles that one only inside ytm-shelf-renderer), and title and
       info line moved onto the list titles' line, 8px past the side padding. */
    ${FEATURED} > h3[${ADDED_ATTR}="featured-header"] {
      display: block; margin: 0; padding: 0 0 3px;
      overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
      color: inherit; font-family: inherit;
      font-size: 18px; font-weight: 700; line-height: 26px;
    }
    ${FEATURED} > a[href] { margin-left: 8px !important; }
    ${FEATURED} div[${ADDED_ATTR}="featured-info"] {
      overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
      font-size: 12px; font-weight: 400; line-height: 15px; opacity: .6;
    }

    html:not([${PAGE_ATTR}="home"]) #${PANEL_ID} { display: none !important; }
    #${PANEL_ID} {
      --dz-field-fallback: #f3f2f0;
      --dz-text-fallback: #343532;
      --dz-muted-fallback: #6d6e69;
      --dz-accent: #686964;
      box-sizing: border-box;
      max-width: 600px;
      margin: 48px auto;
      padding: 24px;
      color: var(--yt-spec-text-primary, var(--dz-text-fallback));
      font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      text-align: left;
    }
    #${PANEL_ID} * { box-sizing: border-box; }
    #${PANEL_ID} .dz-brand { margin: 0 0 14px; font-size: 12px; font-weight: 700; letter-spacing: 2px; opacity: .55; }
    #${PANEL_ID} h1 { margin: 0 0 10px; font-size: 27px; line-height: 1.3; font-weight: 700; }
    #${PANEL_ID} .dz-description { margin: 0 0 26px; opacity: .65; font-size: 14px; }
    #${PANEL_ID} form {
      display: flex; align-items: center; gap: 8px;
      width: 100%; min-height: 56px; margin: 0 0 18px; padding: 5px 5px 5px 20px;
      border: 1px solid transparent; border-radius: 999px;
      background: var(--yt-spec-badge-chip-background, var(--dz-field-fallback));
      transition: border-color .18s ease, box-shadow .18s ease;
    }
    #${PANEL_ID} form:focus-within {
      border-color: var(--dz-accent); box-shadow: 0 0 0 3px rgba(104, 105, 100, .14);
    }
    #${PANEL_ID} input {
      -webkit-appearance: none; appearance: none;
      flex: 1 1 0%; width: 100%; min-width: 0; height: 44px; margin: 0; padding: 0;
      border: 0; border-radius: 0; outline: none; box-shadow: none; background: transparent;
      color: inherit; caret-color: var(--dz-accent); font: inherit; font-size: 16px;
    }
    #${PANEL_ID} input::placeholder {
      color: var(--yt-spec-text-secondary, var(--dz-muted-fallback)); opacity: 1;
    }
    #${PANEL_ID} button {
      -webkit-appearance: none; appearance: none;
      display: grid; place-items: center; flex: 0 0 44px;
      width: 44px; height: 44px; min-height: 44px; margin: 0; padding: 0; border: 0;
      border-radius: 50%; background: var(--dz-accent); color: #fff;
      font: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent;
      transition: background-color .18s ease, transform .18s ease;
    }
    #${PANEL_ID} button svg { display: block; width: 20px; height: 20px; pointer-events: none; }
    #${PANEL_ID} button:active { transform: scale(.94); }
    #${PANEL_ID} button:focus, #${PANEL_ID} a:focus {
      outline: 2px solid var(--dz-accent); outline-offset: 3px;
    }
    #${PANEL_ID} a { color: inherit; font-size: 14px; text-decoration: underline; text-underline-offset: 4px; }
    @media (hover: hover) and (pointer: fine) {
      #${PANEL_ID} button:hover { background: #51524e; }
    }
    @media (prefers-color-scheme: dark) {
      #${PANEL_ID} {
        --dz-field-fallback: #292a28; --dz-text-fallback: #efefec; --dz-muted-fallback: #b2b3ad;
      }
    }
    html[dark] #${PANEL_ID} {
      --dz-field-fallback: #292a28; --dz-text-fallback: #efefec; --dz-muted-fallback: #b2b3ad;
    }
    @media (prefers-reduced-motion: reduce) {
      #${PANEL_ID} form, #${PANEL_ID} button { transition: none; }
      #${PANEL_ID} button:active { transform: none; }
    }
  `;

  let previousPath = '';
  let scheduled = 0;
  let fullScanNeeded = true;
  const pendingRoots = new Set();
  const hiddenShorts = new Set();
  let homePath = [];
  let homePanel = null;
  const featuredVideos = document.getElementsByTagName(FEATURED);

  function currentPath() {
    return location.pathname.replace(/\/+$/, '') || '/';
  }

  function updateRoute() {
    const path = currentPath();
    if (path === previousPath) return false;
    previousPath = path;
    const page = path === '/' || path === '/feed/what_to_watch'
      ? 'home' : path === '/watch' ? 'watch' : 'other';
    document.documentElement.setAttribute(PAGE_ATTR, page);
    return true;
  }

  function isShortsLink(anchor) {
    try {
      const url = new URL(anchor.getAttribute('href'), location.href);
      return /^(?:www\.|m\.)?youtube\.com$/.test(url.hostname)
        && /^\/(?:shorts(?:\/|$)|@[^/]+\/shorts(?:\/|$)|(?:channel|c|user)\/[^/]+\/shorts(?:\/|$))/.test(url.pathname);
    } catch { return false; }
  }

  function hasShortsContent(element) {
    if (element.matches(SHORTS_MARKERS) || element.querySelector(SHORTS_MARKERS)) return true;
    if (element.matches('a[href]') && isShortsLink(element)) return true;
    return Array.from(element.querySelectorAll('a[href]')).some(isShortsLink);
  }

  function hideShortsElement(element) {
    if (element.closest(PRESERVE_CONTENT)) return;
    const target = element.closest('ytm-rich-item-renderer, ytd-rich-item-renderer')
      || element.closest(SHORTS_CANDIDATES) || element;
    target.setAttribute(SHORTS_ATTR, '');
    hiddenShorts.add(target);
  }

  function scanShorts(root) {
    if (!root.isConnected) return;
    if (root.matches?.('a[href]') && isShortsLink(root)) hideShortsElement(root);
    if (root.matches?.(SHORTS_MARKERS)) hideShortsElement(root);
    root.querySelectorAll('a[href]').forEach(anchor => {
      if (isShortsLink(anchor)) hideShortsElement(anchor);
    });
    root.querySelectorAll(SHORTS_MARKERS).forEach(hideShortsElement);
  }

  function addedElement(tag, kind, text) {
    const element = document.createElement(tag);
    element.setAttribute(ADDED_ATTR, kind);
    element.textContent = text;
    return element;
  }

  function syncDuration(card) {
    const type = DURATION_TYPES.find(candidate => card.matches(candidate.card));
    const previous = Array.from(card.querySelectorAll(`[${ADDED_ATTR}="duration"]`));
    // Thumbnails stay visible in descriptions, comments and the player.
    const text = card.closest(PRESERVE_THUMBNAILS) ? ''
      : card.querySelector(type.badge)?.textContent.trim() || '';
    let anchor = null;
    let separator = null;
    if (text) {
      for (const row of card.querySelectorAll(type.row)) {
        anchor = row.querySelector(`:scope > ${type.item}:not([${ADDED_ATTR}])`);
        separator = type.separator
          && row.querySelector(`:scope > ${type.separator}:not([${ADDED_ATTR}])`);
        if (anchor && (!type.separator || separator)) break;
        anchor = null;
      }
    }
    // Recycled cards change badge text or redraw the line: keep exactly one
    // copy with the current text, right before the line's first own item.
    const count = anchor ? (separator ? 2 : 1) : 0;
    if (previous.length === count && (!count || (previous[0].textContent === text
      && previous[count - 1].nextElementSibling === anchor
      && previous[0].nextElementSibling === (count === 2 ? previous[1] : anchor)))) return;
    previous.forEach(element => element.remove());
    if (!anchor) return;
    const item = anchor.cloneNode(false);
    item.removeAttribute('aria-label');
    item.classList.remove('ytContentMetadataViewModelMetadataTextLastPart');
    item.setAttribute(ADDED_ATTR, 'duration');
    item.textContent = text;
    const copies = [item];
    if (separator) {
      const copy = separator.cloneNode(true);
      copy.setAttribute(ADDED_ATTR, 'duration');
      copies.push(copy);
    }
    anchor.before(...copies);
  }

  function syncDurations(roots) {
    const cards = new Set();
    for (const root of roots) {
      if (!root.isConnected) continue;
      const card = root.closest?.(DURATION_CARDS);
      if (card) cards.add(card);
      root.querySelectorAll(DURATION_CARDS).forEach(found => cards.add(found));
    }
    cards.forEach(syncDuration);
  }

  // YouTube rounds view counts down: 1.5천, 4.2만, 141만, 1.2억, 12억.
  function shortCount(count) {
    for (const [size, unit] of [[1e8, '억'], [1e4, '만'], [1e3, '천']]) {
      if (count < size) continue;
      const tenths = Math.floor(count * 10 / size);
      return `${tenths < 100 ? tenths / 10 : Math.floor(tenths / 10)}${unit}`;
    }
    return String(count);
  }

  // The featured title's aria-label carries what its thumbnail showed:
  // "<제목> 게시자: <채널> 조회수 1,411,788회 5개월 전 12분 18초", or
  // "<제목> 게시자: <채널> 4.8천명 시청 중" while the channel is live.
  function featuredDetails(label) {
    const watching = / (\d[\d,.]*[천만억]?명 시청 중)$/.exec(label);
    if (watching) return { live: true, info: watching[1] };
    const start = label.lastIndexOf(' 조회수 ');
    const match = start < 0 ? null
      : /^([\d,]+)회 (.*전)(?: (?=\d)(?:(\d+)시간 ?)?(?:(\d+)분 ?)?(?:(\d+)초)?)?$/.exec(label.slice(start + 5));
    if (!match) return { live: false, info: '' };
    const [, views, date, hours, minutes, seconds] = match;
    const pad = value => String(value || 0).padStart(2, '0');
    const length = hours ? `${hours}:${pad(minutes)}:${pad(seconds)}`
      : minutes || seconds ? `${minutes || 0}:${pad(seconds)}` : '';
    const count = `조회수 ${shortCount(Number(views.replace(/,/g, '')))}회`;
    return { live: false, info: [length, count, date].filter(Boolean).join(' · ') };
  }

  // Subscribers see the channel's pick for returning subscribers, everyone
  // else (signed out included) the channel trailer.
  function isSubscribed(featured) {
    const page = featured.closest('ytm-browse') || document;
    return Array.from(page.querySelectorAll('yt-page-header-view-model button, ytm-c4-tabbed-header-renderer button'))
      .some(button => /^구독\s*중/.test(button.textContent.trim()));
  }

  function syncFeatured(featured) {
    const title = featured.querySelector(`h3:not([${ADDED_ATTR}])`);
    // The labels and the aria-label format are Korean.
    const details = title && /^ko\b/i.test(document.documentElement.lang)
      ? featuredDetails(title.querySelector('[aria-label]')?.getAttribute('aria-label') || '')
      : null;
    const heading = !details ? '' : details.live ? '라이브'
      : isSubscribed(featured) ? '추천 동영상' : '채널 트레일러';
    const headers = featured.querySelectorAll(`[${ADDED_ATTR}="featured-header"]`);
    if (!(heading && headers.length === 1 && headers[0] === featured.firstElementChild
      && headers[0].textContent === heading)) {
      headers.forEach(element => element.remove());
      if (heading) featured.prepend(addedElement('h3', 'featured-header', heading));
    }
    const info = details?.info || '';
    const infos = featured.querySelectorAll(`[${ADDED_ATTR}="featured-info"]`);
    if (!(info && infos.length === 1 && infos[0] === title.nextElementSibling
      && infos[0].textContent === info)) {
      infos.forEach(element => element.remove());
      if (info) title.after(addedElement('div', 'featured-info', info));
    }
  }

  function addHomeSearch() {
    if (document.documentElement.getAttribute(PAGE_ATTR) !== 'home') {
      homePath = [];
      homePanel = null;
      return;
    }
    const root = document.querySelector('.tab-content[tab-identifier="FEwhat_to_watch"]')
      || document.querySelector('ytd-browse[page-subtype="home"]')
      || document.querySelector('ytm-browse');
    if (!root) {
      homePath = [];
      homePanel = null;
      return;
    }
    const browse = root.closest('ytm-browse');
    const path = [root];
    let branch = root;
    while (browse && branch !== browse) {
      branch = branch.parentElement;
      path.push(branch);
    }
    // YouTube mutates its DOM frequently. Leave a healthy home branch alone,
    // but still detect a late home tab, reparented root or replaced search panel.
    if (homePanel?.parentElement === root && path.length === homePath.length
      && path.every((node, index) => node === homePath[index]
        && node.hasAttribute(HOME_ATTR)
        && (index === path.length - 1 || node.hasAttribute(HOME_BRANCH_ATTR)))) return;
    // Keep only the branch leading to the real home tab. This also hides a
    // fallback feed that YouTube has not removed from its old browse wrapper.
    document.querySelectorAll(`[${HOME_ATTR}], [${HOME_BRANCH_ATTR}]`).forEach(previousRoot => {
      previousRoot.removeAttribute(HOME_ATTR);
      previousRoot.removeAttribute(HOME_BRANCH_ATTR);
    });
    path.forEach((node, index) => {
      node.setAttribute(HOME_ATTR, '');
      if (index < path.length - 1) node.setAttribute(HOME_BRANCH_ATTR, '');
    });
    homePath = path;
    homePanel = root.querySelector(`#${PANEL_ID}`);
    if (homePanel) return;
    // YouTube can replace its home container during navigation.
    document.getElementById(PANEL_ID)?.remove();
    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.setAttribute('aria-label', 'DopaZero 유튜브 검색');
    const brand = document.createElement('p');
    brand.className = 'dz-brand';
    brand.textContent = 'DOPAZERO';
    const heading = document.createElement('h1');
    heading.textContent = '보고 싶은 영상만.';
    const description = document.createElement('p');
    description.className = 'dz-description';
    description.textContent = '추천 피드는 비워 두었어요. 필요한 영상을 검색해 보세요.';
    const form = document.createElement('form');
    form.action = '/results';
    form.method = 'get';
    form.setAttribute('role', 'search');
    const input = document.createElement('input');
    input.type = 'search';
    input.name = 'search_query';
    input.placeholder = '유튜브 검색';
    input.setAttribute('aria-label', '유튜브 검색어');
    input.setAttribute('enterkeyhint', 'search');
    input.required = true;
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.setAttribute('aria-label', '검색');
    submit.title = '검색';
    const svgNS = 'http://www.w3.org/2000/svg';
    const icon = document.createElementNS(svgNS, 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '1.8');
    icon.setAttribute('stroke-linecap', 'round');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');
    const lens = document.createElementNS(svgNS, 'circle');
    lens.setAttribute('cx', '10.8');
    lens.setAttribute('cy', '10.8');
    lens.setAttribute('r', '6.8');
    const handle = document.createElementNS(svgNS, 'path');
    handle.setAttribute('d', 'M16 16l4.2 4.2');
    icon.append(lens, handle);
    submit.append(icon);
    form.addEventListener('submit', event => {
      input.value = input.value.trim();
      if (!input.value) { event.preventDefault(); input.focus(); }
    });
    form.append(input, submit);
    const subscriptions = document.createElement('a');
    subscriptions.href = '/feed/subscriptions';
    subscriptions.textContent = '구독 영상 보러 가기';
    panel.append(brand, heading, description, form, subscriptions);
    root.prepend(panel);
    homePanel = panel;
  }

  function syncVisiblePage() {
    if (!style.isConnected) document.documentElement.append(style);
    // Remember navigation for the later Shorts scan even though the visible
    // page state is updated right now, before the next timer or paint.
    if (updateRoute()) fullScanNeeded = true;
    addHomeSearch();
  }

  function refresh() {
    scheduled = 0;
    syncVisiblePage();
    // Recycled cards and nav items must become visible again if they stop being Shorts.
    for (const element of hiddenShorts) {
      if (!element.isConnected || !hasShortsContent(element)) {
        element.removeAttribute(SHORTS_ATTR);
        hiddenShorts.delete(element);
      }
    }
    const roots = fullScanNeeded ? [document] : pendingRoots;
    for (const root of roots) scanShorts(root);
    syncDurations(roots);
    // At most one per channel home; its header also follows the subscribe button.
    for (const featured of featuredVideos) syncFeatured(featured);
    pendingRoots.clear();
    fullScanNeeded = false;
  }

  function schedule(fullScan = false) {
    fullScanNeeded = fullScanNeeded || fullScan;
    if (!scheduled) scheduled = window.setTimeout(refresh, 60);
  }

  function start() {
    syncVisiblePage();
    // CSS and the search panel take priority over scanning all existing links.
    schedule(true);
    const isAdded = node => node.nodeType === Node.ELEMENT_NODE && node.hasAttribute(ADDED_ATTR);
    new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData') {
          // Badges fill in (or recycle) their length text in place; the
          // subscribe button can relabel itself the same way.
          const owner = record.target.parentElement
            ?.closest(`${DURATION_BADGES}, yt-page-header-view-model button`);
          if (owner) pendingRoots.add(owner);
          continue;
        }
        if (record.type === 'attributes') {
          // Ignore unrelated animation/player class changes; only navigation
          // markers need class/label observation, including marker removal.
          if (record.attributeName === 'class'
            && !record.target.closest('ytm-pivot-bar-item-renderer')
            && !record.target.classList.contains('pivot-shorts')
            && !/(^|\s)pivot-shorts(\s|$)/.test(record.oldValue || '')) continue;
          // The featured title's aria-label is the source of its info line.
          if (record.attributeName === 'aria-label'
            && !record.target.closest(`ytm-pivot-bar-item-renderer, ${FEATURED}`)) continue;
          pendingRoots.add(record.target);
        }
        // Elements this script inserted or removed itself need no new pass.
        if (record.removedNodes.length && record.target.nodeType === Node.ELEMENT_NODE
          && !Array.from(record.removedNodes).every(isAdded)) {
          pendingRoots.add(record.target);
        }
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && node !== style && node.id !== PANEL_ID
            && !isAdded(node)) {
            pendingRoots.add(node);
          }
        }
      }
      if (pendingRoots.size || currentPath() !== previousPath || !style.isConnected) {
        syncVisiblePage();
        schedule();
      }
    }).observe(document.documentElement, {
      subtree: true, childList: true, attributes: true, characterData: true,
      attributeOldValue: true,
      attributeFilter: ['href', 'data-style', 'overlay-style', 'tab-title', 'class', 'aria-label', 'tab-identifier', 'page-subtype'],
    });
    // Events + DOM observation work in Userscripts' isolated content context.
    // The lightweight URL check also covers pushState without DOM changes.
    function restorePage() {
      syncVisiblePage();
      schedule(true);
    }
    ['yt-navigate-finish', 'yt-page-data-updated', 'yt-navigate-start'].forEach(name => {
      document.addEventListener(name, restorePage);
    });
    ['popstate', 'hashchange', 'pageshow'].forEach(name => {
      window.addEventListener(name, restorePage);
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) restorePage();
    });
    window.setInterval(() => {
      if (!document.hidden && currentPath() !== previousPath) restorePage();
    }, 500);
    // Feed cards play a muted preview where the thumbnail was by moving
    // YouTube's one shared player into the card: ytm-video-preview for videos,
    // the thumbnail's shim for stacked playlists. With the thumbnail hidden it
    // would play unseen, so stop it there. play() often fires before the move,
    // hence 'playing' too; the watch page keeps the player outside both.
    function stopHiddenPreview(event) {
      if (event.target.closest?.('ytm-video-preview, .video-preview-shim')) event.target.pause();
    }
    ['play', 'playing'].forEach(name => {
      document.addEventListener(name, stopHiddenPreview, true);
    });
  }

  if (document.documentElement) start();
  else new MutationObserver((records, observer) => {
    if (document.documentElement) { observer.disconnect(); start(); }
  }).observe(document, { childList: true });
})();
