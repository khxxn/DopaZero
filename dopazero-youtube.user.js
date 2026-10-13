// ==UserScript==
// @name         DopaZero - YouTube 집중 모드
// @namespace    dopazero.local
// @version      1.0.1
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
  if (document.getElementById(STYLE_ID)) return;

  // Keep these scoped to video cards: avatars, comments and the player stay intact.
  const VIDEO_CARDS = [
    'ytm-video-with-context-renderer', 'ytm-compact-video-renderer',
    'ytm-compact-playlist-renderer', 'ytm-compact-radio-renderer',
    'ytm-playlist-renderer', 'ytd-playlist-renderer', 'ytd-radio-renderer',
    'ytm-video-renderer', 'ytm-grid-video-renderer', 'ytm-playlist-video-renderer',
    'ytm-playlist-panel-video-renderer', 'ytm-rich-grid-media',
    'ytm-media-item', 'ytm-lockup-view-model',
    'ytd-video-renderer', 'ytd-grid-video-renderer', 'ytd-rich-grid-media',
    'ytd-compact-video-renderer', 'ytd-playlist-video-renderer',
    'ytd-playlist-panel-video-renderer', 'yt-lockup-view-model',
  ];
  const THUMBNAILS = [
    '.video-thumbnail-container-large', '.video-thumbnail-container-compact',
    '.video-thumbnail-container-compact-rounded', '.media-item-thumbnail-container',
    '.thumbnail-cover', '.thumbnail-cover-rounded', 'ytm-thumbnail-cover',
    'ytm-thumbnail-view-model', 'yt-thumbnail-view-model', 'ytd-thumbnail',
    '.ytThumbnailViewModelHost',
    '.ytContentPreviewImageViewModelHost:not(.ytContentPreviewImageViewModelCircleImage)',
    'img[src*="/vi/"]', 'img[src*="/vi_webp/"]',
    'img[src*="/an_webp/"]', 'img[data-thumb*="/vi/"]',
  ];
  const SHORTS_SURFACES = [
    'ytm-reel-shelf-renderer', 'ytm-reel-item-renderer',
    'ytm-shorts-shelf-renderer', 'ytm-shorts-lockup-view-model',
    'ytm-shorts-lockup-view-model-v2', 'ytm-shorts-video-cell-view-model',
    'ytd-reel-shelf-renderer', 'ytd-reel-item-renderer',
    'yt-shorts-lockup-view-model', 'yt-shorts-lockup-view-model-v2',
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

  const thumbnailRules = VIDEO_CARDS.flatMap(card =>
    THUMBNAILS.map(thumbnail => `${card} ${thumbnail}`)
  ).join(',\n');
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Declarative rules also cover lazy-loaded cards before JS rescans. */
    ${thumbnailRules},
    ${SHORTS_SURFACES.join(',\n')} { display: none !important; }

    html[${PAGE_ATTR}="home"] .tab-content[tab-identifier="FEwhat_to_watch"] > :not(#${PANEL_ID}),
    html[${PAGE_ATTR}="home"] ytd-browse[page-subtype="home"] > :not(#${PANEL_ID}),
    html[${PAGE_ATTR}="home"] [${HOME_ATTR}] > :not(#${PANEL_ID}):not([${HOME_BRANCH_ATTR}]) {
      display: none !important;
    }

    html[${PAGE_ATTR}="watch"] ytm-item-section-renderer[section-identifier="related-items"],
    html[${PAGE_ATTR}="watch"] ytm-watch-next-secondary-results-renderer,
    html[${PAGE_ATTR}="watch"] ytd-watch-next-secondary-results-renderer,
    html[${PAGE_ATTR}="watch"] ytd-watch-flexy #related {
      display: none !important;
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

  function addHomeSearch() {
    if (document.documentElement.getAttribute(PAGE_ATTR) !== 'home') return;
    const root = document.querySelector('.tab-content[tab-identifier="FEwhat_to_watch"]')
      || document.querySelector('ytd-browse[page-subtype="home"]')
      || document.querySelector('ytm-browse');
    if (!root) return;
    // Keep only the branch leading to the real home tab. This also hides a
    // fallback feed that YouTube has not removed from its old browse wrapper.
    document.querySelectorAll(`[${HOME_ATTR}], [${HOME_BRANCH_ATTR}]`).forEach(previousRoot => {
      previousRoot.removeAttribute(HOME_ATTR);
      previousRoot.removeAttribute(HOME_BRANCH_ATTR);
    });
    root.setAttribute(HOME_ATTR, '');
    const browse = root.closest('ytm-browse');
    let branch = root;
    while (browse && branch !== browse) {
      branch.setAttribute(HOME_BRANCH_ATTR, '');
      branch = branch.parentElement;
      branch.setAttribute(HOME_ATTR, '');
    }
    if (root.querySelector(`#${PANEL_ID}`)) return;
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
  }

  function refresh() {
    scheduled = 0;
    if (!style.isConnected) document.documentElement.append(style);
    const routeChanged = updateRoute();
    // Recycled cards and nav items must become visible again if they stop being Shorts.
    for (const element of hiddenShorts) {
      if (!element.isConnected || !hasShortsContent(element)) {
        element.removeAttribute(SHORTS_ATTR);
        hiddenShorts.delete(element);
      }
    }
    if (routeChanged || fullScanNeeded) {
      scanShorts(document);
    } else {
      for (const root of pendingRoots) scanShorts(root);
    }
    pendingRoots.clear();
    fullScanNeeded = false;
    addHomeSearch();
  }

  function schedule(fullScan = false) {
    fullScanNeeded = fullScanNeeded || fullScan;
    if (!scheduled) scheduled = window.setTimeout(refresh, 60);
  }

  function start() {
    updateRoute();
    document.documentElement.append(style);
    refresh();
    new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'attributes') {
          // Ignore unrelated animation/player class changes; only navigation
          // markers need class/label observation, including marker removal.
          if (record.attributeName === 'class'
            && !record.target.closest('ytm-pivot-bar-item-renderer')
            && !record.target.classList.contains('pivot-shorts')
            && !/(^|\s)pivot-shorts(\s|$)/.test(record.oldValue || '')) continue;
          if (record.attributeName === 'aria-label'
            && !record.target.closest('ytm-pivot-bar-item-renderer')) continue;
          pendingRoots.add(record.target);
        }
        if (record.removedNodes.length && record.target.nodeType === Node.ELEMENT_NODE) {
          pendingRoots.add(record.target);
        }
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && node !== style && node.id !== PANEL_ID) {
            pendingRoots.add(node);
          }
        }
      }
      if (pendingRoots.size || currentPath() !== previousPath || !style.isConnected) schedule();
    }).observe(document.documentElement, {
      subtree: true, childList: true, attributes: true,
      attributeOldValue: true,
      attributeFilter: ['href', 'data-style', 'overlay-style', 'tab-title', 'class', 'aria-label', 'tab-identifier', 'page-subtype'],
    });
    // Events + DOM observation work in Userscripts' isolated content context.
    // The lightweight URL check also covers pushState without DOM changes.
    ['yt-navigate-finish', 'yt-page-data-updated', 'yt-navigate-start'].forEach(name => {
      document.addEventListener(name, () => schedule(true));
    });
    ['popstate', 'hashchange', 'pageshow'].forEach(name => {
      window.addEventListener(name, () => schedule(true));
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) schedule(true);
    });
    window.setInterval(() => {
      if (!document.hidden && currentPath() !== previousPath) schedule(true);
    }, 500);
  }

  if (document.documentElement) start();
  else new MutationObserver((records, observer) => {
    if (document.documentElement) { observer.disconnect(); start(); }
  }).observe(document, { childList: true });
})();
