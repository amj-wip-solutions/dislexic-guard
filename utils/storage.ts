/**
 * LexiLens Storage Utility
 * Manages user settings persistence using browser.storage.local
 */

import { DEFAULT_SETTINGS, type LexiLensSettings } from '../types';
import { storage } from 'wxt/storage';

const STORAGE_KEY = 'local:lexilens_settings';

// Create a storage item with proper typing
const settingsStorage = storage.defineItem<LexiLensSettings>(STORAGE_KEY, {
  fallback: DEFAULT_SETTINGS,
});

/**
 * Load settings from storage
 * Falls back to defaults if no settings exist
 */
export async function loadSettings(): Promise<LexiLensSettings> {
  try {
    const stored = await settingsStorage.getValue();
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch (error) {
    console.error('[LexiLens] Failed to load settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save settings to storage
 */
export async function saveSettings(settings: LexiLensSettings): Promise<void> {
  try {
    await settingsStorage.setValue(settings);
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
  return settingsStorage.watch((newSettings: LexiLensSettings | null) => {
    if (newSettings) {
      callback({ ...DEFAULT_SETTINGS, ...newSettings });
    }
  });
}

