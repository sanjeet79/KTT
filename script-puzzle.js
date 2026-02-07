document.addEventListener('DOMContentLoaded', function() {
    console.log("🧩 TRAP THE KING: PUZZLE MODE (Hybrid AI)");

    // ==========================================
    // 1. DATA LOADING
    // ==========================================
    const urlParams = new URLSearchParams(window.location.search);
    const currentLevel = urlParams.get('level') || "Beginners"; 
    const userRole = urlParams.get('role') || "pawn";

    let levelData = null;
    try {
        if (window.PUZZLE_LEVELS && window.PUZZLE_LEVELS[currentLevel]) {
            levelData = window.PUZZLE_LEVELS[currentLevel];
        } else {
            console.warn(`Level '${currentLevel}' not found. Loading Default.`);
            levelData = {
                pawnStacks: { "C3": 5, "B2": 5 },
                kingPositions: { king1: "A1", king2: "E5" },
                movesLimit: 50,
                solution: [{ from: "C3", to: "B2" }]
            };
        }
    } catch (e) { console.error(e); }

    // ==========================================
    // 2. STATE VARIABLES
    // ==========================================
    const size = 118;
    const cols = ["A","B","C","D","E"];
    const pointsGroup = document.getElementById("points");
    const piecesGroup = document.getElementById("pieces");
    
    let pawnStacks = {};
    let kingPositions = {};
    let totalMovesLimit = 50;
    let scriptedMoves = {}; // Store Scripted Logic

    if (levelData) {
        pawnStacks = JSON.parse(JSON.stringify(levelData.pawnStacks));
        kingPositions = {...levelData.kingPositions};
        totalMovesLimit = levelData.movesLimit || 50;
        scriptedMoves = levelData.scriptedMoves || {};
    }

    let movesPlayed = 0;
    let currentTurn = userRole; 
    let selectedPawn = null;
    let selectedKing = null;
    let gameState = "PLAYING"; 
    let lastPlayerMoveString = ""; // Store last move for mapping

    let isProcessing = false; 
    let isAnimating = false;
    let helperEnabled = false;
    let undoStack = [];
    let redoStack = [];
    // Global variables ke paas
    let playerMoveHistory = []; // Player ke saare moves yahan save honge

    // UI Setup
    const turnEl = document.getElementById("turnIndicator");
    if(turnEl) {
        const statusContainer = document.getElementById("statusContainer");
        if(statusContainer && !statusContainer.querySelector('.level-display')) {
            const levelLabel = document.createElement("div");
            levelLabel.className = "status-row level-display";
            levelLabel.style.borderBottom = "1px solid rgba(255,255,255,0.1)";
            levelLabel.style.paddingBottom = "5px";
            levelLabel.innerHTML = `<span class="status-label">Puzzle:</span> <span class="status-value" style="color:#fbbf24">${currentLevel}</span>`;
            statusContainer.insertBefore(levelLabel, statusContainer.firstChild);
        }
    }

    // Sound
    const WIN_SOUND="music/win.mp3";
    const PAWN_KILL_SOUND="music/pawnKill.mp3";
    const bgMusic = new Audio("music/bgGame.mp3");
    bgMusic.loop = true; bgMusic.volume = 0.5;
    let isMuted = false;
    const soundBtn = document.getElementById("soundBtn");
    function playAudio(src) { if (!isMuted) try { const a = new Audio(src); a.volume=0.6; a.play().catch(()=>{}); } catch(e){} }
    if (soundBtn) {
        soundBtn.addEventListener("pointerdown", (e) => {
            e.stopPropagation(); isMuted = !isMuted;
            soundBtn.textContent = isMuted ? "🔇Sound" : "🔊 Sound";
            soundBtn.style.opacity = isMuted ? "0.6" : "1";
            if(isMuted) bgMusic.pause(); else bgMusic.play().catch(()=>{});
        });
    }
    document.body.addEventListener('click', function tryMus(){ if(!isMuted && bgMusic.paused) bgMusic.play().catch(()=>{}); document.body.removeEventListener('click', tryMus); });

    // ==========================================
    // 3. LOGIC & VALIDATION
    // ==========================================
    function pointName(col, row) { return `${cols[col]}${row+1}`; }
    function parsePoint(p) { 
        if(!p) return {col:-1, row:-1};
        const col = cols.indexOf(p[0]); const row = parseInt(p[1])-1;
        return {col: col>=0&&col<5 ? col : -1, row: row>=0&&row<5 ? row : -1}; 
    }
    function pointToCoord(p) { const c = parsePoint(p); return {x: c.col*size, y: c.row*size}; }
    function hasPawn(p) { return (pawnStacks[p] || 0) > 0; }
    function isKingAt(p) { return kingPositions.king1 === p || kingPositions.king2 === p; }
    function isOccupied(p) { return hasPawn(p) || isKingAt(p); }

    const VALID_NEIGHBORS = new Set([
        "A1-B2","B2-A1","B2-C3","C3-B2","C3-D4","D4-C3","D4-E5","E5-D4",
        "E1-D2","D2-E1","D2-C3","C3-D2","C3-B4","B4-C3","B4-A5","A5-B4",
        "C1-B2","B2-C1","B2-A3","A3-B2","A3-B4","B4-A3","B4-C5","C5-B4",
        "C1-D2","D2-C1","D2-E3","E3-D2","E3-D4","D4-E3","D4-C5","C5-D4",
        "A1-C3","C3-A1","E1-C3","C3-E1","A5-C3","C3-A5","E5-C3","C3-E5"
    ]);

    function isOneStepMove(f, t) {
        const a = parsePoint(f), b = parsePoint(t);
        if (a.col<0||a.row<0||b.col<0||b.row<0) return false;
        const dr = Math.abs(a.row - b.row), dc = Math.abs(a.col - b.col);
        if ((dr===0 && dc===1) || (dc===0 && dr===1)) return true;
        if (dr===1 && dc===1) return VALID_NEIGHBORS.has(`${f}-${t}`) || VALID_NEIGHBORS.has(`${t}-${f}`);
        return false;
    }

    function isValidKingJump(from, to) {
        const mid = getKingJumpMid(from, to);
        if (!mid) return null;
        return (isOneStepMove(from, mid) && isOneStepMove(mid, to)) ? mid : null;
    }
    
    function getKingJumpMid(from, to) {
        const a = parsePoint(from), b = parsePoint(to);
        const dr = b.row - a.row, dc = b.col - a.col;
        if (!((Math.abs(dr)===2 && dc===0) || (Math.abs(dc)===2 && dr===0) || (Math.abs(dr)===2 && Math.abs(dc)===2))) return null;
        return pointName(a.col + Math.sign(dc), a.row + Math.sign(dr));
    }

    // ==========================================
    // 4. PLAYER INTERACTION
    // ==========================================
    function handleBoardClick(point) {
        // Prevent click if Computer is thinking or Animation running
        if (gameState !== "PLAYING" || isAnimating || isProcessing) return;
        
        // Puzzle Mode: Player is strictly PAWN (unless configured otherwise)
        if (currentTurn !== 'pawn') return; 

        handlePawnTurn(point);
    }

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
            // Save move string for script check (e.g., "B2-C3")
            lastPlayerMoveString = `${selectedPawn}-${point}`;
            isProcessing = true; // Lock
            executeMove(selectedPawn, point, 'pawn');
        } else if(selectedPawn) {
            vibrate(50);
        }
    }

    async function executeMove(from, to, type, kingName=null, midPoint=null) {
        clearHighlights();
        saveGameState();
        if (type === 'pawn') {
            playerMoveHistory.push({ from: from, to: to });
        }
        await animateMove(from, to, type, 400);

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

        movesPlayed++;
        renderAll();
        
        if (checkWinCondition()) {
            isProcessing = false;
            return;
        }

        // Switch Turn
        currentTurn = (currentTurn === 'pawn') ? 'king' : 'pawn';
        updateStatusContainer();

        // 🔥 TRIGGER COMPUTER TURN
        if (currentTurn === 'king' && gameState === "PLAYING") {
            setTimeout(playComputerTurn, 600); // Small delay for realism
        } else {
            isProcessing = false; // Unlock for player
        }
    }

    // ==========================================
    // 5. HYBRID AI LOGIC (SCRIPTED + FALLBACK)
    // ==========================================
    function playComputerTurn() {
        // 1. Check Scripted Response (Map: "B2-C3" -> "A1-A2")
        const scriptedResp = scriptedMoves[lastPlayerMoveString];
        
        if (scriptedResp) {
            const [sFrom, sTo] = scriptedResp.split('-');
            const kName = (kingPositions.king1 === sFrom) ? 'king1' : (kingPositions.king2 === sFrom ? 'king2' : null);

            if (kName) {
                // 🔥 VALIDATION: Kya ye scripted move abhi possible hai?
                if (isLegalKingMove(sFrom, sTo)) {
                    console.log(`Executing Scripted Move: ${sFrom} -> ${sTo}`);
                    executeMove(sFrom, sTo, 'king', kName);
                    return;
                } else {
                    console.warn(`Scripted move ${sFrom}-${sTo} blocked! Fallback to AI.`);
                }
            }
        }

        // 2. Fallback AI (Agar script fail ho ya na ho)
        // Logic: Try Jump > Random Valid Move
        console.log("AI Thinking...");
        const moves1 = getAllKingMoves(kingPositions.king1);
        const moves2 = getAllKingMoves(kingPositions.king2);
        
        let bestMove = null;
        let selectedK = null;

        // Try to find a Kill (Jump)
        const kill1 = moves1.find(m => m.isJump);
        const kill2 = moves2.find(m => m.isJump);

        if (kill1) { bestMove = kill1; selectedK = 'king1'; }
        else if (kill2) { bestMove = kill2; selectedK = 'king2'; }
        else {
            // No kill, pick random
            const allMoves = [];
            moves1.forEach(m => allMoves.push({...m, k:'king1'}));
            moves2.forEach(m => allMoves.push({...m, k:'king2'}));
            
            if (allMoves.length > 0) {
                const rnd = allMoves[Math.floor(Math.random() * allMoves.length)];
                bestMove = rnd;
                selectedK = rnd.k;
            }
        }

        if (bestMove) {
            executeMove(bestMove.from, bestMove.to, 'king', selectedK, bestMove.mid);
        } else {
            // No moves available (Kings trapped)
            checkWinCondition();
            isProcessing = false;
        }
    }

    // AI Helper: Check if a specific move is valid rules-wise
    function isLegalKingMove(from, to) {
        if (isOccupied(to)) return false;
        if (isOneStepMove(from, to)) return true;
        // Check Jump
        const mid = isValidKingJump(from, to);
        return (mid && hasPawn(mid));
    }

    // AI Helper: Get all valid moves for a king
    function getAllKingMoves(pos) {
        if (!pos) return [];
        const valid = [];
        for(let r=0; r<5; r++) for(let c=0; c<5; c++) {
            const t = pointName(c,r);
            if (!isOccupied(t)) {
                if (isOneStepMove(pos, t)) {
                    valid.push({from: pos, to: t, isJump: false});
                } else {
                    const mid = isValidKingJump(pos, t);
                    if (mid && hasPawn(mid)) {
                        valid.push({from: pos, to: t, mid: mid, isJump: true});
                    }
                }
            }
        }
        return valid;
    }

    // ==========================================
    // 6. ANIMATION
    // ==========================================
    function animateMove(fromP, toP, type, dur) {
        isAnimating = true;
        return new Promise(resolve => {
            const f = pointToCoord(fromP); const t = pointToCoord(toP);
            const el = document.createElementNS("http://www.w3.org/2000/svg","text");
            el.textContent = type==='pawn'?'♟️':'♚';
            el.setAttribute("font-size","50"); el.setAttribute("class", "moving-piece");
            el.setAttribute("dominant-baseline", "middle"); el.setAttribute("text-anchor", "middle");
            const g = document.createElementNS("http://www.w3.org/2000/svg","g");
            g.appendChild(el); g.setAttribute("transform", `translate(${f.x},${f.y})`);
            g.style.transition = `transform ${dur}ms cubic-bezier(0.175, 0.885, 0.32, 1.275)`;
            piecesGroup.appendChild(g);
            requestAnimationFrame(()=> { g.setAttribute("transform", `translate(${t.x},${t.y})`); });
            setTimeout(()=>{ g.remove(); isAnimating = false; resolve(); }, dur + 50);
        });
    }

    // ==========================================
    // 7. WIN/LOSS & STATUS
    // ==========================================
    function checkWinCondition() {
        const total = Object.values(pawnStacks).reduce((a,b)=>a+b,0);
        const k1 = getAllKingMoves(kingPositions.king1).length > 0;
        const k2 = getAllKingMoves(kingPositions.king2).length > 0;
        
        if (total <= 5) { triggerWin("king", "Pawns exhausted. King survives!"); return true; }
        if (movesPlayed >= totalMovesLimit) { triggerWin("king", "Moves Limit Reached!"); return true; }
        if (!k1 && !k2) { triggerWin("pawn", "Kings trapped! Puzzle Solved."); return true; }
        return false;
    }

    function triggerWin(winner, reason) {
        playAudio(WIN_SOUND);
        gameState = "GAME_OVER";
        updateStatusContainer();
        setTimeout(() => {
            const modal = document.getElementById("gameOverModal");
            if(modal) { 
                document.getElementById("winTitle").textContent = winner === "king" ? "KING WINS!" : "PAWN WINS!";
                document.getElementById("winMessage").textContent = reason;
                modal.style.display = "flex";
                vibrate([100, 50, 100]);
            } else alert(reason);
        }, 500);
    }

    function updateStatusContainer() {
        const total = Object.values(pawnStacks).reduce((a,b)=>a+b,0);
        document.getElementById("pawnCount").textContent = total;
        
        const k1 = getAllKingMoves(kingPositions.king1).length > 0;
        const k2 = getAllKingMoves(kingPositions.king2).length > 0;
        
        const k1El = document.getElementById("king1Status");
        if(k1El) { k1El.textContent = k1 ? "SAFE" : "BLOCKED"; k1El.className = `status-value ${k1 ? "safe" : "blocked"}`; }
        const k2El = document.getElementById("king2Status");
        if(k2El) { k2El.textContent = k2 ? "SAFE" : "BLOCKED"; k2El.className = `status-value ${k2 ? "safe" : "blocked"}`; }

        const turnEl = document.getElementById("turnIndicator");
        if(turnEl) {
            if (gameState === "GAME_OVER") { turnEl.textContent = "🏁 FINISHED"; turnEl.style.color = "white"; } 
            else {
                turnEl.textContent = currentTurn === 'pawn' ? "♟️ PAWN" : "👑 KING";
                turnEl.style.color = currentTurn === 'pawn' ? "#4ade80" : "#f472b6";
            }
        }
        
        const moveEl = document.getElementById("moveCount");
        if(moveEl) {
            const left = totalMovesLimit - movesPlayed;
            moveEl.textContent = left;
            moveEl.style.color = left <= 5 ? "#ff4444" : "cyan";
        }
    }

    // ==========================================
    // 8. HINT & UTILS
    // ==========================================

    // ==========================================
    // 🔥 STRICT HINT LOGIC (History Check)
    // ==========================================
    const hBtn = document.getElementById("helperBtn");
    
    if (hBtn) {
        hBtn.addEventListener("pointerdown", function() {
            if (!levelData || !levelData.solution) { showMsg("No Hint!"); return; }
            
            // 1. Solution Data nikalo (Array support)
            let solutionList = Array.isArray(levelData.solution) ? levelData.solution : [levelData.solution];
            
            // 2. 🔥 HISTORY CHECK: Kya pichle saare moves sahi the?
            for (let i = 0; i < playerMoveHistory.length; i++) {
                const playedMove = playerMoveHistory[i];
                const correctMove = solutionList[i];

                // Agar Player ka move Solution se match nahi karta
                if (!correctMove || playedMove.from !== correctMove.from || playedMove.to !== correctMove.to) {
                    showMsg("❌ Wrong Path", "#ff4444"); // Short & Clear Message
                    vibrate([50, 50, 50]);
                    return; // Aage ka hint mat dikhao
                }
            }

            // 3. Agar History sahi hai, to Abhi ka Hint dikhao
            // Current Move Index = movesPlayed / 2 (Kyunki King ke moves bhi count hote hain)
            const currentStep = Math.floor(movesPlayed / 2);
            const sol = solutionList[currentStep];

            if (!sol) { showMsg("❓ No more hints"); return; }

            // 4. Piece Validation (Safety Check)
            if (pawnStacks[sol.from] === undefined || pawnStacks[sol.from] <= 0) {
                 // Ye tab hoga agar history sahi ho par board state gadbad ho (Rare case)
                 showMsg("🚫 OFF TRACK", "#ff4444"); 
                 return;
            }
            
            // 5. Highlight
            clearHighlights();
            const fromC = pointsGroup.querySelector(`circle[data-point="${sol.from}"]`);
            if(fromC) { fromC.setAttribute("stroke","#FFD700"); fromC.setAttribute("stroke-width","5"); fromC.classList.add("helper-on"); }
            const toC = pointsGroup.querySelector(`circle[data-point="${sol.to}"]`);
            if(toC) { toC.setAttribute("stroke","#d946ef"); toC.setAttribute("stroke-width","5"); toC.classList.add("helper-on"); }
            
            this.textContent = "💡 Showing...";
            setTimeout(() => this.textContent = "🎯 Hint", 2000);
        });
    }
    function showMsg(msg, color="white") {
        const t = document.getElementById("turnIndicator");
        if(t) {
            const oldT = t.textContent; const oldC = t.style.color;
            t.textContent = msg; t.style.color = color;
            setTimeout(()=>{ if(gameState!=="GAME_OVER"){ t.textContent=oldT; t.style.color=oldC; } }, 2000);
        }
    }

    function renderAll() {
        if(!piecesGroup) return; piecesGroup.innerHTML = "";
        const circles = pointsGroup.querySelectorAll('circle');
        circles.forEach(c => {
            const point = c.dataset.point;
            c.setAttribute("fill", "rgba(255,255,255,0.01)");
            const isKingPos = selectedKing && kingPositions[selectedKing] === point;
            if (point === selectedPawn || isKingPos) c.setAttribute("fill", "rgba(1, 114, 16, 0.64)");
        });

        for(let p in pawnStacks) {
            if(pawnStacks[p] > 0) {
                const {x, y} = pointToCoord(p);
                const g = document.createElementNS("http://www.w3.org/2000/svg","g");
                g.setAttribute("pointer-events", "none");
                const txt = document.createElementNS("http://www.w3.org/2000/svg","text");
                txt.setAttribute("x", x); txt.setAttribute("y", y); txt.setAttribute("font-size", "54");
                txt.setAttribute("text-anchor", "middle"); txt.setAttribute("dominant-baseline", "middle");
                if (p === selectedPawn) txt.setAttribute("fill", "#4ade80"); else txt.setAttribute("fill", "#003600");
                txt.textContent = "♟️"; g.appendChild(txt);
                if(pawnStacks[p] > 1) {
                    const cnt = document.createElementNS("http://www.w3.org/2000/svg","text");
                    cnt.setAttribute("x", x+20); cnt.setAttribute("y", y-4);
                    cnt.setAttribute("font-size", "20"); cnt.setAttribute("fill", "blue"); cnt.setAttribute("font-weight", "bold");
                    cnt.textContent = pawnStacks[p]; g.appendChild(cnt);
                }
                piecesGroup.appendChild(g);
            }
        }
        
        Object.entries(kingPositions).forEach(([kName, pos]) => {
            if(pos){
                const {x, y} = pointToCoord(pos);
                const txt = document.createElementNS("http://www.w3.org/2000/svg","text");
                txt.setAttribute("x", x); txt.setAttribute("y", y); txt.setAttribute("font-size", "65");
                txt.setAttribute("text-anchor", "middle"); txt.setAttribute("dominant-baseline", "middle");
                txt.setAttribute("pointer-events", "none"); txt.setAttribute("fill", "black");
                txt.textContent = "♚"; piecesGroup.appendChild(txt);
            }
        });
    }

    function highlightValidMoves(point, type) {
        if(!helperEnabled) return;
        // Simple logic for helper highlight (not hint)
        // ... (can be added if needed, kept simple for now)
    }
    function clearHighlights() {
        pointsGroup.querySelectorAll("circle").forEach(c => { c.setAttribute("stroke", "none"); c.classList.remove("helper-highlight"); c.classList.remove("helper-on"); });
    }
    function vibrate(pat) { if(navigator.vibrate) navigator.vibrate(pat); }

    function saveGameState() {
        undoStack.push({ pawnStacks: JSON.parse(JSON.stringify(pawnStacks)), kingPositions: {...kingPositions}, currentTurn, gameState, movesPlayed, playerMoveHistory: [...playerMoveHistory] });
        redoStack = [];
    }
    document.getElementById("undoBtn").addEventListener("pointerdown", () => {
        if(undoStack.length === 0 || gameState !== "PLAYING") return;
        redoStack.push({pawnStacks: JSON.parse(JSON.stringify(pawnStacks)), kingPositions: {...kingPositions}, currentTurn, gameState, movesPlayed});
        restoreState(undoStack.pop());
    });
    document.getElementById("redoBtn").addEventListener("pointerdown", () => {
        if(redoStack.length === 0 || gameState !== "PLAYING") return;
        undoStack.push({pawnStacks: JSON.parse(JSON.stringify(pawnStacks)), kingPositions: {...kingPositions}, currentTurn, gameState, movesPlayed});
        restoreState(redoStack.pop());
    });
    function restoreState(s) {
        clearHighlights();
        pawnStacks = JSON.parse(JSON.stringify(s.pawnStacks)); kingPositions = {...s.kingPositions}; currentTurn = s.currentTurn; gameState = s.gameState; movesPlayed = s.movesPlayed || 0;
        playerMoveHistory = s.playerMoveHistory || [];
        selectedPawn=null; selectedKing=null; renderAll(); updateStatusContainer();
        isProcessing = false; // Reset lock on undo
    }
    document.getElementById("resetBtn").addEventListener("pointerdown", () => { clearHighlights(); location.reload(); });
    const modal = document.getElementById("gameOverModal");
    if(modal) { const homeBtn = modal.querySelector('.home-btn'); if(homeBtn) homeBtn.onclick = () => window.location.href = 'puzzle-setup.html'; }

    // INIT
    if(pointsGroup) {
        pointsGroup.innerHTML = "";
        for(let r=0; r<5; r++) {
            for(let c=0; c<5; c++) {
                const cx = c*size, cy = r*size; const pt = pointName(c,r);
                const circ = document.createElementNS("http://www.w3.org/2000/svg","circle");
                circ.setAttribute("cx",cx); circ.setAttribute("cy",cy); circ.setAttribute("r","40");
                circ.setAttribute("fill","rgba(255,255,255,0.01)"); circ.style.cursor="pointer"; circ.dataset.point = pt;
                circ.addEventListener("pointerdown", (e)=>{ e.preventDefault(); handleBoardClick(pt); });
                pointsGroup.appendChild(circ);
            }
        }
        cols.forEach((c, i) => { const t = document.createElementNS("http://www.w3.org/2000/svg", "text"); t.setAttribute("x", i*size); t.setAttribute("y", -35); t.setAttribute("class", "point-label"); t.textContent = c; pointsGroup.appendChild(t); });
        for(let r=0; r<5; r++){ const t = document.createElementNS("http://www.w3.org/2000/svg", "text"); t.setAttribute("x", -35); t.setAttribute("y", r*size+8); t.setAttribute("class", "point-label"); t.textContent = r+1; pointsGroup.appendChild(t); }
    }
    renderAll(); updateStatusContainer();
});