class ColorGuesser {
    constructor() {
        this.canvas = document.getElementById('colorHeatmap');
        this.ctx = this.canvas.getContext('2d');
        this.colorPreview = document.getElementById('colorPreview');
        this.touchIndicator = document.getElementById('touchIndicator');
        this.confirmButton = document.getElementById('confirmPlacement');
        
        this.currentColor = null;
        this.currentHue = 0;
        this.currentSaturation = 0;
        this.guessedHue = 0;
        this.guessedSaturation = 0;
        this.score = 0;
        this.round = 1;
        this.maxRounds = 5;
        this.hasGuessed = false;
        
        // Canvas dimensions and scaling
        this.displayWidth = 0;
        this.displayHeight = 0;
        this.scaleFactor = 1;
        this.canvasRect = null; // Cache for canvas bounds
        
        // Mobile interaction state
        this.isMobile = this.detectMobile();
        this.isDragging = false;
        this.pendingGuess = null;
        
        this.sessionColors = []; // Track presented colors for this session
        this.sessionGuessedColors = []; // Track guessed colors for this session
        
        this.init();
    }
    
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
               ('ontouchstart' in window) || 
               (navigator.maxTouchPoints > 0);
    }
    
    getCanvasRect() {
        // Cache the canvas bounds for better performance
        if (!this.canvasRect) {
            this.canvasRect = this.canvas.getBoundingClientRect();
        }
        return this.canvasRect;
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.drawColorHeatmap();
        this.generateNewColor();
        this.updateDisplay();
    }
    
    setupCanvas() {
        // Make canvas responsive with proper DPI handling
        const container = this.canvas.parentElement;
        const resizeCanvas = () => {
            const rect = container.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            
            // Set display size (CSS pixels) - use full container size since controls are absolute
            this.canvas.style.width = rect.width + 'px';
            this.canvas.style.height = rect.height + 'px';
            
            // Set actual canvas size (scaled for high DPI)
            // Cap at 2x for performance while maintaining quality
            const maxDpr = Math.min(dpr, 2);
            this.canvas.width = rect.width * maxDpr;
            this.canvas.height = rect.height * maxDpr;
            
            // Scale the drawing context to match device pixel ratio
            this.ctx.scale(maxDpr, maxDpr);
            
            // Store display dimensions for calculations
            this.displayWidth = rect.width;
            this.displayHeight = rect.height;
            this.scaleFactor = maxDpr;
            this.canvasRect = null; // Reset cached canvas bounds
            
            this.drawColorHeatmap();
        };
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }
    
    setupEventListeners() {
        // Desktop events
        if (!this.isMobile) {
            this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            this.canvas.addEventListener('mouseleave', () => this.hideColorPreview());
            this.canvas.addEventListener('click', (e) => this.handleClick(e));
        }
        
        // Mobile events
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        
        // Confirm button for mobile
        this.confirmButton.addEventListener('click', () => this.confirmMobileGuess());
        
        // Button events
        document.getElementById('viewLeaderboardBtn').addEventListener('click', () => this.showHighScores());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('continueBtn').addEventListener('click', () => this.continueGame());
        document.getElementById('playAgainBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('viewScoresBtn').addEventListener('click', () => this.showHighScores());
        document.getElementById('closeScoresBtn').addEventListener('click', () => this.hideHighScores());
        const wipeBtn = document.getElementById('wipeScoresBtn');
        if (wipeBtn) {
            wipeBtn.addEventListener('click', () => this.clearHighScores());
        }
        
        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    drawColorHeatmap() {
        const { ctx } = this;
        const width = this.displayWidth;
        const height = this.displayHeight;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Optimize rendering resolution for large canvases
        // Use lower resolution for rendering but scale up for display
        const maxRenderSize = 800; // Maximum render dimensions for performance
        const renderWidth = Math.min(width, maxRenderSize);
        const renderHeight = Math.min(height, maxRenderSize * (height / width));
        
        // Create ImageData for better performance
        const imageData = ctx.createImageData(renderWidth, renderHeight);
        const data = imageData.data;
        
        const hueRange = 360; // Full hue spectrum
        const lightness = 50; // Fixed lightness for consistency
        
        for (let y = 0; y < renderHeight; y++) {
            for (let x = 0; x < renderWidth; x++) {
                // Calculate hue based on x position across full width
                const hue = (x / renderWidth) * hueRange;
                
                // Calculate saturation based on y position (0 at top, 100 at bottom)
                const saturation = (y / renderHeight) * 100;
                
                // Convert HSL to RGB for ImageData
                const rgb = this.hslToRgb(hue, saturation, lightness);
                
                // Set pixel data
                const index = (y * renderWidth + x) * 4;
                data[index] = rgb[0];     // Red
                data[index + 1] = rgb[1]; // Green
                data[index + 2] = rgb[2]; // Blue
                data[index + 3] = 255;    // Alpha
            }
        }
        
        // Create temporary canvas for rendering
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = renderWidth;
        tempCanvas.height = renderHeight;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw the ImageData to temporary canvas
        tempCtx.putImageData(imageData, 0, 0);
        
        // Scale and draw to main canvas
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(tempCanvas, 0, 0, renderWidth, renderHeight, 0, 0, width, height);
    }
    
    // Utility function for HSL to RGB conversion
    hslToRgb(h, s, l) {
        h /= 360;
        s /= 100;
        l /= 100;
        
        const a = s * Math.min(l, 1 - l);
        const f = n => {
            const k = (n + h * 12) % 12;
            return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        };
        
        return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
    }
    
    generateNewColor() {
        // Generate random hue (0-360) and saturation (20-90)
        this.currentHue = Math.floor(Math.random() * 360);
        this.currentSaturation = 20 + Math.random() * 70; // 20-90%
        
        // Create the color with fixed lightness
        const lightness = 50;
        this.currentColor = `hsl(${this.currentHue}, ${this.currentSaturation}%, ${lightness}%)`;
        
        // Track this color for the session
        this.sessionColors.push(this.currentColor);
        
        // Update color display
        document.getElementById('colorDisplay').style.backgroundColor = this.currentColor;
        
        this.hasGuessed = false;
        this.hideMobileElements();
        
        // Clear canvas selection
        this.canvas.blur();
        if (window.getSelection) {
            window.getSelection().removeAllRanges();
        }
    }
    
    getColorAtPosition(x, y) {
        const width = this.displayWidth;
        const height = this.displayHeight;
        
        // Calculate hue based on x position across full width
        const hue = (x / width) * 360;
        
        // Calculate saturation based on y position
        const saturation = (y / height) * 100;
        
        return {
            hue: hue,
            saturation: saturation,
            color: `hsl(${hue}, ${saturation}%, 50%)`
        };
    }
    
    handleMouseMove(event) {
        if (this.hasGuessed || this.isMobile) return;
        
        const rect = this.getCanvasRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Only show preview if cursor is within canvas bounds
        if (x >= 0 && x <= this.displayWidth && y >= 0 && y <= this.displayHeight) {
            // Get color at mouse position
            const colorInfo = this.getColorAtPosition(x, y);
            
            // Update preview
            this.showColorPreview(event.clientX, event.clientY, colorInfo.color);
        } else {
            this.hideColorPreview();
        }
    }
    
    handleClick(event) {
        if (this.hasGuessed || this.isMobile) return;
        
        const rect = this.getCanvasRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Only register click if within canvas bounds
        if (x >= 0 && x <= this.displayWidth && y >= 0 && y <= this.displayHeight) {
            this.makeGuess(x, y);
        }
    }
    
    handleTouchStart(event) {
        if (this.hasGuessed) return;
        
        event.preventDefault();
        const touch = event.touches[0];
        const rect = this.getCanvasRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        this.isDragging = true;
        this.updateMobilePreview(x, y);
    }
    
    handleTouchMove(event) {
        if (this.hasGuessed || !this.isDragging) return;
        
        event.preventDefault();
        const touch = event.touches[0];
        const rect = this.getCanvasRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        this.updateMobilePreview(x, y);
    }
    
    handleTouchEnd(event) {
        if (this.hasGuessed) return;
        
        event.preventDefault();
        this.isDragging = false;
        
        if (this.pendingGuess) {
            this.showConfirmButton();
        }
    }
    
    updateMobilePreview(x, y) {
        // Clamp coordinates to canvas bounds
        const clampedX = Math.max(0, Math.min(x, this.displayWidth));
        const clampedY = Math.max(0, Math.min(y, this.displayHeight));
        
        const colorInfo = this.getColorAtPosition(clampedX, clampedY);
        this.pendingGuess = { x: clampedX, y: clampedY, colorInfo };
        
        // Show touch indicator at the exact touch position
        // Using fixed positioning relative to viewport
        const rect = this.getCanvasRect();
        this.touchIndicator.style.left = (rect.left + clampedX) + 'px';
        this.touchIndicator.style.top = (rect.top + clampedY) + 'px';
        this.touchIndicator.style.backgroundColor = colorInfo.color;
        this.touchIndicator.classList.add('show');
    }
    
    showColorPreview(screenX, screenY, color) {
        // Position the preview slightly above and to the right of cursor to avoid blocking view
        // Using fixed positioning, so coordinates are relative to viewport
        this.colorPreview.style.left = (screenX) + 'px';
        this.colorPreview.style.top = (screenY - 30) + 'px';
        this.colorPreview.style.backgroundColor = color;
        this.colorPreview.classList.add('show');
    }
    
    hideColorPreview() {
        this.colorPreview.classList.remove('show');
    }
    
    showConfirmButton() {
        this.confirmButton.classList.add('show');
    }
    
    hideConfirmButton() {
        this.confirmButton.classList.remove('show');
    }
    
    hideMobileElements() {
        this.touchIndicator.classList.remove('show');
        this.hideConfirmButton();
        this.pendingGuess = null;
    }
    
    confirmMobileGuess() {
        if (this.pendingGuess) {
            this.makeGuess(this.pendingGuess.x, this.pendingGuess.y);
            this.hideMobileElements();
        }
    }
    
    makeGuess(x, y) {
        this.hasGuessed = true;
        const colorInfo = this.getColorAtPosition(x, y);
        
        this.guessedHue = colorInfo.hue;
        this.guessedSaturation = colorInfo.saturation;
        
        // Track guessed color
        this.sessionGuessedColors.push(colorInfo.color);
        
        // Calculate distance in 2D space (hue and saturation)
        let hueDistance = Math.abs(this.guessedHue - this.currentHue);
        hueDistance = Math.min(hueDistance, 360 - hueDistance); // Handle wrap-around
        
        const saturationDistance = Math.abs(this.guessedSaturation - this.currentSaturation);
        
        // Combined distance (weighted)
        const combinedDistance = Math.sqrt(
            Math.pow(hueDistance / 360 * 100, 2) + 
            Math.pow(saturationDistance, 2)
        );
        
        // Calculate score with exponential drop-off
        const maxScore = 1000;
        const score = Math.round(maxScore * Math.pow(Math.E, -combinedDistance / 20));
        
        this.score += score;
        
        // Hide previews
        this.hideColorPreview();
        this.hideMobileElements();
        
        // Clear canvas selection
        this.canvas.blur();
        if (window.getSelection) {
            window.getSelection().removeAllRanges();
        }
        
        // Update display
        this.updateDisplay();
        
        // Show result modal
        this.showResultModal(score, combinedDistance);
    }
    
    getCongratulatoryMessage(score) {
        if (score >= 800) {
            return "Perfect Guess! 🎯";
        } else if (score >= 600) {
            return "Excellent! 🌟";
        } else if (score >= 400) {
            return "Great Job! 👍";
        } else if (score >= 200) {
            return "Good Guess! 😊";
        } else {
            return "Keep Trying! 💪";
        }
    }
    
    showResultModal(score, distance) {
        const message = this.getCongratulatoryMessage(score);
        document.getElementById('resultTitle').textContent = message;
        document.getElementById('resultScore').textContent = `+${score} points`;
        document.getElementById('resultDistance').textContent = `Distance: ${Math.round(distance)}%`;
        document.getElementById('actualPosition').textContent = `H:${Math.round(this.currentHue)}° S:${Math.round(this.currentSaturation)}%`;
        document.getElementById('guessPosition').textContent = `H:${Math.round(this.guessedHue)}° S:${Math.round(this.guessedSaturation)}%`;
        document.getElementById('resultModal').classList.add('show');
    }
    
    hideResultModal() {
        document.getElementById('resultModal').classList.remove('show');
    }
    
    continueGame() {
        this.hideResultModal();
        
        if (this.round >= this.maxRounds) {
            this.endGame();
        } else {
            this.round++;
            this.generateNewColor();
            this.updateDisplay();
        }
    }
    
    endGame() {
        this.saveScore();
        this.showGameOverModal();
    }
    
    showGameOverModal() {
        document.getElementById('finalScore').textContent = this.score;
        
        // Check if it's a high score
        const highScores = this.getHighScores();
        const isHighScore = highScores.length < 10 || this.score > highScores[highScores.length - 1].score;
        
        if (isHighScore) {
            document.getElementById('highScoreDisplay').textContent = 'New High Score! 🎉';
            document.getElementById('highScoreDisplay').style.display = 'block';
        } else {
            document.getElementById('highScoreDisplay').style.display = 'none';
        }
        
        document.getElementById('gameOverModal').classList.add('show');
    }
    
    hideGameOverModal() {
        document.getElementById('gameOverModal').classList.remove('show');
    }
    
    restartGame() {
        this.score = 0;
        this.round = 1;
        this.sessionColors = []; // Reset session colors
        this.sessionGuessedColors = []; // Reset session guessed colors
        this.generateNewColor();
        this.updateDisplay();
        this.hideResultModal();
        this.hideGameOverModal();
        this.hideHighScores();
    }
    
    saveScore() {
        const scores = this.getHighScores();
        const newScore = {
            score: this.score,
            date: new Date().toLocaleDateString(),
            rounds: this.maxRounds,
            presentedColors: this.getSessionColors(),
            guessedColors: this.getSessionGuessedColors()
        };
        
        scores.push(newScore);
        scores.sort((a, b) => b.score - a.score);
        scores.splice(10); // Keep only top 10
        
        localStorage.setItem('colorGuesserScores', JSON.stringify(scores));
    }
    
    getSessionColors() {
        // Return the presented colors from the current session
        return this.sessionColors.slice(0, 5); // Limit to 5 colors
    }
    
    getSessionGuessedColors() {
        // Return the guessed colors from the current session
        return this.sessionGuessedColors.slice(0, 5); // Limit to 5 colors
    }
    
    getHighScores() {
        const scores = localStorage.getItem('colorGuesserScores');
        return scores ? JSON.parse(scores) : [];
    }
    
    clearHighScores() {
        try {
            localStorage.removeItem('colorGuesserScores');
        } catch (e) {
            // Fallback if removeItem fails
            localStorage.setItem('colorGuesserScores', JSON.stringify([]));
        }
        const scoresList = document.getElementById('scoresList');
        if (scoresList) {
            scoresList.innerHTML = '<p style="text-align: center; color: #64748b; margin: 1rem 0;">No scores yet!</p>';
        }
    }
    
    showHighScores() {
        const scores = this.getHighScores();
        const scoresList = document.getElementById('scoresList');
        
        if (scores.length === 0) {
            scoresList.innerHTML = '<p style="text-align: center; color: #64748b;">No scores yet!</p>';
        } else {
            scoresList.innerHTML = scores.map((score, index) => {
                // Safely get presented colors with fallback
                let colors = [];
                try {
                    if (score.presentedColors && Array.isArray(score.presentedColors)) {
                        colors = score.presentedColors.slice(0, 5); // Limit to 5 colors
                    } else if (score.colors && Array.isArray(score.colors)) {
                        // Backward compatibility for old format
                        colors = score.colors.slice(0, 5);
                    }
                } catch (error) {
                    console.warn('Error parsing presented colors for score:', error);
                    colors = [];
                }

                // Generate fallback colors if none exist
                if (colors.length === 0) {
                    colors = ['#e2e8f0', '#e2e8f0', '#e2e8f0', '#e2e8f0', '#e2e8f0'];
                }

                // Pad with fallback colors if less than 5
                while (colors.length < 5) {
                    colors.push('#e2e8f0');
                }

                let guessedColors = [];
                try {
                    if (score.guessedColors && Array.isArray(score.guessedColors)) {
                        guessedColors = score.guessedColors.slice(0, 5); // Limit to 5 colors
                    }
                } catch (error) {
                    console.warn('Error parsing guessed colors for score:', error);
                    guessedColors = [];
                }

                // Generate fallback colors if none exist
                if (guessedColors.length === 0) {
                    guessedColors = ['#e2e8f0', '#e2e8f0', '#e2e8f0', '#e2e8f0', '#e2e8f0'];
                }

                // Pad with fallback colors if less than 5
                while (guessedColors.length < 5) {
                    guessedColors.push('#e2e8f0');
                }
                
                return `
                    <div class="score-entry ${score.score === this.score ? 'current' : ''}">
                        <div class="score-placement">#${index + 1}</div>
                        <div class="score-separator">|</div>
                        <div class="score-details">
                            <div class="score-points">${score.score} points</div>
                            <div class="score-date">${score.date}</div>
                        </div>
                        <div class="colors-container">
                            <div class="score-colors">
                                ${colors.map(color => `
                                    <div class="color-square" style="background-color: ${color}"></div>
                                `).join('')}
                            </div>
                            <div class="score-colors">
                                ${guessedColors.map(color => `
                                    <div class="color-square" style="background-color: ${color}"></div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        document.getElementById('highScoresModal').classList.add('show');
    }
    
    hideHighScores() {
        document.getElementById('highScoresModal').classList.remove('show');
    }
    
    updateDisplay() {
        document.getElementById('scoreValue').textContent = this.score;
        document.getElementById('roundValue').textContent = this.round;
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ColorGuesser();
});

// Handle responsive canvas sizing
window.addEventListener('resize', () => {
    // Redraw heatmap on resize if needed
    const game = window.colorGuesser;
    if (game) {
        game.setupCanvas();
    }
});