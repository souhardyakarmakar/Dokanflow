import { toast } from './app.js';
import { demoStateStorageKey } from './data/demo-state.js';

const STORAGE_KEY = 'dokanflow.ui-preferences.v1';
const defaults = {
  theme: 'light',
  compact: false,
  reduceMotion: false,
  notifications: true,
};

function readPreferences() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { ...defaults };
    const parsed = JSON.parse(saved);
    return {
      ...defaults,
      ...parsed,
      theme: ['light', 'dark', 'system'].includes(parsed.theme) ? parsed.theme : defaults.theme,
    };
  } catch (error) {
    console.error('Unable to load DokanFlow appearance preferences.', error);
    toast({ title: 'Using default preferences', message: 'Saved appearance settings could not be read.', variant: 'error' });
    return { ...defaults };
  }
}

function applyPreferences(preferences) {
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = preferences.theme === 'system'
    ? (systemDark ? 'dark' : 'light')
    : preferences.theme;
  document.body.dataset.density = preferences.compact ? 'compact' : 'comfortable';
  document.body.classList.toggle('motion-reduced', preferences.reduceMotion);
  const badge = document.querySelector('.badge-dot');
  if (badge) badge.hidden = !preferences.notifications;

  try {
    const savedDemo = sessionStorage.getItem(demoStateStorageKey());
    if (!savedDemo) return;
    const state = JSON.parse(savedDemo);
    const business = state.business;
    if (business && typeof business === 'object') {
      const name = (document.body.dataset.userName || business.owner || '').trim();
      const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
      document.querySelectorAll('[data-profile-name]').forEach((el) => { el.textContent = name; });
      document.querySelectorAll('[data-profile-avatar]').forEach((el) => { el.textContent = initials; });
      document.querySelectorAll('[data-business-label]').forEach((el) => { el.textContent = business.name || 'DokanFlow Demo Studio'; });
    }
  } catch (error) {
    console.error('Unable to apply saved DokanFlow profile details.', error);
    toast({ title: 'Some header details could not load', message: 'Reload after restoring the saved demo data.', variant: 'error' });
  }
}

function savePreferences(preferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    applyPreferences(preferences);
  } catch (error) {
    console.error('Unable to save DokanFlow appearance preferences.', error);
    toast({ title: 'Preference not saved', message: 'Browser storage is unavailable; this preference will not persist.', variant: 'error' });
  }
}

let preferences = readPreferences();
applyPreferences(preferences);

window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
  if (preferences.theme === 'system') applyPreferences(preferences);
});

window.addEventListener('dokanflow:profile-updated', () => applyPreferences(preferences));

document.addEventListener('change', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) return;
  if (!input.matches('#theme-choice, #compact-choice, #motion-choice, #notifications-choice')) return;

  if (input.id === 'theme-choice') preferences.theme = input.value;
  else if (input.id === 'compact-choice') preferences.compact = input.checked;
  else if (input.id === 'motion-choice') preferences.reduceMotion = input.checked;
  else if (input.id === 'notifications-choice') preferences.notifications = input.checked;
  savePreferences(preferences);
});

window.addEventListener('DOMContentLoaded', () => {
  const theme = document.getElementById('theme-choice');
  const compact = document.getElementById('compact-choice');
  const motion = document.getElementById('motion-choice');
  const notifications = document.getElementById('notifications-choice');
  if (theme) theme.value = preferences.theme;
  if (compact) compact.checked = preferences.compact;
  if (motion) motion.checked = preferences.reduceMotion;
  if (notifications) notifications.checked = preferences.notifications;
});
