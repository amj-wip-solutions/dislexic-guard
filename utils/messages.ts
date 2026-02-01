/**
 * LexiLens Message Bridge
 * Type-safe messaging between content scripts and background worker
 */

import { browser } from 'wxt/browser';
import type { LexiLensMessage, AnalysisResult, LexiLensSettings } from '../types';

/**
 * Send a message to the background script
 * Returns a typed response based on the message type
 */
export async function sendToBackground<T extends LexiLensMessage>(
  message: T
): Promise<unknown> {
  try {
    return await browser.runtime.sendMessage(message);
  } catch (error) {
    console.error('[LexiLens] Message send failed:', error);
    throw error;
  }
}

/**
 * Send text for analysis to the background script
 */
export async function requestAnalysis(
  text: string,
  elementId?: string
): Promise<AnalysisResult> {
  const response = await sendToBackground({
    type: 'ANALYZE_TEXT',
    payload: { text, elementId },
  });
  return response as AnalysisResult;
}

/**
 * Request current settings from background
 */
export async function requestSettings(): Promise<LexiLensSettings> {
  const response = await sendToBackground({ type: 'GET_SETTINGS' });
  return response as LexiLensSettings;
}

/**
 * Notify background that settings have changed
 */
export async function notifySettingsUpdate(
  settings: Partial<LexiLensSettings>
): Promise<void> {
  await sendToBackground({
    type: 'SETTINGS_UPDATED',
    payload: settings,
  });
}

/**
 * Send a message to all content scripts in the active tab
 */
export async function sendToContentScripts(
  message: LexiLensMessage
): Promise<void> {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await browser.tabs.sendMessage(tab.id, message);
    }
  } catch (error) {
    console.error('[LexiLens] Failed to send to content scripts:', error);
  }
}

/**
 * Broadcast settings update to all tabs
 */
export async function broadcastSettingsUpdate(
  settings: Partial<LexiLensSettings>
): Promise<void> {
  const tabs = await browser.tabs.query({});
  const message: LexiLensMessage = {
    type: 'SETTINGS_UPDATED',
    payload: settings,
  };

  for (const tab of tabs) {
    if (tab.id) {
      try {
        await browser.tabs.sendMessage(tab.id, message);
      } catch {
        // Tab might not have content script, ignore
      }
    }
  }
}

/**
 * Listen for messages from content scripts (for use in background)
 */
export function onMessage(
  handler: (
    message: LexiLensMessage,
    sender: browser.Runtime.MessageSender
  ) => Promise<unknown> | void
): void {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const result = handler(message as LexiLensMessage, sender);

    if (result && typeof result === 'object' && 'then' in result) {
      (result as Promise<unknown>).then(sendResponse).catch((error: Error) => {
        console.error('[LexiLens] Message handler error:', error);
        sendResponse({ error: error.message });
      });
      return true; // Keep channel open for async response
    }

    return false;
  });
}

/**
 * Listen for messages from background (for use in content scripts)
 */
export function onContentMessage(
  handler: (message: LexiLensMessage) => void
): () => void {
  const listener = (message: unknown) => {
    handler(message as LexiLensMessage);
  };

  browser.runtime.onMessage.addListener(listener);

  return () => {
    browser.runtime.onMessage.removeListener(listener);
  };
}

