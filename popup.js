/**
 * Text Extractor Popup Manager
 * Displays extracted text from screenshots using OCR
 */
class TextExtractorPopup {
    constructor() {
        this.textList = document.getElementById('textList');
        this.textCount = document.getElementById('textCount');
        this.emptyState = document.getElementById('emptyState');
        this.clearBtn = document.getElementById('clearBtn');
        
        this.screenshots = [];
        
        this.init();
    }

    /**
     * Initialize the popup
     */
    async init() {
        console.log('Text Extractor Popup initialized');
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load existing screenshots and extract text automatically
        await this.loadScreenshots();
        
        // Listen for new screenshots
        this.listenForUpdates();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.clearBtn.addEventListener('click', () => {
            this.clearAllText();
        });
    }

    /**
     * Load screenshots from storage and extract text
     */
    async loadScreenshots() {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getScreenshots'
            });
            
            if (response && response.screenshots) {
                this.screenshots = response.screenshots;
                
                // Auto-extract text from screenshots that don't have it yet
                for (const screenshot of this.screenshots) {
                    if (!screenshot.extractedText) {
                        await this.extractTextFromScreenshot(screenshot);
                    }
                }
                
                this.updateDisplay();
            }
        } catch (error) {
            console.error('Failed to load screenshots:', error);
        }
    }

    /**
     * Listen for screenshot updates from background script
     */
    listenForUpdates() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'screenshotsUpdated') {
                this.screenshots = request.screenshots || [];
                
                // Auto-extract text from new screenshots
                for (const screenshot of this.screenshots) {
                    if (!screenshot.extractedText) {
                        this.extractTextFromScreenshot(screenshot);
                    }
                }
                
                this.updateDisplay();
            }
        });
    }

    /**
     * Update the display with extracted text
     */
    updateDisplay() {
        // Filter screenshots that have extracted text
        const textsWithContent = this.screenshots.filter(s => s.extractedText && s.extractedText.trim());
        const count = textsWithContent.length;
        
        this.textCount.textContent = count === 0 ? 'No text extracted yet' : 
            count === 1 ? '1 text extracted' : `${count} texts extracted`;
        
        // Show/hide empty state
        if (count === 0) {
            this.emptyState.style.display = 'block';
            this.textList.style.display = 'none';
        } else {
            this.emptyState.style.display = 'none';
            this.textList.style.display = 'block';
            this.renderTexts(textsWithContent);
        }
    }

    /**
     * Render the extracted texts list
     */
    renderTexts(textsWithContent) {
        this.textList.innerHTML = '';
        
        textsWithContent.forEach((screenshot, index) => {
            const textElement = this.createTextElement(screenshot, index);
            this.textList.appendChild(textElement);
        });
    }

    /**
     * Create a text element display
     */
    createTextElement(screenshot, index) {
        const div = document.createElement('div');
        div.className = 'text-item';
        
        // Add success class if text was extracted
        if (screenshot.extractedText && screenshot.extractedText.trim()) {
            div.classList.add('success');
        }
        
        div.innerHTML = `
            <div class="text-header">
                <div class="text-info">
                    <span class="text-number">#${index + 1}</span>
                    <span class="text-timestamp">${screenshot.date}</span>
                    <span class="confidence-badge">${screenshot.confidence || 0}% confidence</span>
                </div>
                <div class="text-actions">
                    <button class="action-btn copy-text-btn" title="Copy text to clipboard" data-id="${screenshot.id}">📋</button>
                    <button class="action-btn save-text-btn" title="Save text as file" data-id="${screenshot.id}">💾</button>
                    <button class="action-btn delete-text-btn" title="Delete text" data-id="${screenshot.id}">🗑️</button>
                </div>
            </div>
            <div class="text-content">
                <div class="extracted-text-display">${this.formatText(screenshot.extractedText)}</div>
                <div class="text-source">From: ${this.truncateUrl(screenshot.url)}</div>
            </div>
        `;
        
        // Add event listeners
        const copyBtn = div.querySelector('.copy-text-btn');
        const saveBtn = div.querySelector('.save-text-btn');
        const deleteBtn = div.querySelector('.delete-text-btn');
        
        copyBtn.addEventListener('click', () => this.copyText(screenshot.extractedText));
        saveBtn.addEventListener('click', () => this.downloadText(screenshot.extractedText, `extracted-text-${screenshot.id}.txt`));
        deleteBtn.addEventListener('click', () => this.deleteText(screenshot.id));
        
        return div;
    }

    /**
     * Format text for display with line breaks
     */
    formatText(text) {
        if (!text || !text.trim()) return 'No text extracted';
        return text.trim();
    }

    /**
     * Truncate long URLs for display
     */
    truncateUrl(url) {
        try {
            const hostname = new URL(url).hostname;
            return hostname.length > 30 ? hostname.substring(0, 30) + '...' : hostname;
        } catch {
            return 'Unknown source';
        }
    }

    /**
     * Copy text to clipboard
     */
    async copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('📋 Text copied to clipboard!');
        } catch (error) {
            console.error('Failed to copy text:', error);
            this.showToast('❌ Failed to copy text');
        }
    }

    /**
     * Download text as file
     */
    downloadText(text, filename) {
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('💾 Text file downloaded!');
    }

    /**
     * Delete text entry
     */
    async deleteText(id) {
        try {
            await chrome.runtime.sendMessage({
                action: 'deleteScreenshot',
                id: id
            });
            
            this.showToast('🗑️ Text deleted');
        } catch (error) {
            console.error('Failed to delete text:', error);
            this.showToast('❌ Failed to delete text');
        }
    }

    /**
     * Clear all extracted text
     */
    async clearAllText() {
        const textsWithContent = this.screenshots.filter(s => s.extractedText && s.extractedText.trim());
        if (textsWithContent.length === 0) return;
        
        if (confirm('Delete all extracted text? This cannot be undone.')) {
            try {
                await chrome.runtime.sendMessage({
                    action: 'clearScreenshots'
                });
                
                this.showToast('🗑️ All text cleared');
            } catch (error) {
                console.error('Failed to clear text:', error);
                this.showToast('❌ Failed to clear text');
            }
        }
    }

    /**
     * Extract text from screenshot using Tesseract.js OCR
     */
    async extractTextFromScreenshot(screenshot) {
        try {
            console.log('Starting OCR for screenshot:', screenshot.id);
            
            // Show loading state
            this.showLoadingState(screenshot.id);
            
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
            const { data: { text, confidence } } = result;
            
            console.log('OCR completed:', { textLength: text.length, confidence });
            
            // Terminate worker
            await worker.terminate();
            
            // Update screenshot with extracted text
            await this.saveExtractedText(screenshot.id, text, confidence);
            
        } catch (error) {
            console.error('OCR Error for screenshot', screenshot.id, ':', error);
            this.hideLoadingState(screenshot.id);
        }
    }

    /**
     * Save extracted text to screenshot data
     */
    async saveExtractedText(id, text, confidence) {
        try {
            await chrome.runtime.sendMessage({
                action: 'updateScreenshotText',
                id: id,
                extractedText: text,
                confidence: Math.round(confidence)
            });
            
            // Update local data
            const screenshot = this.screenshots.find(s => s.id === id);
            if (screenshot) {
                screenshot.extractedText = text;
                screenshot.confidence = Math.round(confidence);
                this.updateDisplay();
            }
        } catch (error) {
            console.error('Failed to save extracted text:', error);
        }
    }

    /**
     * Show loading state for OCR processing
     */
    showLoadingState(id) {
        const textElement = this.getTextElementById(id);
        if (textElement) {
            textElement.classList.add('loading');
            const textDisplay = textElement.querySelector('.extracted-text-display');
            if (textDisplay) {
                textDisplay.textContent = '🔄 Extracting text...';
            }
        }
    }

    /**
     * Hide loading state
     */
    hideLoadingState(id) {
        const textElement = this.getTextElementById(id);
        if (textElement) {
            textElement.classList.remove('loading');
        }
    }

    /**
     * Get text element by screenshot ID
     */
    getTextElementById(id) {
        const allItems = document.querySelectorAll('.text-item');
        for (const item of allItems) {
            const deleteBtn = item.querySelector('.delete-text-btn');
            if (deleteBtn && deleteBtn.dataset.id === id) {
                return item;
            }
        }
        return null;
    }

    /**
     * Show toast notification
     */
    showToast(message) {
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
}

// Initialize the popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Text Extractor Popup starting...');
    new TextExtractorPopup();
});
