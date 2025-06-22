// background.js
// Author: Om Dabhade
// Description: Background service worker for Text Extractor OCR extension
// License: MIT

// Install/Update listener
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Text Extractor OCR Extension installed/updated:', details.reason);
});

// Extension icon click handler (optional - popup handles everything)
chrome.action.onClicked.addListener((tab) => {
  console.log('Extension icon clicked on tab:', tab.url);
});

// Listen for messages from content scripts (if needed)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in background:', request);
  
  if (request.action === 'log') {
    console.log('OCR Log:', request.data);
  }
  
  sendResponse({ success: true });
});

console.log('Text Extractor OCR Background script loaded');
