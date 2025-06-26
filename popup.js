/**
 * Text Clipboard Popup
 * Simple functional approach for managing extracted text
 */

// Global variables
let textList;
let emptyState;
let clearBtn;
let screenshots = [];
let isUserEditing = false;

/**
 * Initialize the popup when DOM is ready
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Text Clipboard Popup starting...');
    
    // Get DOM elements
    textList = document.getElementById('textList');
    emptyState = document.getElementById('emptyState');
    clearBtn = document.getElementById('clearBtn');
    
    // Setup event listeners
    setupEventListeners();
    
    // Load existing screenshots and extract text automatically
    await loadScreenshots();
    
    // Listen for new screenshots
    listenForUpdates();
});

/**
 * Setup event listeners
 */
function setupEventListeners() {
    clearBtn.addEventListener('click', () => {
        clearAllText();
    });
}

/**
 * Load screenshots from storage and extract text
 */
async function loadScreenshots() {
    try {
        // Load directly from Chrome storage instead of background script
        const result = await chrome.storage.local.get(['screenshots']);
        screenshots = result.screenshots || [];
        
        console.log('Loaded screenshots from Chrome storage:', screenshots.length);
        
        // Auto-extract text from screenshots that don't have it yet
        for (const screenshot of screenshots) {
            if (!screenshot.extractedText) {
                await extractTextFromScreenshot(screenshot);
            }
        }
        
        updateDisplay();
    } catch (error) {
        console.error('Failed to load screenshots:', error);
    }
}

/**
 * Listen for screenshot updates from background script
 */
function listenForUpdates() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'screenshotsUpdated') {
            console.log('Received new screenshots notification from background');
            
            // Reload from Chrome storage to get latest data
            loadScreenshots();
        }
    });
}

/**
 * Save screenshots directly to Chrome storage
 */
async function saveScreenshotsToStorage() {
    try {
        await chrome.storage.local.set({ screenshots: screenshots });
        console.log('Screenshots saved to Chrome storage');
    } catch (error) {
        console.error('Failed to save screenshots to storage:', error);
    }
}

/**
 * Update the display with extracted text
 */
function updateDisplay() {
    // Don't update display if user is currently editing
    if (isUserEditing) {
        return;
    }
    
    // Filter screenshots that have extracted text
    const textsWithContent = screenshots.filter(s => s.extractedText && s.extractedText.trim());
    
    // Show/hide empty state
    if (textsWithContent.length === 0) {
        emptyState.style.display = 'block';
        textList.style.display = 'none';
    } else {
        emptyState.style.display = 'none';
        textList.style.display = 'block';
        
        // Simple render without focus restoration to prevent loops
        renderTexts(textsWithContent);
    }
}

/**
 * Render the extracted texts list
 */
function renderTexts(textsWithContent) {
    textList.innerHTML = '';
    
    textsWithContent.forEach((screenshot, index) => {
        const textElement = createTextElement(screenshot, index);
        textList.appendChild(textElement);
    });
}

/**
 * Create a text element display
 */
function createTextElement(screenshot, index) {
    const div = document.createElement('div');
    div.className = 'text-item';
    
    div.innerHTML = `
        <div class="text-header">
            <div class="text-info">
                <span class="text-number">#${index + 1}</span>
                <span class="text-timestamp">${formatTime(screenshot.timestamp || screenshot.date)}</span>
            </div>
            <div class="text-actions">
                <button class="action-btn copy-btn" title="Copy text" data-id="${screenshot.id}">📋</button>
                <button class="action-btn save-btn" title="Save text" data-id="${screenshot.id}">💾</button>
                <button class="action-btn delete-btn" title="Delete text" data-id="${screenshot.id}">🗑️</button>
            </div>
        </div>
        <div class="text-content">
            <textarea class="text-area" placeholder="Text will appear here..." data-id="${screenshot.id}">${screenshot.extractedText || ''}</textarea>
        </div>
    `;
    
    // Add event listeners
    const copyBtn = div.querySelector('.copy-btn');
    const saveBtn = div.querySelector('.save-btn');
    const deleteBtn = div.querySelector('.delete-btn');
    const textArea = div.querySelector('.text-area');
    
    copyBtn.addEventListener('click', () => copyText(screenshot.extractedText));
    saveBtn.addEventListener('click', () => downloadText(screenshot.extractedText, `text-${screenshot.id}.txt`));
    deleteBtn.addEventListener('click', () => deleteText(screenshot.id));
    
    // Auto-save when text is changed with debouncing
    let saveTimeout;
    textArea.addEventListener('input', (e) => {
        const newText = e.target.value;
        
        // Set editing flag to prevent re-renders
        isUserEditing = true;
        
        // Update local data immediately to prevent re-rendering
        screenshot.extractedText = newText;
        
        // Clear previous timeout
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }
        
        // Debounce the save operation to prevent excessive calls
        saveTimeout = setTimeout(async () => {
            await updateScreenshotTextDirect(screenshot.id, newText);
            isUserEditing = false;
        }, 1000); // Fixed: 1 second instead of 1000000
    });
    
    // Prevent re-renders during focus/interaction
    textArea.addEventListener('focus', () => {
        isUserEditing = true;
    });
    
    // Prevent re-renders during scrolling
    textArea.addEventListener('scroll', () => {
        isUserEditing = true;
        // Reset after a short delay
        setTimeout(() => {
            // Only reset if not actively typing
            if (saveTimeout === undefined) {
                isUserEditing = false;
            }
        }, 200);
    });
    
    // Also save on blur (when user clicks outside)
    textArea.addEventListener('blur', async (e) => {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
            saveTimeout = undefined;
        }
        const newText = e.target.value;
        await updateScreenshotTextDirect(screenshot.id, newText);
        // Delay resetting to prevent immediate re-renders
        setTimeout(() => {
            isUserEditing = false;
        }, 300);
    });
    
    return div;
}

/**
 * Update screenshot text directly in Chrome storage
 */
async function updateScreenshotTextDirect(id, newText) {
    try {
        // Find and update the screenshot in local array
        const screenshot = screenshots.find(s => s.id === id);
        if (screenshot) {
            screenshot.extractedText = newText;
            screenshot.lastEdited = new Date().toISOString();
            
            // Save directly to Chrome storage
            await saveScreenshotsToStorage();
            
            console.log('Text updated and saved for screenshot:', id);
        }
    } catch (error) {
        console.error('Failed to update text:', error);
    }
}

/**
 * Copy text to clipboard
 */
async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('📋 Text copied to clipboard!');
    } catch (error) {
        console.error('Failed to copy text:', error);
        showToast('❌ Failed to copy text');
    }
}

/**
 * Download text as file
 */
function downloadText(text, filename) {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast('💾 Text file downloaded!');
}

/**
 * Delete text entry
 */
async function deleteText(id) {
    try {
        // Remove from local array
        screenshots = screenshots.filter(s => s.id !== id);
        
        // Save to Chrome storage
        await saveScreenshotsToStorage();
        
        // Update display
        updateDisplay();
        
        showToast('🗑️ Text deleted');
    } catch (error) {
        console.error('Failed to delete text:', error);
        showToast('❌ Failed to delete text');
    }
}

/**
 * Clear all extracted text
 */
async function clearAllText() {
    const textsWithContent = screenshots.filter(s => s.extractedText && s.extractedText.trim());
    if (textsWithContent.length === 0) return;
    
    if (confirm('Delete all extracted text? This cannot be undone.')) {
        try {
            // Clear the array
            screenshots = [];
            
            // Save to Chrome storage
            await saveScreenshotsToStorage();
            
            // Update display
            updateDisplay();
            
            showToast('🗑️ All text cleared');
        } catch (error) {
            console.error('Failed to clear text:', error);
            showToast('❌ Failed to clear text');
        }
    }
}

/**
 * Extract text from screenshot using Tesseract.js OCR
 */
async function extractTextFromScreenshot(screenshot) {
    try {
        console.log('Starting OCR for screenshot:', screenshot.id);
        
        // Show loading state
        showLoadingState(screenshot.id);
        
        // Convert base64 to blob for Tesseract
        const response = await fetch(screenshot.imageData);
        const blob = await response.blob();
        
        // Create worker with offline configuration
        const worker = await Tesseract.createWorker('eng', '3', {
            workerBlobURL: false,
            corePath: chrome.runtime.getURL('vendor/core'),
            workerPath: chrome.runtime.getURL('vendor/worker.min.js'),
            langPath: chrome.runtime.getURL('traineddata/'),
            logger: (m) => {
                console.log('Tesseract Logger:', m);
            }
        });

        // Set OCR parameters for better accuracy
        await worker.setParameters({
            tessedit_ocr_engine_mode: '1', // LSTM engine mode
            tessedit_pageseg_mode: '6',    // Uniform block of text
        });

        // Perform OCR
        const result = await worker.recognize(blob);
        const { data: { text } } = result;
        
        console.log('OCR completed:', { textLength: text.length });
        
        // Terminate worker
        await worker.terminate();
        
        // Update screenshot with extracted text
        await saveExtractedText(screenshot.id, text);
        
    } catch (error) {
        console.error('OCR Error for screenshot', screenshot.id, ':', error);
        hideLoadingState(screenshot.id);
    }
}

/**
 * Save extracted text directly to Chrome storage
 */
async function saveExtractedText(id, text) {
    try {
        // Find and update the screenshot
        const screenshot = screenshots.find(s => s.id === id);
        if (screenshot) {
            screenshot.extractedText = text;
            screenshot.extractedAt = new Date().toISOString();
            
            // Save to Chrome storage
            await saveScreenshotsToStorage();
            
            console.log('OCR text saved for screenshot:', id);
            
            // Update display if not editing
            if (!isUserEditing) {
                updateDisplay();
            }
            
            showToast('✅ Text extracted successfully!');
        }
    } catch (error) {
        console.error('Failed to save extracted text:', error);
        showToast('❌ Failed to save extracted text');
    }
}

/**
 * Show loading state for OCR processing
 */
function showLoadingState(id) {
    const textElement = getTextElementById(id);
    if (textElement) {
        textElement.classList.add('loading');
        const textArea = textElement.querySelector('.text-area');
        if (textArea) {
            textArea.value = '🔄 Extracting text...';
            textArea.disabled = true;
        }
    }
}

/**
 * Hide loading state
 */
function hideLoadingState(id) {
    const textElement = getTextElementById(id);
    if (textElement) {
        textElement.classList.remove('loading');
        const textArea = textElement.querySelector('.text-area');
        if (textArea) {
            textArea.disabled = false;
        }
    }
}

/**
 * Get text element by screenshot ID
 */
function getTextElementById(id) {
    const allItems = document.querySelectorAll('.text-item');
    for (const item of allItems) {
        const textArea = item.querySelector('.text-area');
        if (textArea && textArea.dataset.id === id) {
            return item;
        }
    }
    return null;
}

/**
 * Format timestamp for display
 */
function formatTime(timestamp) {
    if (!timestamp) return 'Unknown time';
    
    try {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    } catch (error) {
        return 'Invalid time';
    }
}

/**
 * Show toast notification
 */
function showToast(message) {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    // Create new toast
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}
