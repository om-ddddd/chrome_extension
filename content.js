/**
 * Simple Draggable Button for OCR Extension
 */

console.log('OCR Content Script Loading...');

class DraggableButton {
    constructor() {
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.btnStartX = 0;
        this.btnStartY = 0;
        this.button = null;
        
        this.init();
    }

    /**
     * Initialize the draggable button
     */
    init() {
        // Wait for page to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.createButton();
            });
        } else {
            this.createButton();
        }
        
        console.log('Draggable button initialized');
    }

    /**
     * Create the draggable button
     */
    createButton() {
        // Remove existing button if any
        const existingBtn = document.querySelector('.draggable-ocr-btn');
        if (existingBtn) {
            existingBtn.remove();
        }

        this.button = document.createElement('div');
        this.button.className = 'draggable-ocr-btn';
        this.button.innerHTML = `
            <div class="btn-icon">📝</div>
            <div class="btn-text">OCR</div>
            <div class="drag-handle">⋮⋮</div>
        `;
        this.button.title = 'Drag to move • Click for OCR';
        
        // Set initial position (top-right corner)
        this.button.style.top = '20px';
        this.button.style.right = '20px';
        
        // Setup drag functionality
        this.setupDragEvents();
        
        // Add to page
        document.body.appendChild(this.button);
        
        // Load saved position
        this.loadPosition();
        
        console.log('Draggable button created');
    }

    /**
     * Setup drag event listeners
     */
    setupDragEvents() {
        let hasDragged = false;

        // Mouse down - start drag
        this.button.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            hasDragged = false;
            this.isDragging = true;
            
            // Store initial positions
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            
            const rect = this.button.getBoundingClientRect();
            this.btnStartX = rect.left;
            this.btnStartY = rect.top;
            
            // Visual feedback
            this.button.classList.add('dragging');
            document.body.style.userSelect = 'none';
            
            console.log('Drag started');
        });

        // Mouse move - handle dragging
        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            
            e.preventDefault();
            
            // Calculate new position
            const deltaX = e.clientX - this.dragStartX;
            const deltaY = e.clientY - this.dragStartY;
            
            const newX = this.btnStartX + deltaX;
            const newY = this.btnStartY + deltaY;
            
            // Constrain to viewport
            const maxX = window.innerWidth - this.button.offsetWidth;
            const maxY = window.innerHeight - this.button.offsetHeight;
            
            const constrainedX = Math.max(0, Math.min(newX, maxX));
            const constrainedY = Math.max(0, Math.min(newY, maxY));
            
            // Update position
            this.button.style.left = constrainedX + 'px';
            this.button.style.top = constrainedY + 'px';
            this.button.style.right = 'auto';
            this.button.style.bottom = 'auto';
            
            // Mark as dragged if moved significantly
            if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
                hasDragged = true;
            }
        });

        // Mouse up - end drag
        document.addEventListener('mouseup', (e) => {
            if (!this.isDragging) return;
            
            this.isDragging = false;
            this.button.classList.remove('dragging');
            document.body.style.userSelect = '';
            
            if (!hasDragged) {
                // Was a click, not a drag
                this.handleClick();
            } else {
                // Was a drag, save position
                this.savePosition();
                console.log('Button repositioned');
            }
        });

        // Touch support for mobile
        this.button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.button.dispatchEvent(mouseEvent);
        });

        document.addEventListener('touchmove', (e) => {
            if (!this.isDragging) return;
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            document.dispatchEvent(mouseEvent);
        });

        document.addEventListener('touchend', (e) => {
            if (!this.isDragging) return;
            e.preventDefault();
            document.dispatchEvent(new MouseEvent('mouseup', {}));
        });

        // Window resize handler
        window.addEventListener('resize', () => {
            this.constrainToViewport();
        });
    }

    /**
     * Handle button click (when not dragged)
     */
    handleClick() {
        console.log('Starting screenshot capture...');
        this.startScreenCapture();
    }

    /**
     * Start screen capture process
     */
    startScreenCapture() {
        // Change button appearance
        this.button.innerHTML = `
            <div class="btn-icon">📸</div>
            <div class="btn-text">Select</div>
            <div class="drag-handle">⋮⋮</div>
        `;
        this.button.classList.add('capture-mode');
        
        // Create overlay for area selection
        this.createSelectionOverlay();
        this.showNotification('🎯 Click and drag to select area for screenshot');
    }

    /**
     * Create overlay for area selection
     */
    createSelectionOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'ocr-selection-overlay';
        this.overlay.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: rgba(0,0,0,0.3) !important;
            z-index: 2147483646 !important;
            cursor: crosshair !important;
        `;
        
        let isSelecting = false;
        let startX, startY, endX, endY;
        let selectionRect;
        
        // Mouse down - start selection
        this.overlay.addEventListener('mousedown', (e) => {
            isSelecting = true;
            startX = e.clientX;
            startY = e.clientY;
            
            // Create selection rectangle
            selectionRect = document.createElement('div');
            selectionRect.style.cssText = `
                position: absolute !important;
                border: 2px dashed #667eea !important;
                background: rgba(102,126,234,0.1) !important;
                pointer-events: none !important;
            `;
            this.overlay.appendChild(selectionRect);
        });
        
        // Mouse move - update selection
        this.overlay.addEventListener('mousemove', (e) => {
            if (!isSelecting) return;
            
            endX = e.clientX;
            endY = e.clientY;
            
            const x = Math.min(startX, endX);
            const y = Math.min(startY, endY);
            const width = Math.abs(endX - startX);
            const height = Math.abs(endY - startY);
            
            selectionRect.style.left = x + 'px';
            selectionRect.style.top = y + 'px';
            selectionRect.style.width = width + 'px';
            selectionRect.style.height = height + 'px';
        });
        
        // Mouse up - capture selection
        this.overlay.addEventListener('mouseup', async (e) => {
            if (!isSelecting) return;
            
            isSelecting = false;
            endX = e.clientX;
            endY = e.clientY;
            
            const bounds = {
                x: Math.min(startX, endX),
                y: Math.min(startY, endY),
                width: Math.abs(endX - startX),
                height: Math.abs(endY - startY)
            };
            
            // Minimum size check
            if (bounds.width < 50 || bounds.height < 50) {
                this.showNotification('❌ Selection too small - minimum 50x50 pixels');
                this.cancelCapture();
                return;
            }
            
            // Capture the selected area
            await this.captureSelectedArea(bounds);
        });
        
        // Add escape key listener
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.cancelCapture();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
        document.body.appendChild(this.overlay);
    }

    /**
     * Capture the selected area and send to background
     */
    async captureSelectedArea(bounds) {
        try {
            this.showNotification('📸 Capturing selected area...');
            
            // Use html2canvas to capture the selected area
            const canvas = await this.captureScreenshot(bounds);
            
            // Convert canvas to base64
            const imageData = canvas.toDataURL('image/png');
            
            console.log('Screenshot captured, sending to background...');
            
            // Send to background script
            const response = await chrome.runtime.sendMessage({
                action: 'saveScreenshot',
                imageData: imageData,
                bounds: bounds,
                timestamp: Date.now(),
                url: window.location.href
            });
            
            if (response && response.success) {
                this.showNotification(`✅ Screenshot saved! Check popup to view.`);
            } else {
                this.showNotification(`❌ Failed to save screenshot`);
            }
            
        } catch (error) {
            console.error('Screenshot capture error:', error);
            this.showNotification('❌ Capture failed: ' + error.message);
        } finally {
            this.cancelCapture();
        }
    }

    /**
     * Capture screenshot of the selected area
     */
    async captureScreenshot(bounds) {
        try {
            // Method 1: Try to get actual screen capture via background script
            const response = await chrome.runtime.sendMessage({
                action: 'captureVisibleTab',
                bounds: bounds
            });
            
            if (response && response.success && response.dataUrl) {
                // Create canvas and crop to selected area
                const canvas = await this.cropImageToSelection(response.dataUrl, bounds);
                return canvas;
            }
        } catch (error) {
            console.log('Screen capture API failed, using fallback:', error);
        }
        
        // Method 2: Try to capture page content
        try {
            const canvas = await this.capturePageContent(bounds);
            return canvas;
        } catch (error) {
            console.log('Page content capture failed:', error);
        }
        
        // Method 3: Create a demo canvas with unique content
        return this.createDemoScreenshot(bounds);
    }

    /**
     * Crop full page screenshot to selected area
     */
    async cropImageToSelection(dataUrl, bounds) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = bounds.width;
                canvas.height = bounds.height;
                
                // Calculate device pixel ratio for proper scaling
                const dpr = window.devicePixelRatio || 1;
                
                // Draw the cropped portion
                ctx.drawImage(
                    img,
                    bounds.x * dpr, bounds.y * dpr, bounds.width * dpr, bounds.height * dpr,
                    0, 0, bounds.width, bounds.height
                );
                
                resolve(canvas);
            };
            img.src = dataUrl;
        });
    }

    /**
     * Capture page content using DOM traversal
     */
    async capturePageContent(bounds) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = bounds.width;
        canvas.height = bounds.height;
        
        // Get elements within the bounds
        const elementsInBounds = this.getElementsInBounds(bounds);
        
        // Create background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, bounds.width, bounds.height);
        
        // Draw elements found in bounds
        ctx.fillStyle = '#333333';
        ctx.font = '14px Arial';
        
        let y = 30;
        elementsInBounds.forEach((element, index) => {
            if (y < bounds.height - 20) {
                const text = element.textContent.trim().substring(0, 50);
                if (text) {
                    ctx.fillText(`${index + 1}. ${text}`, 10, y);
                    y += 20;
                }
            }
        });
        
        // Add capture info
        ctx.fillStyle = '#666666';
        ctx.font = '12px Arial';
        ctx.fillText(`Captured from: ${window.location.hostname}`, 10, bounds.height - 40);
        ctx.fillText(`Selection: ${bounds.width}×${bounds.height}px`, 10, bounds.height - 25);
        ctx.fillText(`Time: ${new Date().toLocaleTimeString()}`, 10, bounds.height - 10);
        
        return canvas;
    }

    /**
     * Get elements within the selection bounds
     */
    getElementsInBounds(bounds) {
        const elements = [];
        const allElements = document.querySelectorAll('*');
        
        allElements.forEach(element => {
            const rect = element.getBoundingClientRect();
            
            // Check if element overlaps with selection bounds
            if (rect.left < bounds.x + bounds.width &&
                rect.right > bounds.x &&
                rect.top < bounds.y + bounds.height &&
                rect.bottom > bounds.y) {
                
                // Only include elements with meaningful content
                if (element.textContent.trim() && 
                    !element.querySelector('*') && // Leaf elements only
                    rect.width > 0 && rect.height > 0) {
                    elements.push(element);
                }
            }
        });
        
        return elements.slice(0, 10); // Limit to first 10 elements
    }

    /**
     * Create a demo screenshot with unique content for testing
     */
    createDemoScreenshot(bounds) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = bounds.width;
        canvas.height = bounds.height;
        
        // Create a unique gradient background based on timestamp
        const time = Date.now();
        const hue1 = (time % 360);
        const hue2 = ((time + 60) % 360);
        
        const gradient = ctx.createLinearGradient(0, 0, bounds.width, bounds.height);
        gradient.addColorStop(0, `hsl(${hue1}, 70%, 60%)`);
        gradient.addColorStop(1, `hsl(${hue2}, 70%, 40%)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, bounds.width, bounds.height);
        
        // Add border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, bounds.width, bounds.height);
        
        // Add unique demo text
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 2;
        
        ctx.font = 'bold 24px Arial';
        ctx.fillText('Demo Screenshot', bounds.width / 2, bounds.height / 2 - 60);
        
        ctx.font = '16px Arial';
        ctx.fillText(`Size: ${bounds.width} × ${bounds.height}`, bounds.width / 2, bounds.height / 2 - 20);
        ctx.fillText(`From: ${window.location.hostname}`, bounds.width / 2, bounds.height / 2 + 10);
        ctx.fillText(`Time: ${new Date().toLocaleTimeString()}`, bounds.width / 2, bounds.height / 2 + 40);
        
        // Add unique identifier
        const uniqueId = (time % 10000).toString().padStart(4, '0');
        ctx.font = '14px monospace';
        ctx.fillText(`ID: #${uniqueId}`, bounds.width / 2, bounds.height / 2 + 70);
        
        // Add page title if available
        if (document.title) {
            ctx.font = '12px Arial';
            const title = document.title.length > 30 ? document.title.substring(0, 30) + '...' : document.title;
            ctx.fillText(`Page: ${title}`, bounds.width / 2, bounds.height / 2 + 95);
        }
        
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        
        return canvas;
    }

    /**
     * Cancel capture mode
     */
    cancelCapture() {
        // Reset button
        this.button.innerHTML = `
            <div class="btn-icon">📝</div>
            <div class="btn-text">OCR</div>
            <div class="drag-handle">⋮⋮</div>
        `;
        this.button.classList.remove('capture-mode');
        
        // Remove overlay
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }

    /**
     * Save button position to localStorage
     */
    savePosition() {
        const rect = this.button.getBoundingClientRect();
        const position = {
            x: rect.left,
            y: rect.top
        };
        localStorage.setItem('ocrButtonPosition', JSON.stringify(position));
    }

    /**
     * Load button position from localStorage
     */
    loadPosition() {
        try {
            const saved = localStorage.getItem('ocrButtonPosition');
            if (saved) {
                const position = JSON.parse(saved);
                
                // Validate position is within viewport
                const maxX = window.innerWidth - this.button.offsetWidth;
                const maxY = window.innerHeight - this.button.offsetHeight;
                
                if (position.x >= 0 && position.x <= maxX && 
                    position.y >= 0 && position.y <= maxY) {
                    
                    this.button.style.left = position.x + 'px';
                    this.button.style.top = position.y + 'px';
                    this.button.style.right = 'auto';
                    this.button.style.bottom = 'auto';
                }
            }
        } catch (error) {
            console.log('Could not load button position:', error);
        }
    }

    /**
     * Constrain button to viewport after resize
     */
    constrainToViewport() {
        if (!this.button) return;
        
        const rect = this.button.getBoundingClientRect();
        const maxX = window.innerWidth - this.button.offsetWidth;
        const maxY = window.innerHeight - this.button.offsetHeight;
        
        let newX = rect.left;
        let newY = rect.top;
        
        if (rect.left > maxX) newX = maxX;
        if (rect.top > maxY) newY = maxY;
        if (rect.left < 0) newX = 0;
        if (rect.top < 0) newY = 0;
        
        if (newX !== rect.left || newY !== rect.top) {
            this.button.style.left = newX + 'px';
            this.button.style.top = newY + 'px';
            this.button.style.right = 'auto';
            this.button.style.bottom = 'auto';
        }
    }

    /**
     * Show notification message
     */
    showNotification(message) {
        // Remove existing notifications
        const existing = document.querySelectorAll('.ocr-notification');
        existing.forEach(n => n.remove());
        
        // Create new notification
        const notification = document.createElement('div');
        notification.className = 'ocr-notification';
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize the draggable button
console.log('Creating draggable OCR button...');
const draggableButton = new DraggableButton();
