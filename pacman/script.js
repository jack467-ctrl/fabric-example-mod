document.addEventListener('DOMContentLoaded', () => {
    const gameBoard = document.getElementById('game-board');
    const pacman = document.getElementById('pacman');
    const btnUp = document.getElementById('btn-up');
    const btnDown = document.getElementById('btn-down');
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const scoreDisplay = document.getElementById('score-display');

    // Ghost elements
    const ghostElements = {
        blinky: document.getElementById('ghost-blinky'),
        pinky: document.getElementById('ghost-pinky'),
    };

    const boardSize = gameBoard.offsetWidth;
    const pacmanSize = pacman.offsetWidth; // Assuming Pac-Man is square
    const ghostSize = ghostElements.blinky ? ghostElements.blinky.offsetWidth : 28; // Default if not found
    const step = 10; // Pac-Man's move distance
    const ghostStep = 5; // Ghosts' move distance (can be slower/faster)

    let gameRunning = true; // Flag to control game state

    let pacmanX = 10; // Initial X position (must match CSS)
    let pacmanY = 10; // Initial Y position (must match CSS)
    const initialPacmanX = pacmanX; // Store for reset
    const initialPacmanY = pacmanY; // Store for reset
    let score = 0;
    let currentRotation = 0; // 0: right, 90: down, 180: left, 270: up
    let mouthOpen = false;
    let chompInterval = null;

    // Get all dot elements
    const dots = []; // We will populate this more robustly if dots are dynamically generated
    document.querySelectorAll('.dot').forEach(dot => dots.push(dot));

    function updatePacmanVisuals() {
        pacman.style.setProperty('--pacman-rotation', currentRotation + 'deg');
        pacman.style.left = pacmanX + 'px';
        pacman.style.top = pacmanY + 'px';
        if (mouthOpen) {
            pacman.classList.add('mouth-open');
        } else {
            pacman.classList.remove('mouth-open');
        }
        checkDotCollision();
    }

    // Initialize Pac-Man's position and rotation
    updatePacmanVisuals();

    function toggleMouth() {
        mouthOpen = !mouthOpen;
        if (mouthOpen) {
            pacman.classList.add('mouth-open');
        } else {
            pacman.classList.remove('mouth-open');
        }
    }

    function startChomping() {
        if (!chompInterval) {
            chompInterval = setInterval(() => {
                toggleMouth();
            }, 150); // Chomp every 150ms
        }
    }

    function stopChomping() {
        clearInterval(chompInterval);
        chompInterval = null;
        mouthOpen = false; // Ensure mouth is closed when stopped
        pacman.classList.remove('mouth-open');
    }


    function checkDotCollision() {
        const pacmanRect = pacman.getBoundingClientRect();
        dots.forEach((dot, index) => {
            if (dot.style.display !== 'none') { // Check only visible dots
                const dotRect = dot.getBoundingClientRect();
                // Simple collision detection: check if centers are close enough or if rectangles overlap
                // For more accuracy with circular shapes, distance between centers < sum of radii
                // For simplicity, using bounding box overlap.
                if (
                    pacmanRect.left < dotRect.right &&
                    pacmanRect.right > dotRect.left &&
                    pacmanRect.top < dotRect.bottom &&
                    pacmanRect.bottom > dotRect.top
                ) {
                    dot.style.display = 'none'; // Hide the dot
                    // Optionally, remove from 'dots' array or mark as collected
                    score += 10;
                    updateScoreDisplay();
                }
            }
        });
    }

    function movePacman(dx, dy) {
        let moved = false;
        const newX = pacmanX + dx;
        const newY = pacmanY + dy;

        // Update rotation based on movement direction
        if (dx > 0) currentRotation = 0;    // Right
        else if (dx < 0) currentRotation = 180; // Left
        else if (dy > 0) currentRotation = 90;  // Down
        else if (dy < 0) currentRotation = 270; // Up

        // Boundary checks
        if (newX >= 0 && newX <= boardSize - pacmanSize) {
            if (pacmanX !== newX) moved = true;
            pacmanX = newX;
        }
        if (newY >= 0 && newY <= boardSize - pacmanSize) {
            if (pacmanY !== newY) moved = true;
            pacmanY = newY;
        }

        updatePacmanVisuals();

        if (moved) {
            startChomping();
        } else {
            // If move was blocked by boundary, consider stopping chomp or let it continue
            // For now, chomp only starts/continues if actual movement occurs.
            // If no successful move in any direction, could call stopChomping() here,
            // but keyup is a better place for that.
        }
    }

    // Button controls
    // Add mousedown/mouseup or touchstart/touchend for continuous movement later if desired
    btnUp.addEventListener('click', () => { movePacman(0, -step); });
    btnDown.addEventListener('click', () => { movePacman(0, step); });
    btnLeft.addEventListener('click', () => { movePacman(-step, 0); });
    btnRight.addEventListener('click', () => { movePacman(step, 0); });

    // Keyboard controls
    document.addEventListener('keydown', (event) => {
        // Prevent multiple rapid keydowns from messing up chomp interval
        // if (chompInterval && (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        //     // Already moving due to a key being held down, perhaps
        // }

        let dx = 0;
        let dy = 0;
        switch (event.key) {
            case 'ArrowUp':
                event.preventDefault(); dy = -step; break;
            case 'ArrowDown':
                event.preventDefault(); dy = step; break;
            case 'ArrowLeft':
                event.preventDefault(); dx = -step; break;
            case 'ArrowRight':
                event.preventDefault(); dx = step; break;
            default: return; // Exit if not an arrow key
        }
        movePacman(dx, dy);
    });

    // Stop chomping when no key is pressed (simplistic, doesn't handle holding key)
    // A better approach for keydown/keyup movement:
    // - On keydown, set a direction and start an animation loop.
    // - On keyup, clear the direction and stop the loop.
    // - For this step, current click/single keypress movement is fine.
    // - The current chomp will continue until another key is pressed or if we add a specific stop.

    // For button clicks, the chomp will run briefly. For keydown, it might run longer.
    // Let's refine stopChomping. It should be called when movement input stops.
    // This is tricky without a game loop or more complex input handling.
    // For now, the chomp animation will toggle. Let's make it stop after a short delay if no new move.
    let movementStopTimer = null;
    const originalMovePacman = movePacman;
    movePacman = (dx, dy) => {
        originalMovePacman(dx, dy);
        clearTimeout(movementStopTimer);
        if (dx !== 0 || dy !== 0) { // If there was an attempt to move
             startChomping(); // Ensure chomp is active
        }
        movementStopTimer = setTimeout(() => {
            // If no move commands for a short while, stop chomping
            // This is a simple way to handle it.
            // Check if pacman is actually moving, not just key press
             // if (pacmanX === prevX && pacmanY === prevY) stopChomping(); // if no change
            stopChomping();
        }, 200); // Stop chomp if no new move signal for 200ms
    }

    // Ensure boardSize is correctly set after everything is loaded and rendered
    // window.onload is a bit late, DOMContentLoaded might be too early for offsetWidth
    // A small timeout or resize listener could be more robust if issues arise with boardSize.
    // For now, direct offsetWidth should work for gameBoard as its size is set in CSS.
    if (gameBoard.offsetWidth === 0) {
        console.warn("Game board width is 0. Movement might be constrained. Ensure CSS is loaded and board has dimensions.");
    }

    // --- Ghost Logic ---
    const ghosts = [];
    for (const name in ghostElements) {
        if (ghostElements[name]) {
            ghosts.push({
                name: name,
                el: ghostElements[name],
                x: ghostElements[name].offsetLeft,
                y: ghostElements[name].offsetTop,
                dx: 0, // Current direction x
                dy: 0  // Current direction y
            });
        }
    }

    function updateGhostDomPosition(ghost) {
        ghost.el.style.left = ghost.x + 'px';
        ghost.el.style.top = ghost.y + 'px';
    }

    function moveGhost(ghost) {
        if (!gameRunning) return;

        const possibleMoves = [];
        // Try to move in current direction, if any
        if (ghost.dx !== 0 || ghost.dy !== 0) {
             const currentPotentialX = ghost.x + ghost.dx * ghostStep;
             const currentPotentialY = ghost.y + ghost.dy * ghostStep;
             if (currentPotentialX >= 0 && currentPotentialX <= boardSize - ghostSize &&
                 currentPotentialY >= 0 && currentPotentialY <= boardSize - ghostSize) {
                 possibleMoves.push({ dx: ghost.dx, dy: ghost.dy });
             }
        }


        // Define potential random moves (up, down, left, right)
        const directions = [
            { dx: 0, dy: -1 }, // Up
            { dx: 0, dy: 1 },  // Down
            { dx: -1, dy: 0 }, // Left
            { dx: 1, dy: 0 }   // Right
        ];

        // Check valid random moves (don't go out of bounds)
        // Prefer to continue in the same direction if possible, or turn at junctions
        // For true random, pick any valid.
        directions.forEach(dir => {
            // Avoid instantly reversing direction unless no other option (simple check)
            if (dir.dx === -ghost.dx && dir.dy === -ghost.dy && possibleMoves.length > 1) { // if current dir is valid, don't add reverse
                 // Allow reverse if stuck or at start
            } else {
                const newX = ghost.x + dir.dx * ghostStep;
                const newY = ghost.y + dir.dy * ghostStep;
                if (newX >= 0 && newX <= boardSize - ghostSize &&
                    newY >= 0 && newY <= boardSize - ghostSize) {
                    possibleMoves.push(dir);
                }
            }
        });

        if (possibleMoves.length > 0) {
            // Simple strategy: 70% chance to continue in current direction if valid, else pick a random valid one
            let chosenMove;
            const continueCurrentDirection = possibleMoves.find(m => m.dx === ghost.dx && m.dy === ghost.dy);
            if (ghost.dx !== 0 || ghost.dy !== 0) { // If already moving
                if (continueCurrentDirection && Math.random() < 0.7) {
                    chosenMove = continueCurrentDirection;
                } else {
                    // Filter out reverse direction if other options exist
                    const nonReverseMoves = possibleMoves.filter(m => !(m.dx === -ghost.dx && m.dy === -ghost.dy));
                    if (nonReverseMoves.length > 0) {
                        chosenMove = nonReverseMoves[Math.floor(Math.random() * nonReverseMoves.length)];
                    } else { // Must reverse or only one option
                        chosenMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
                    }
                }
            } else { // Not moving, pick any valid random
                 chosenMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
            }


            if (chosenMove) {
                ghost.dx = chosenMove.dx;
                ghost.dy = chosenMove.dy;
                ghost.x += ghost.dx * ghostStep;
                ghost.y += ghost.dy * ghostStep;
                updateGhostDomPosition(ghost);
            }
        }
    }

    function checkPacmanGhostCollision(ghost) {
        if (!gameRunning) return false;

        const pacmanRect = pacman.getBoundingClientRect();
        const ghostRect = ghost.el.getBoundingClientRect();

        if (
            pacmanRect.left < ghostRect.right &&
            pacmanRect.right > ghostRect.left &&
            pacmanRect.top < ghostRect.bottom &&
            pacmanRect.bottom > ghostRect.top
        ) {
            return true; // Collision
        }
        return false;
    }

    function gameOver() {
        if (!gameRunning) return; // Prevent multiple game over triggers
        gameRunning = false;
        stopChomping();
        //clearInterval(ghostMoveInterval); // Stop ghosts from moving further
        alert("Game Over! Pac-Man was caught.");
        // Reset Pac-Man's position (optional, or could reload page/offer restart)
        pacmanX = initialPacmanX;
        pacmanY = initialPacmanY;
        currentRotation = 0;
        updatePacmanVisuals(); // Update Pac-Man to reset position on screen
        // Could also re-enable a "start game" button here
    }

    function updateScoreDisplay() {
        scoreDisplay.textContent = score;
    }

    function resetScore() {
        score = 0;
        updateScoreDisplay();
    }

    // Modify gameOver to reset score
    const originalGameOver = gameOver;
    gameOver = () => {
        originalGameOver();
        // Score is reset as part of full game reset logic potentially,
        // but if we want score to persist until new game, don't reset here.
        // For now, let's assume score resets with game over.
        // resetScore(); // Decided to reset score upon starting a new "session" (page load for now)
                       // or when explicitly starting a new game if that button existed.
                       // On game over, the score achieved should remain visible.
    }

    // Game loop for ghosts and collision checks
    const ghostMoveInterval = setInterval(() => {
        if (!gameRunning) {
            clearInterval(ghostMoveInterval); // Stop this interval if game is over
            return;
        }
        ghosts.forEach(ghost => {
            moveGhost(ghost);
            if (checkPacmanGhostCollision(ghost)) {
                gameOver();
            }
        });
    }, 300); // Ghosts move every 300ms, adjust for speed
});
