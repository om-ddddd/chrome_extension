// background.js
// Author: Om Dabhade
// Description: Background service worker for Text Extractor OCR extension
// License: MIT

// Storage for screenshots
let screenshots = [];
const MAX_SCREENSHOTS = 5;

// Install/Update listener
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Text Extractor OCR Extension installed/updated:', details.reason);
  loadScreenshots();
});

// Extension icon click handler (optional - popup handles everything)
chrome.action.onClicked.addListener((tab) => {
  console.log('Extension icon clicked on tab:', tab.url);
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in background:', request);
  
  if (request.action === 'saveScreenshot') {
    saveScreenshot(request, sendResponse);
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'captureVisibleTab') {
    captureVisibleTab(request, sendResponse);
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'getScreenshots') {
    sendResponse({ screenshots: screenshots });
    return;
  }
  
  if (request.action === 'deleteScreenshot') {
    deleteScreenshot(request.id);
    sendResponse({ success: true });
    return;
  }
  
  if (request.action === 'clearScreenshots') {
    clearScreenshots();
    sendResponse({ success: true });
    return;
  }
  
  if (request.action === 'updateScreenshotText') {
    updateScreenshotText(request.id, request.extractedText, request.confidence);
    sendResponse({ success: true });
    return;
  }
  
  if (request.action === 'log') {
    console.log('OCR Log:', request.data);
  }
  
  sendResponse({ success: true });
});

/**
 * Save screenshot to storage
 */
async function saveScreenshot(request, sendResponse) {
  try {
    console.log('Saving screenshot...');
    
    const screenshotItem = {
      id: Date.now() + Math.random(),
      imageData: request.imageData,
      bounds: request.bounds,
      url: request.url,
      timestamp: request.timestamp,
      date: new Date(request.timestamp).toLocaleString()
    };
    
    // Add to beginning of array
    screenshots.unshift(screenshotItem);
    
    // Keep only MAX_SCREENSHOTS
    if (screenshots.length > MAX_SCREENSHOTS) {
      screenshots = screenshots.slice(0, MAX_SCREENSHOTS);
    }
    
    // Save to storage
    await chrome.storage.local.set({ screenshots: screenshots });
    console.log('Screenshot saved successfully');
    
    // Notify popup to refresh
    notifyPopupUpdated();
    
    sendResponse({
      success: true,
      id: screenshotItem.id,
      timestamp: request.timestamp
    });
    
  } catch (error) {
    console.error('Failed to save screenshot:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Capture visible tab using Chrome API
 */
async function captureVisibleTab(request, sendResponse) {
  try {
    console.log('Capturing visible tab...');
    
    // Capture the visible area of the current tab
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 100
    });
    
    sendResponse({
      success: true,
      dataUrl: dataUrl
    });
    
  } catch (error) {
    console.error('Failed to capture visible tab:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Load screenshots from storage
 */
async function loadScreenshots() {
  try {
    const result = await chrome.storage.local.get(['screenshots']);
    if (result.screenshots) {
      screenshots = result.screenshots;
      console.log('Loaded screenshots from storage:', screenshots.length, 'items');
    }
  } catch (error) {
    console.error('Failed to load screenshots:', error);
  }
}

/**
 * Delete screenshot by ID
 */
async function deleteScreenshot(id) {
  screenshots = screenshots.filter(item => item.id !== id);
  
  try {
    await chrome.storage.local.set({ screenshots: screenshots });
    notifyPopupUpdated();
    console.log('Screenshot deleted');
  } catch (error) {
    console.error('Failed to delete screenshot:', error);
  }
}

/**
 * Clear all screenshots
 */
async function clearScreenshots() {
  screenshots = [];
  
  try {
    await chrome.storage.local.set({ screenshots: screenshots });
    notifyPopupUpdated();
    console.log('Screenshots cleared');
  } catch (error) {
    console.error('Failed to clear screenshots:', error);
  }
}

/**
 * Update screenshot with extracted text
 */
async function updateScreenshotText(id, extractedText, confidence) {
  const screenshot = screenshots.find(item => item.id === id);
  if (screenshot) {
    screenshot.extractedText = extractedText;
    screenshot.confidence = confidence;
    screenshot.ocrTimestamp = Date.now();
    
    try {
      await chrome.storage.local.set({ screenshots: screenshots });
      notifyPopupUpdated();
      console.log('Screenshot text updated:', id);
    } catch (error) {
      console.error('Failed to update screenshot text:', error);
    }
  }
}

/**
 * Notify popup that data was updated
 */
function notifyPopupUpdated() {
  try {
    chrome.runtime.sendMessage({
      action: 'screenshotsUpdated',
      screenshots: screenshots
    }).catch(() => {
      // Popup might not be open, ignore error
    });
  } catch (error) {
    // Popup not open, ignore
  }
}

console.log('Text Extractor OCR Background script loaded');

// Initialize on startup
loadScreenshots();
