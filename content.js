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
        console.log('Button clicked');
        this.showNotification('🎯 OCR functionality will be added later!');
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
new DraggableButton();
