
let isRotationOn = true; 
document.addEventListener("DOMContentLoaded", function() {
            // Loader element dhundo
            const loader = document.getElementById('gameLoader');
            
            if (loader) {
                // 3 Second ka wait karo
                setTimeout(() => {
                    loader.style.opacity = '0'; // Dheere se gayab karo
                    loader.style.pointerEvents = 'none'; // Click aar-paar hone do
                    
                    // Animation khatam hone par element hata do
                    setTimeout(() => {
                        loader.style.display = 'none';
                    }, 500); 
                }, 3000);
            }
            

        const rotateToggle = document.getElementById('rotateToggle');
    
    if(rotateToggle) {
        rotateToggle.addEventListener('change', (e) => {
            isRotationOn = e.target.checked;
            
            // Agar OFF kiya, to board turant seedha kar do
            if (!isRotationOn) {
                document.querySelector('.board').classList.remove('board-rotated');
            }
        });
    }
});



document.addEventListener('DOMContentLoaded', function() {
    console.log("🎮 TRAP THE KING: 2-PLAYER OFFLINE MODE (Move Limit Added)");

    // ==========================================
    // 1. GAME STATE VARIABLES
    // ==========================================
    const size = 118;
    const cols = ["A","B","C","D","E"];
    const pointsGroup = document.getElementById("points");
    const piecesGroup = document.getElementById("pieces");
    const helperBtn = document.getElementById("helperBtn");
    
    let pawnStacks = {"B2":5,"D2":5,"C3":0,"B4":5,"D4":5};
    let kingPositions = {king1:"C1", king2:"C5"};
    
    let currentTurn = "pawn"; 
    let selectedPawn = null;
    let selectedKing = null;
    let gameState = "PLAYING"; 
    let gameOver = false;
    
    
    // 🔥 NEW: MOVES LIMIT LOGIC
    // Total 50 Rounds (1 Round = Pawn Move + King Move)
    // Hum simple rakhte hain: Total 100 turns (50 Pawn + 50 King)
    let totalMovesLimit = 100; 
    let movesPlayed = 0;

    // History for Undo/Redo
    let undoStack = [];
    let redoStack = [];
    
    // Animation Queue
    let animationQueue = [];
    let isAnimating = false;
    let helperEnabled = false;

    // Sounds
    const WIN_SOUND="music/win.mp3";
    const PAWN_KILL_SOUND="music/pawnKill.mp3";
    const bgMusic = new Audio("music/bgGame.mp3");
    bgMusic.loop = true;  // Loop mein bajega
    bgMusic.volume = 0.5; // Volume 50%
    
    // Sound Control
    let isMuted = false;
    const soundBtn = document.getElementById("soundBtn");

    function updateMusicState() {
        if (isMuted) {
            bgMusic.pause(); // Turant roko
            soundBtn.textContent = "🔇Sound";
            soundBtn.style.opacity = "0.6";
            soundBtn.style.background = "rgba(255, 0, 0, 0.2)";
        } else {
            // Bajao (Catch error agar browser rok de)
            bgMusic.play().catch(e => console.log("Waiting for touch to play music"));
            soundBtn.textContent = "🔊 Sound";
            soundBtn.style.opacity = "1";
            soundBtn.style.background = "";
        }
    }

    if (soundBtn) {
        soundBtn.addEventListener("pointerdown", (e) => {
            // 🔥 IMPORTANT: Ye click ko background tak jane se rokega
            e.stopPropagation(); 
            
            isMuted = !isMuted;
            updateMusicState();
            vibrate(30);
        });
    }

    // 3. Auto-Start Logic (Sirf tab chalega agar Mute nahi hai)
    function tryPlayMusic() {
        // Agar Muted hai to mat bajao
        if (isMuted) return;

        if (bgMusic.paused) {
            bgMusic.play().then(() => {
                // Agar start ho gaya, to listeners hata do taaki baar baar na chale
                document.body.removeEventListener('click', tryPlayMusic);
                document.body.removeEventListener('touchstart', tryPlayMusic);
            }).catch(() => {});
        }
    }

    // Screen touch par music start karo (Browser Policy Fix)
    document.body.addEventListener('click', tryPlayMusic);
    document.body.addEventListener('touchstart', tryPlayMusic);

    // 4. SFX Player (Kill/Win Sounds)
    function playAudio(src) {
        if (isMuted) return; // Agar mute hai to sound mat bajao
        try {
            const a = new Audio(src);
            a.volume = 0.6;
            a.play().catch(e=>{});
        } catch(e){}
    }

    tryPlayMusic();
    // ==========================================
    // 2. CORE HELPER FUNCTIONS
    // ==========================================
    function pointName(col, row) { return `${cols[col]}${row+1}`; }
    function parsePoint(p) { 
        const col = cols.indexOf(p[0]);
        const row = parseInt(p[1])-1;
        return {col: col>=0&&col<5 ? col : -1, row: row>=0&&row<5 ? row : -1}; 
    }
    function pointToCoord(p) { const c = parsePoint(p); return {x: c.col*size, y: c.row*size}; }
    function hasPawn(p) { return pawnStacks[p] && pawnStacks[p] > 0; }
    function isKingAt(p) { return kingPositions.king1 === p || kingPositions.king2 === p; }
    function isOccupied(p) { return hasPawn(p) || isKingAt(p); }

    const VALID_NEIGHBORS = new Set([
        "A1-B2","B2-A1","B2-C3","C3-B2","C3-D4","D4-C3","D4-E5","E5-D4",
        "E1-D2","D2-E1","D2-C3","C3-D2","C3-B4","B4-C3","B4-A5","A5-B4",
        "C1-B2","B2-C1","B2-A3","A3-B2","A3-B4","B4-A3","B4-C5","C5-B4",
        "C1-D2","D2-C1","D2-E3","E3-D2","E3-D4","D4-E3","D4-C5","C5-D4",
        "A1-C3","C3-A1","E1-C3","C3-E1","A5-C3","C3-A5","E5-C3","C3-E5"
    ]);

    function isValidNeighbor(p1, p2) {
        return VALID_NEIGHBORS.has(`${p1}-${p2}`) || VALID_NEIGHBORS.has(`${p2}-${p1}`);
    }

    function isOneStepMove(f, t) {
        const a = parsePoint(f), b = parsePoint(t);
        if (a.col < 0 || a.row < 0 || b.col < 0 || b.row < 0) return false;
        const dr = Math.abs(a.row - b.row);
        const dc = Math.abs(a.col - b.col);
        if ((dr === 0 && dc === 1) || (dc === 0 && dr === 1)) return true;
        if (dr === 1 && dc === 1) return isValidNeighbor(f, t);
        return false;
    }

    function getKingJumpMid(from, to) {
        const a = parsePoint(from), b = parsePoint(to);
        const dr = b.row - a.row;
        const dc = b.col - a.col;
        if (!((Math.abs(dr) === 2 && dc === 0) || (Math.abs(dc) === 2 && dr === 0) || (Math.abs(dr) === 2 && Math.abs(dc) === 2))) return null;
        return pointName(a.col + Math.sign(dc), a.row + Math.sign(dr));
    }

    function isValidKingJump(from, to) {
        const mid = getKingJumpMid(from, to);
        if (!mid) return null;
        return isOneStepMove(from, mid) && isOneStepMove(mid, to) ? mid : null;
    }

    // Move Validation for Highlighter
    function getValidMovesForPiece(point, type) {
        const moves = [];
        for(let r=0; r<5; r++) for(let c=0; c<5; c++) {
            const target = pointName(c,r);
            if (type === 'pawn') {
                if (isOneStepMove(point, target) && !isOccupied(target)) {
                    moves.push(target);
                }
            } else if (type === 'king') {
                if (!isOccupied(target)) {
                    if (isOneStepMove(point, target)) moves.push(target);
                    else {
                        const mid = isValidKingJump(point, target);
                        if (mid && hasPawn(mid)) moves.push(target);
                    }
                }
            }
        }
        return moves;
    }

    function kingHasAnyMove(kingPos) {
        return getValidMovesForPiece(kingPos, 'king').length > 0;
    }

    // ==========================================
    // 3. INTERACTION & INPUT HANDLERS
    // ==========================================
    
    function handleBoardClick(point) {
        if (gameState !== "PLAYING" || isAnimating) return;

        // Logic Router based on WHOSE TURN IT IS
        if (currentTurn === 'pawn') {
            handlePawnTurn(point);
        } else {
            handleKingTurn(point);
        }
    }

    // ♟️ PAWN TURN LOGIC
    function handlePawnTurn(point) {
        if (hasPawn(point)) {
            clearHighlights();
            selectedPawn = point;
            vibrate(30);
            highlightValidMoves(point, 'pawn');
            renderAll();
            return;
        }
        if (selectedPawn && isOneStepMove(selectedPawn, point) && !isOccupied(point)) {
            executeMove(selectedPawn, point, 'pawn');
            return;
        }
        if(selectedPawn) vibrate([50,50]);
    }

function rotateBoard() {
    // 🔥 AGAR TOGGLE OFF HAI TO RUK JAO
    if (!isRotationOn) return; 

    const boardContainer = document.querySelector('.board');
    
    if (currentTurn === 'king') { 
        setTimeout(() => {
            boardContainer.classList.add('board-rotated');
        }, 600);
    } else {
        setTimeout(() => {
            boardContainer.classList.remove('board-rotated');
        }, 600);
    }
}

    // 👑 KING TURN LOGIC

    // 👑 KING TURN LOGIC (FIXED)
    function handleKingTurn(point) {
        // 1. Select King
        if (isKingAt(point)) {
            clearHighlights();
            selectedKing = (kingPositions.king1 === point) ? 'king1' : 'king2';
            vibrate(30);
            highlightValidMoves(point, 'king');
            renderAll();
            return;
        }

        // 2. Move King
        if (selectedKing) {
            const start = kingPositions[selectedKing];

            // Case A: Normal Move (1 Step) - Ye pehle se sahi tha
            if (isOneStepMove(start, point) && !isOccupied(point)) {
                executeMove(start, point, 'king', selectedKing);
                return;
            }

            // Case B: Jump/Kill Move (2 Steps) - 🔥 ERROR WAS HERE
            const mid = isValidKingJump(start, point);
            
            // Fix: Check karo ki beech mein Pawn hai AUR Landing spot (point) KHALI hai
            if (mid && hasPawn(mid) && !isOccupied(point)) {
                executeMove(start, point, 'king', selectedKing, mid);
                return;
            }
        }
        
        // Invalid Move Vibration
        if(selectedKing) vibrate([50,50]);
    }

    async function executeMove(from, to, type, kingName=null, midPoint=null) {
        clearHighlights();
        
        await animateMove(from, to, type, 500);
        saveGameState(); // Save history before updating logic

        if (type === 'pawn') {
            pawnStacks[from]--;
            if (pawnStacks[from] === 0) delete pawnStacks[from];
            pawnStacks[to] = (pawnStacks[to] || 0) + 1;
            selectedPawn = null;
        } else {
            kingPositions[kingName] = to;
            if (midPoint) {
                pawnStacks[midPoint]--;
                if (pawnStacks[midPoint] === 0) delete pawnStacks[midPoint];
                playAudio(PAWN_KILL_SOUND);
                vibrate(100);
            }
            selectedKing = null;
        }

        // 🔥 COUNT MOVES
        movesPlayed++;

        // Switch Turn
        currentTurn = (currentTurn === 'pawn') ? 'king' : 'pawn';
         rotateBoard();
        
        
        renderAll();rotateBoard();
        if (checkWinCondition()) return;
        updateStatusContainer();
       
    }

    // ==========================================
    // 4. RENDERING & ANIMATION
    // ==========================================
    function renderAll() {
        piecesGroup.innerHTML = "";
        
        const circles = pointsGroup.querySelectorAll('circle');
        circles.forEach(c => {
            const point = c.dataset.point;
            c.setAttribute("fill", "rgba(255,255,255,0.01)");
            const isKingPos = selectedKing && kingPositions[selectedKing] === point;
            if (point === selectedPawn || isKingPos) {
                c.setAttribute("fill", "rgba(1, 114, 16, 0.64)"); 
            }
        });

        // Draw Pawns
        for(let p in pawnStacks) {
            if(pawnStacks[p] > 0) {
                const {x, y} = pointToCoord(p);
                const g = document.createElementNS("http://www.w3.org/2000/svg","g");
                g.setAttribute("pointer-events", "none");
                
                const txt = document.createElementNS("http://www.w3.org/2000/svg","text");
                txt.setAttribute("x", x); txt.setAttribute("y", y);
                txt.setAttribute("font-size", "54");
                txt.setAttribute("text-anchor", "middle");
                txt.setAttribute("dominant-baseline", "middle");
                
                if (p === selectedPawn) txt.setAttribute("fill", "#4ade80"); 
                else txt.setAttribute("fill", "#003600");
                
                txt.textContent = "♟️";
                g.appendChild(txt);
                
                if(pawnStacks[p] > 1) {
                    const cnt = document.createElementNS("http://www.w3.org/2000/svg","text");
                    cnt.setAttribute("x", x+20); cnt.setAttribute("y", y-4);
                    cnt.setAttribute("font-size", "20"); cnt.setAttribute("fill", "blue");
                    cnt.setAttribute("font-weight", "bold");
                    cnt.textContent = pawnStacks[p];
                    g.appendChild(cnt);
                }
                piecesGroup.appendChild(g);
            }
        }
        
        // Draw Kings
        Object.entries(kingPositions).forEach(([kName, pos]) => {
            if(pos){
                const {x, y} = pointToCoord(pos);
                const txt = document.createElementNS("http://www.w3.org/2000/svg","text");
                txt.setAttribute("x", x); txt.setAttribute("y", y);
                txt.setAttribute("font-size", "65");
                txt.setAttribute("text-anchor", "middle");
                txt.setAttribute("dominant-baseline", "middle");
                txt.setAttribute("pointer-events", "none");
                txt.setAttribute("fill", "black");
                txt.textContent = "♚";
                piecesGroup.appendChild(txt);
            }
        });
        updateStatusContainer();
    }

    function animateMove(fromP, toP, type, dur) {
        return new Promise(resolve => {
            animationQueue.push({from:fromP, to:toP, type, duration:dur, resolve});
            if(!isAnimating) processAnimQueue();
        });
    }

    async function processAnimQueue() {
        if(isAnimating || animationQueue.length===0) return;
        isAnimating = true;
        const anim = animationQueue.shift();
        
        const f = pointToCoord(anim.from);
        const t = pointToCoord(anim.to);
        
        const el = document.createElementNS("http://www.w3.org/2000/svg","text");
        el.textContent = anim.type==='pawn'?'♟️':'♚';
        el.setAttribute("font-size","50");
        el.setAttribute("dominant-baseline", "middle");
        el.setAttribute("text-anchor", "middle");
        el.setAttribute("class", "standing-piece"); 
        
        const g = document.createElementNS("http://www.w3.org/2000/svg","g");
        g.appendChild(el);
        g.setAttribute("transform", `translate(${f.x},${f.y})`);
        g.style.transition = `transform ${anim.duration}ms cubic-bezier(0.175, 0.885, 0.32, 1.275)`;
        g.classList.add("moving-piece");
        piecesGroup.appendChild(g);
        
        requestAnimationFrame(()=> {
            g.setAttribute("transform", `translate(${t.x},${t.y})`); 
        });
        
        setTimeout(()=>{
            g.remove();
            isAnimating = false;
            anim.resolve();
            processAnimQueue();
        }, anim.duration + 50);
    }

    // ==========================================
    // 5. UTILITIES
    // ==========================================
    function saveGameState() {
        undoStack.push({
            pawnStacks: JSON.parse(JSON.stringify(pawnStacks)),
            kingPositions: {...kingPositions},
            currentTurn, 
            gameState, 
            movesPlayed // 🔥 Yahan moves count save ho raha hai
        });
        redoStack = [];
    }
    function undoMove() {
        if(undoStack.length === 0 || gameState !== "PLAYING") return;
        
        redoStack.push({
            pawnStacks: JSON.parse(JSON.stringify(pawnStacks)),
            kingPositions: {...kingPositions},
            currentTurn, gameState, movesPlayed
        });

        const prev = undoStack.pop();
        if(prev) restoreState(prev);
    }

    function redoMove() {
        if(redoStack.length === 0 || gameState !== "PLAYING") return;

        undoStack.push({
            pawnStacks: JSON.parse(JSON.stringify(pawnStacks)),
            kingPositions: {...kingPositions},
            currentTurn, gameState, movesPlayed
        });

        const nextState = redoStack.pop();
        if(nextState) restoreState(nextState);
    }
function restoreState(s) {
        clearHighlights();
        pawnStacks = JSON.parse(JSON.stringify(s.pawnStacks));
        kingPositions = {...s.kingPositions};
        currentTurn = s.currentTurn;
        gameState = s.gameState;
        
        // 🔥 Restore Moves Count
        movesPlayed = s.movesPlayed || 0; 
        
        selectedPawn=null; selectedKing=null;
        renderAll();
    }

    function checkWinCondition() {
        const total = Object.values(pawnStacks).reduce((a,b)=>a+b,0);
        const k1 = kingHasAnyMove(kingPositions.king1);
        const k2 = kingHasAnyMove(kingPositions.king2);
        
        // 1. King Wins (Low Pawns)
        if (total <= 5) {
            triggerWin("king", "Pawns exhausted. King survives!");
            return true;
        }

        // 🔥 2. NEW: King Wins (Moves Limit Reached)
        // Agar moves limit cross ho gayi (100 moves / 50 rounds)
        if (movesPlayed >= totalMovesLimit) {
            triggerWin("king", "Max Moves Reached! King Survived!");
            return true;
        }

        // 3. Pawn Wins (Kings Blocked)
        if (!k1 && !k2) {
            triggerWin("pawn", "Kings trapped! Excellent strategy.");
            return true;
        }

        return false;
    }
function triggerWin(winner, reason) {
        playAudio(WIN_SOUND);
        gameState = "GAME_OVER";
        updateStatusContainer(); // Final update taaki 'Finished' dikhe
        
        // Thoda delay taaki player board dekh sake
        setTimeout(() => showGameOverBox(winner, reason), 500); 
    }

    // 🔥 WINNER POPUP BOX
    function showGameOverBox(winner, reason) {
        const modal = document.getElementById("gameOverModal");
        if(!modal) { alert(reason); return; } 
        
        const title = document.getElementById("winTitle");
        const msg = document.getElementById("winMessage");
        const icon = document.getElementById("winIcon");
        const card = document.querySelector(".win-card");

        modal.style.display = "flex";

        if (winner === "king") {
            title.textContent = "KING WINS!";
            title.style.color = "#4ade80"; 
            msg.textContent = reason;
            icon.textContent = "👑";
            card.style.boxShadow = "0 0 50px rgba(74, 222, 128, 0.3)";
        } else {
            title.textContent = "PAWN WINS!";
            title.style.color = "#f472b6"; 
            msg.textContent = reason;
            icon.textContent = "♟️";
            card.style.boxShadow = "0 0 50px rgba(244, 114, 182, 0.3)";
        }
        
        vibrate([100, 50, 100]);
    }

    function highlightValidMoves(point, type) {
        if(!helperEnabled) return;
        const moves = getValidMovesForPiece(point, type);
        moves.forEach(m => {
            const circles = pointsGroup.querySelectorAll('circle');
            circles.forEach(c => {
                if(c.dataset.point === m) {
                    c.setAttribute("stroke", "#00ff00");
                    c.setAttribute("stroke-width", "3");
                    c.classList.add("helper-highlight");
                }
            });
        });
    }

    function clearHighlights() {
        pointsGroup.querySelectorAll("circle").forEach(c => {
            c.setAttribute("stroke", "none");
            c.classList.remove("helper-highlight");
        });
    }

    function playAudio(src) {
        if (isMuted) return;
        try {
            const a = new Audio(src);
            a.volume = 0.6;
            a.play().catch(e=>{});
        } catch(e){}
    }
    
    function vibrate(pat) {
        if(navigator.vibrate) navigator.vibrate(pat);
    }
    
    function updateStatusContainer() {
        // 1. Pawn Count Update
        const total = Object.values(pawnStacks).reduce((a,b)=>a+b,0);
        document.getElementById("pawnCount").textContent = total;
        
        // 2. Kings Status Update
        const k1 = kingHasAnyMove(kingPositions.king1);
        const k2 = kingHasAnyMove(kingPositions.king2);
        
        const k1El = document.getElementById("king1Status");
        k1El.textContent = k1 ? "SAFE" : "BLOCKED";
        k1El.className = `status-value ${k1 ? "safe" : "blocked"}`;
        
        const k2El = document.getElementById("king2Status");
        k2El.textContent = k2 ? "SAFE" : "BLOCKED";
        k2El.className = `status-value ${k2 ? "safe" : "blocked"}`;

        // 3. Turn Indicator Update
        const turnEl = document.getElementById("turnIndicator");
        if(turnEl) {
            if (gameState === "GAME_OVER") {
                turnEl.textContent = "🏁 FINISHED";
                turnEl.style.color = "white";
            } else if (currentTurn === 'pawn') {
                turnEl.textContent = "♟️ PAWN";
                turnEl.style.color = "#4ade80";
            } else {
                turnEl.textContent = "👑 KING";
                turnEl.style.color = "#f472b6";
            }
        }
        
        // 🔥 4. NEW: MOVES LEFT UPDATE
        const moveEl = document.getElementById("moveCount");
        if(moveEl) {
            const left = totalMovesLimit - movesPlayed;
            moveEl.textContent = left;
            
            // Color Logic: Jab 20 se kam bachein to Red color ho jaye (Warning)
            if (left <= 20) {
                moveEl.style.color = "#ff4444"; // Red (Danger)
                moveEl.style.animation = "pulse 1s infinite"; // Dhadkega
            } else {
                moveEl.style.color = "cyan"; // Normal
                moveEl.style.animation = "none";
            }
        }
    }
    cols.forEach((c, i) => {
        const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
        t.setAttribute("x", i * size);
        t.setAttribute("y", -35);
        t.setAttribute("font-size", "25");
        t.setAttribute("text-anchor", "middle");
        t.setAttribute("fill", "#333");
        t.setAttribute("font-weight", "bold");
        t.setAttribute("class", "point-label");
        t.style.pointerEvents = "none";
        t.textContent = c;
        pointsGroup.appendChild(t);
    });

    // Row Labels (1-5)
    for(let r=0; r<5; r++){
        const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
        t.setAttribute("x", -35);
        t.setAttribute("y", r * size + 8);
        t.setAttribute("font-size", "25");
        t.setAttribute("text-anchor", "middle");
        t.setAttribute("fill", "#333");
        t.setAttribute("font-weight", "bold");
        t.setAttribute("class", "point-label");
        t.style.pointerEvents = "none";
        t.textContent = r+1;
        pointsGroup.appendChild(t);
    }

    // Circles
    for(let row = 0; row < 5; row++) {
        for(let col = 0; col < 5; col++) {
            const cx = col * size, cy = row * size;
            const point = pointName(col, row);
            const circle = document.createElementNS("http://www.w3.org/2000/svg","circle");
            circle.setAttribute("cx", cx); circle.setAttribute("cy", cy);
            circle.setAttribute("r", "40");
            circle.setAttribute("fill", "rgba(255,255,255,0.01)");
            circle.style.cursor = "pointer";
            circle.dataset.point = point;
            
            circle.addEventListener("pointerdown", (e) => {
                e.preventDefault();
                handleBoardClick(point);
            });
            pointsGroup.appendChild(circle);
        }
    }

    // Buttons
    document.getElementById("undoBtn").addEventListener("pointerdown", undoMove);
    document.getElementById("redoBtn").addEventListener("pointerdown", redoMove);
    
    document.getElementById("resetBtn").addEventListener("pointerdown", () => {
        clearHighlights();
        location.reload();
    });
    
    document.getElementById("helperBtn").addEventListener("pointerdown", function() {
        helperEnabled = !helperEnabled;
        this.textContent = helperEnabled ? "✅ Helper" : "🎯 Helper";
        this.classList.toggle("helper-on");
    });

    // About Modal
    const modal = document.getElementById("aboutModal");
    if(modal) {
        document.getElementById("aboutBtn").addEventListener("pointerdown", () => modal.style.display="flex");
        document.getElementById("closeModal").addEventListener("pointerdown", () => modal.style.display="none");
    }

    renderAll();
});