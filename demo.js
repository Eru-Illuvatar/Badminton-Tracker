// demo.js – First-run tour for Badminton Tracker
import { t, getCurrentLanguage, setCurrentLanguage } from './utils.js';

const TOUR_STATE_KEY = 'tourState';
const USER_NAME_KEY = 'userFirstName';

const defaultState = { step: 0, completed: false };

let currentStep = 1;
let overlayElement, tooltipElement;
let skipHandler = null;
let onLanguageChangeCallback = null;

const totalSteps = 6;

// ------------------------------------------------------------
// Step definitions – all content uses translation functions
// ------------------------------------------------------------
const steps = {
  1: {
    target: null,
    getTitle: () => t('tour.languageStep.title'),
    getContent: () => `
      <p>${t('tour.languageStep.content')}</p>
      <div style="margin: 15px 0;">
        <select id="tour-language-select" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color);">
          <option value="en">🇺🇸 English</option>
          <option value="nl">🇳🇱 Nederlands</option>
          <option value="fr">🇫🇷 Français</option>
          <option value="de">🇩🇪 Deutsch</option>
        </select>
      </div>
      <div style="display: flex; justify-content: space-between; gap: 10px;">
        <button id="tour-skip" style="background:transparent; border:1px solid var(--border-color); padding:6px 12px; border-radius:4px; color:var(--text-muted); cursor:pointer;">${t('tour.skip')}</button>
        <button id="tour-language-next" class="btn btn-primary">${t('tour.next')}</button>
      </div>
    `,
    customHandler: true,
  },
  2: {
    target: null,
    getTitle: () => `${t('tour.nameStep.title')} <span style="font-size:0.8rem; font-weight:normal;">(${t('tour.nameStep.optional')})</span>`,
    getContent: () => `
      <p>${t('tour.nameStep.content')}</p>
      <div style="margin: 15px 0;">
        <input type="text" id="tour-name-input" placeholder="${t('tour.nameStep.namePlaceholder')}" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color);">
      </div>
      <div style="display: flex; justify-content: space-between; gap: 10px;">
        <button id="tour-skip" style="background:transparent; border:1px solid var(--border-color); padding:6px 12px; border-radius:4px; color:var(--text-muted); cursor:pointer;">${t('tour.skip')}</button>
        <div style="display: flex; gap: 10px;">
          <button id="tour-name-prev" class="btn" style="background: var(--border-color);">${t('tour.prev')}</button>
          <button id="tour-name-save" class="btn btn-primary">${t('tour.nameStep.saveButton')}</button>
        </div>
      </div>
    `,
    customHandler: true,
  },
  3: {
    target: null,
    getTitle: () => t('tour.profileStep.title'),
    getContent: () => `
      <p><strong>${t('tour.profileStep.bvText')}</strong></p>
      <div style="margin-bottom: 10px;">
        <a href="https://www.badmintonvlaanderen.be/ranking/category.aspx?rid=334&category=4582" target="_blank" style="color: var(--primary-color);">${t('tour.profileStep.linkBvText')}</a>
      </div>
      <div style="margin-bottom: 20px;">
        <input type="url" id="tour-bv-url" class="profile-input" placeholder="https://www.badmintonvlaanderen.be/profile/..." style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color);">
      </div>

      <p><strong>${t('tour.profileStep.toernooiText')}</strong></p>
      <div style="display: flex; gap: 10px; margin-bottom: 10px;">
        <a href="https://www.toernooi.nl/find/player" target="_blank" style="color: var(--primary-color);">${t('tour.profileStep.linkToernooiText')}</a>
        <a href="https://lfbb.tournamentsoftware.com/find/player" target="_blank" style="color: var(--primary-color);">${t('tour.profileStep.linkLfbbText')}</a>
      </div>
      <div style="margin-bottom: 20px;">
        <input type="url" id="tour-toernooi-url" class="profile-input" placeholder="https://www.toernooi.nl/player-profile/..." style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color);">
      </div>

      <p>${t('tour.profileStep.afterAddingText')}</p>
      <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 10px;">${t('tour.profileStep.ps')}</p>

      <div style="display: flex; justify-content: space-between; gap: 10px; margin-top: 15px;">
        <button id="tour-skip" style="background:transparent; border:1px solid var(--border-color); padding:6px 12px; border-radius:4px; color:var(--text-muted); cursor:pointer;">${t('tour.skip')}</button>
        <div style="display: flex; gap: 10px;">
          <button id="tour-profile-prev" class="btn" style="background: var(--border-color);">${t('tour.prev')}</button>
          <button id="tour-profile-next" class="btn btn-primary">${t('tour.next')}</button>
        </div>
      </div>
    `,
    customHandler: true,
  },
  4: {
    target: '#scrapeAllBtn',
    getTitle: () => t('tour.scrapeStep.title'),
    getContent: () => `<p>${t('tour.scrapeStep.content')}</p>`,
    nextOnClick: true,
    customHandler: false,
  },
  5: {
    target: '#matchTable tbody tr:first-child',
    getTitle: () => t('tour.editStep.title'),
    getContent: () => `<p>${t('tour.editStep.content')}</p>`,
    nextOnClick: false,
    customHandler: false,
  },
  6: {
    target: null,
    getTitle: () => t('tour.finishStep.title'),
    getContent: () => `<p>${t('tour.finishStep.content')}</p>`,
    nextOnClick: false,
    customHandler: false,
  }
};

// ------------------------------------------------------------
// UI creation
// ------------------------------------------------------------
function createTourElements() {
  if (document.getElementById('tour-overlay')) return;

  overlayElement = document.createElement('div');
  overlayElement.id = 'tour-overlay';
  overlayElement.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    z-index: 10000;
    display: none;
    pointer-events: all;
  `;

  tooltipElement = document.createElement('div');
  tooltipElement.id = 'tour-tooltip';
  tooltipElement.style.cssText = `
    position: absolute;
    background: var(--card-bg, #fff);
    color: var(--text-color, #333);
    border-radius: 8px;
    padding: 20px;
    max-width: 400px;
    box-shadow: 0 5px 30px rgba(0,0,0,0.3);
    z-index: 10001;
    font-size: 14px;
    line-height: 1.5;
    pointer-events: auto;
  `;

  document.body.appendChild(overlayElement);
  document.body.appendChild(tooltipElement);
}

// ------------------------------------------------------------
// Highlight target element
// ------------------------------------------------------------
function highlightTarget(selector) {
  if (!selector) {
    overlayElement.style.display = 'block';
    tooltipElement.style.left = '50%';
    tooltipElement.style.top = '50%';
    tooltipElement.style.transform = 'translate(-50%, -50%)';
    tooltipElement.style.maxWidth = '400px';
    return;
  }

  const target = document.querySelector(selector);
  if (!target) {
    console.warn(`Tour target not found: ${selector}`);
    highlightTarget(null);
    return;
  }

  const rect = target.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

  const tooltipWidth = 400;
  const tooltipHeight = 200;
  let left = rect.left + scrollLeft + rect.width / 2 - tooltipWidth / 2;
  let top = rect.top + scrollTop - tooltipHeight - 20;

  if (top < scrollTop + 10) {
    top = rect.bottom + scrollTop + 20;
  }
  if (left < scrollLeft + 10) left = scrollLeft + 10;
  if (left + tooltipWidth > window.innerWidth + scrollLeft - 10) {
    left = window.innerWidth + scrollLeft - tooltipWidth - 10;
  }

  overlayElement.style.display = 'block';
  tooltipElement.style.left = left + 'px';
  tooltipElement.style.top = top + 'px';
  tooltipElement.style.transform = 'none';
  tooltipElement.style.maxWidth = '400px';
}

// ------------------------------------------------------------
// Save profile URLs to storage
// ------------------------------------------------------------
function saveProfileUrl(key, url) {
  if (!url || url.trim() === '') {
    chrome.storage.local.remove([key]);
    return;
  }
  const cleanUrl = url.trim();
  let isValid = false;
  if (key === 'badmintonVlaanderenProfile') {
    isValid = cleanUrl.includes('badmintonvlaanderen.be') && (cleanUrl.includes('/profile/') || cleanUrl.includes('/speler/'));
  } else if (key === 'toernooiProfile') {
    isValid = (cleanUrl.includes('toernooi.nl') || cleanUrl.includes('tournamentsoftware.com')) && (cleanUrl.includes('/player-profile/') || cleanUrl.includes('/speler/'));
  }
  if (!isValid) {
    console.warn(`Invalid ${key} URL`);
    return;
  }
  chrome.storage.local.set({ [key]: cleanUrl });
}

function renderStep(stepNum) {
  const step = steps[stepNum];
  if (!step) return;

  const title = step.getTitle();
  const content = step.getContent();

  let html = `<h3 style="margin-top:0; color: var(--primary-color);">${title}</h3>`;
  html += `<div>${content}</div>`;

  let progressHtml = '<div style="display:flex; justify-content:center; gap:8px; margin:15px 0;">';
  for (let i = 1; i <= totalSteps; i++) {
    progressHtml += `<span style="width:10px; height:10px; border-radius:50%; background:${i === stepNum ? 'var(--primary-color)' : '#ccc'};"></span>`;
  }
  progressHtml += '</div>';
  html += progressHtml;

  if (!step.customHandler) {
    html += '<div style="display:flex; justify-content:space-between; align-items:center;">';
    html += `<button id="tour-skip" style="background:transparent; border:1px solid var(--border-color); padding:6px 12px; border-radius:4px; color:var(--text-muted); cursor:pointer;">${t('tour.skip')}</button>`;
    if (stepNum > 1) {
      html += `<button id="tour-prev" class="btn" style="background:var(--border-color);">${t('tour.prev')}</button>`;
    }
    if (stepNum < totalSteps) {
      html += `<button id="tour-next" class="btn btn-primary">${t('tour.next')}</button>`;
    } else {
      html += `<button id="tour-finish" class="btn btn-primary">${t('tour.finish')}</button>`;
    }
    html += '</div>';
  }

  tooltipElement.innerHTML = html;

  if (!step.customHandler) {
    document.getElementById('tour-skip')?.addEventListener('click', skipTour);
    document.getElementById('tour-prev')?.addEventListener('click', () => goToStep(stepNum - 1));
    document.getElementById('tour-next')?.addEventListener('click', () => goToStep(stepNum + 1));
    document.getElementById('tour-finish')?.addEventListener('click', finishTour);
  }

  if (step.customHandler) {
    if (stepNum === 1) {
      const select = document.getElementById('tour-language-select');
      if (select) {
        select.value = getCurrentLanguage() || 'en';
        select.addEventListener('change', async (e) => {
          const lang = e.target.value;
          if (onLanguageChangeCallback) {
            onLanguageChangeCallback(lang);
          }
          renderStep(currentStep);
        });
      }
      const nextBtn = document.getElementById('tour-language-next');
      if (nextBtn) nextBtn.addEventListener('click', () => goToStep(stepNum + 1));
    } else if (stepNum === 2) {
      const prevBtn = document.getElementById('tour-name-prev');
      if (prevBtn) prevBtn.addEventListener('click', () => goToStep(stepNum - 1));
      const saveBtn = document.getElementById('tour-name-save');
      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
          const input = document.getElementById('tour-name-input');
          const name = input ? input.value.trim() : '';
          if (name) {
            await chrome.storage.local.set({ [USER_NAME_KEY]: name });
            const titleH1 = document.querySelector('.header-left h1');
            if (titleH1) titleH1.textContent = `${name}'s Badminton Analysis`;
          }
          goToStep(stepNum + 1);
        });
      }
    } else if (stepNum === 3) {
      chrome.storage.local.get(['badmintonVlaanderenProfile', 'toernooiProfile'], (result) => {
        const bvInput = document.getElementById('tour-bv-url');
        const tnInput = document.getElementById('tour-toernooi-url');
        if (bvInput) bvInput.value = result.badmintonVlaanderenProfile || '';
        if (tnInput) tnInput.value = result.toernooiProfile || '';
      });
      const prevBtn = document.getElementById('tour-profile-prev');
      if (prevBtn) prevBtn.addEventListener('click', () => goToStep(stepNum - 1));
      const nextBtn = document.getElementById('tour-profile-next');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          const bvInput = document.getElementById('tour-bv-url');
          const tnInput = document.getElementById('tour-toernooi-url');
          if (bvInput) saveProfileUrl('badmintonVlaanderenProfile', bvInput.value);
          if (tnInput) saveProfileUrl('toernooiProfile', tnInput.value);
          goToStep(stepNum + 1);
        });
      }
      const bvInput = document.getElementById('tour-bv-url');
      const tnInput = document.getElementById('tour-toernooi-url');
      if (bvInput) bvInput.addEventListener('blur', () => saveProfileUrl('badmintonVlaanderenProfile', bvInput.value));
      if (tnInput) tnInput.addEventListener('blur', () => saveProfileUrl('toernooiProfile', tnInput.value));
    }

    document.getElementById('tour-skip')?.addEventListener('click', skipTour);
  }

  if (step.nextOnClick && step.target && !step.customHandler) {
    const targetEl = document.querySelector(step.target);
    if (targetEl) {
      const handler = () => {
        targetEl.removeEventListener('click', handler);
        goToStep(stepNum + 1);
      };
      targetEl.addEventListener('click', handler);
      skipHandler = handler;
    }
  }
}

// ------------------------------------------------------------
// Navigation
// ------------------------------------------------------------
async function goToStep(stepNum) {
  if (stepNum < 1 || stepNum > totalSteps) return;

  if (skipHandler) {
    const prevStep = steps[currentStep];
    if (prevStep && prevStep.target) {
      const prevTarget = document.querySelector(prevStep.target);
      if (prevTarget) prevTarget.removeEventListener('click', skipHandler);
    }
    skipHandler = null;
  }

  currentStep = stepNum;
  await saveTourState({ step: currentStep, completed: false });
  renderStep(currentStep);
  highlightTarget(steps[currentStep].target);
}

async function skipTour() {
  await saveTourState({ step: -1, completed: false });
  hideTour();
}

async function finishTour() {
  await saveTourState({ step: -1, completed: true });
  hideTour();
}

function hideTour() {
  overlayElement.style.display = 'none';
  tooltipElement.style.display = 'none';
  if (skipHandler) {
    const prevStep = steps[currentStep];
    if (prevStep && prevStep.target) {
      const prevTarget = document.querySelector(prevStep.target);
      if (prevTarget) prevTarget.removeEventListener('click', skipHandler);
    }
    skipHandler = null;
  }
}

// ------------------------------------------------------------
// Storage helpers
// ------------------------------------------------------------
function saveTourState(state) {
  return new Promise(resolve => {
    chrome.storage.local.set({ [TOUR_STATE_KEY]: state }, resolve);
  });
}

function loadTourState() {
  return new Promise(resolve => {
    chrome.storage.local.get([TOUR_STATE_KEY], result => {
      resolve(result[TOUR_STATE_KEY] || defaultState);
    });
  });
}

// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------
export async function initTour(onLanguageChange) {
  onLanguageChangeCallback = onLanguageChange;
  const state = await loadTourState();
  if (state.completed || state.step === -1) return;

  createTourElements();

  if (state.step === 0) {
    await goToStep(1);
  } else {
    await goToStep(state.step);
  }
}

export async function startTour(onLanguageChange) {
  onLanguageChangeCallback = onLanguageChange;
  await saveTourState(defaultState);
  createTourElements();
  await goToStep(1);
}