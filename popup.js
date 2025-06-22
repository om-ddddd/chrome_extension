const imageInput = document.getElementById('imageInput');
const processBtn = document.getElementById('processBtn');
const resultDiv = document.getElementById('result');
const oemSelect = document.getElementById('oem');
const psmSelect = document.getElementById('psm');

let isProcessing = false;

processBtn.addEventListener('click', async () => {
    const file = imageInput.files[0];
    if (!file) {
        resultDiv.innerHTML = '❌ Please select an image file first.';
        return;
    }

    if (isProcessing) {
        return;
    }

    isProcessing = true;
    processBtn.disabled = true;
    processBtn.textContent = '⏳ Processing...';
    resultDiv.innerHTML = '<div class="processing">🔄 Initializing Tesseract.js...</div>';

    try {
        // Log to background for debugging
        chrome.runtime.sendMessage({
            action: 'log',
            data: 'Starting OCR process'
        });

        // Create worker with offline configuration
        const worker = await Tesseract.createWorker('eng', '3', {
            workerBlobURL: false, //workerBlobURL: false = "Use my local worker file, don't create a blob that tries to access the internet"
            corePath: chrome.runtime.getURL('vendor/core'),
            workerPath: chrome.runtime.getURL('vendor/worker.min.js'),
            langPath: chrome.runtime.getURL('traineddata/'),
            logger: function(m) { //inbuilt tesseract logger
                console.log('Tesseract Logger:', m);
                
                if (m.status) {
                    let statusText = m.status;
                    if (m.progress !== undefined) {
                        const percentage = Math.round(m.progress * 100);
                        statusText += ` (${percentage}%)`;
                    }
                    
                    resultDiv.innerHTML = `<div class="processing">🔄 ${statusText}</div>`;
                }
            }
        });

        console.log('Worker created successfully');

        // Set OCR parameters
        await worker.setParameters({
            tessedit_ocr_engine_mode: oemSelect.value,
            tessedit_pageseg_mode: psmSelect.value,
        });

        console.log('Parameters set successfully');
        resultDiv.innerHTML = '<div class="processing">🔍 Recognizing text...</div>';
        
        // Perform OCR
        const result = await worker.recognize(file);
        const { data: { text, confidence } } = result;
        
        console.log('OCR completed:', { text: text.substring(0, 100), confidence });
        
        // Terminate worker
        await worker.terminate();
        
        // Display results
        if (text && text.trim()) {
            resultDiv.innerHTML = text;
            
            if (confidence !== undefined) {
                const confidenceDiv = document.createElement('div');
                confidenceDiv.className = 'confidence';
                confidenceDiv.textContent = `Confidence: ${Math.round(confidence)}%`;
                resultDiv.appendChild(confidenceDiv);
            }
        } else {
            resultDiv.innerHTML = '❌ No text found in the image. Try adjusting the OCR settings or use a clearer image.';
        }

        chrome.runtime.sendMessage({
            action: 'log',
            data: `OCR completed successfully. Confidence: ${confidence}%`
        });

    } catch (error) {
        console.error('OCR Error:', error);
        
        let errorMessage = 'Unknown error occurred';
        if (error.message) {
            errorMessage = error.message;
        }
        
        resultDiv.innerHTML = `❌ Error processing image: ${errorMessage}<br><br>💡 Tips:<br>• Ensure the image contains clear text<br>• Try a different image format<br>• Check if the image is too large or small`;
        
        chrome.runtime.sendMessage({
            action: 'log',
            data: `OCR failed: ${errorMessage}`
        });
    } finally {
        isProcessing = false;
        processBtn.disabled = false;
        processBtn.textContent = '🚀 Extract Text';
    }
});

// Enable/disable button based on file selection
imageInput.addEventListener('change', () => {
    if (imageInput.files[0]) {
        processBtn.disabled = false;
        resultDiv.innerHTML = '✅ Image selected. Click "Extract Text" to process.';
    } else {
        processBtn.disabled = false;
        resultDiv.innerHTML = 'Select an image and click "Extract Text" to begin...';
    }
});

// Initialize
console.log('Text Extractor OCR Popup loaded');
resultDiv.innerHTML = 'Select an image and click "Extract Text" to begin...';
