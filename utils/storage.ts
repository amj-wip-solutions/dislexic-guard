/**
 * LexiLens Storage Utility
 * Manages user settings persistence using browser.storage.local
 */

import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, type LexiLensSettings } from '../types';

const STORAGE_KEY = 'lexilens_settings';

/**
 * Load settings from browser.storage.local
 * Falls back to defaults if no settings exist
 */
export async function loadSettings(): Promise<LexiLensSettings> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY];

    if (stored) {
      // Merge with defaults to handle missing properties from older versions
      return { ...DEFAULT_SETTINGS, ...stored };
    }

    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('[LexiLens] Failed to load settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save settings to browser.storage.local
 */
export async function saveSettings(settings: LexiLensSettings): Promise<void> {
  try {
    await browser.storage.local.set({ [STORAGE_KEY]: settings });
  } catch (error) {
    console.error('[LexiLens] Failed to save settings:', error);
    throw error;
  }
}

/**
 * Update specific settings (partial update)
 */
export async function updateSettings(
  partial: Partial<LexiLensSettings>
): Promise<LexiLensSettings> {
  const current = await loadSettings();
  const updated = { ...current, ...partial };
  await saveSettings(updated);
  return updated;
}

/**
 * Reset settings to defaults
 */
export async function resetSettings(): Promise<LexiLensSettings> {
  await saveSettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

/**
 * Subscribe to settings changes
 * Returns an unsubscribe function
 */
export function onSettingsChange(
  callback: (settings: LexiLensSettings) => void
): () => void {
  const listener = (
    changes: Record<string, browser.Storage.StorageChange>,
    areaName: string
  ) => {
    if (areaName === 'local' && changes[STORAGE_KEY]) {
      const newSettings = {
        ...DEFAULT_SETTINGS,
        ...changes[STORAGE_KEY].newValue,
      };
      callback(newSettings);
    }
  };

  browser.storage.onChanged.addListener(listener);

  return () => {
    browser.storage.onChanged.removeListener(listener);
  };
}

