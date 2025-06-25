/**
 * Text Clipboard Popup
 * Simple functional approach for managing extracted text
 */

// Global variables
let textList;
let emptyState;
let clearBtn;
let screenshots = [];

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
        const response = await chrome.runtime.sendMessage({
            action: 'getScreenshots'
        });
        
        if (response && response.screenshots) {
            screenshots = response.screenshots;
            
            // Auto-extract text from screenshots that don't have it yet
            for (const screenshot of screenshots) {
                if (!screenshot.extractedText) {
                    await extractTextFromScreenshot(screenshot);
                }
            }
            
            updateDisplay();
        }
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
            screenshots = request.screenshots || [];
            
            // Auto-extract text from new screenshots
            for (const screenshot of screenshots) {
                if (!screenshot.extractedText) {
                    extractTextFromScreenshot(screenshot);
                }
            }
            
            updateDisplay();
        }
    });
}

/**
 * Update the display with extracted text
 */
function updateDisplay() {
    // Filter screenshots that have extracted text
    const textsWithContent = screenshots.filter(s => s.extractedText && s.extractedText.trim());
    
    // Show/hide empty state
    if (textsWithContent.length === 0) {
        emptyState.style.display = 'block';
        textList.style.display = 'none';
    } else {
        emptyState.style.display = 'none';
        textList.style.display = 'block';
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
                <span class="text-timestamp">${screenshot.date}</span>
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
    
    // Auto-save when text is changed
    textArea.addEventListener('input', (e) => {
        const newText = e.target.value;
        updateScreenshotText(screenshot.id, newText);
    });
    
    return div;
}

/**
 * Update screenshot text when user edits it
 */
async function updateScreenshotText(id, newText) {
    try {
        await chrome.runtime.sendMessage({
            action: 'updateScreenshotText',
            id: id,
            extractedText: newText
        });
        
        // Update local data
        const screenshot = screenshots.find(s => s.id === id);
        if (screenshot) {
            screenshot.extractedText = newText;
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
        await chrome.runtime.sendMessage({
            action: 'deleteScreenshot',
            id: id
        });
        
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
            await chrome.runtime.sendMessage({
                action: 'clearScreenshots'
            });
            
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
 * Save extracted text to screenshot data
 */
async function saveExtractedText(id, text) {
    try {
        await chrome.runtime.sendMessage({
            action: 'updateScreenshotText',
            id: id,
            extractedText: text
        });
        
        // Update local data
        const screenshot = screenshots.find(s => s.id === id);
        if (screenshot) {
            screenshot.extractedText = text;
            updateDisplay();
        }
    } catch (error) {
        console.error('Failed to save extracted text:', error);
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
