import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { get, getDatabase, onValue, ref, set, update } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-database.js";

// ==========================================
// 1. FIREBASE CONFIG (Server Connection)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAXORFD8QNwVgPw38_wgqZd3U21oTJ4z1w",
    authDomain: "trap-the-king.firebaseapp.com",
    databaseURL: "https://trap-the-king-default-rtdb.firebaseio.com",
    projectId: "trap-the-king",
    storageBucket: "trap-the-king.firebasestorage.app",
    messagingSenderId: "279741214015",
    appId: "1:279741214015:web:d7418a7ceaf57deaf0378a",
    measurementId: "G-5ZF0F5RJ1C"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ==========================================
// 2. GAME VARIABLES & SETUP
// ==========================================
const urlParams = new URLSearchParams(window.location.search);
const roomID = urlParams.get('room');
const myRole = urlParams.get('role'); // 'host' (King) or 'guest' (Pawn)

// Agar Room ID nahi hai to wapas bhejo
if (!roomID) {
    alert("❌ Error: No Room Code Found!");
    window.location.href = "online-setup.html";
}

const size = 118;
const cols = ["A", "B", "C", "D", "E"];
let myPieceType = (myRole === 'host') ? 'king' : 'pawn';
const roomDisplayEl = document.getElementById("roomDisplay");
if(roomDisplayEl) roomDisplayEl.textContent = roomID;
let isMyTurn = false;
let currentGameState = null;
let selectedPos = null;
let totalMovesLimit = 100; // 50 Rounds

// Audio Setup
const bgMusic = document.getElementById("bgMusic"); // HTML se audio lo
const moveSound = new Audio("music/move.mp3");
const winSound = new Audio("music/win.mp3");
const killSound = new Audio("music/pawnKill.mp3");
let isMuted = false;

// DOM Elements
const turnEl = document.getElementById("turnIndicator");
const moveCountEl = document.getElementById("moveCount");
const pawnCountEl = document.getElementById("pawnCount");
const k1StatusEl = document.getElementById("king1Status");
const k2StatusEl = document.getElementById("king2Status");
const pointsGroup = document.getElementById("points");
const piecesGroup = document.getElementById("pieces");
const aiMoveGroup = document.getElementById("aiMoveGroup"); // For trails

// ==========================================
// 3. INITIALIZE GAME (HOST ONLY)
// ==========================================
if (myRole === 'host') {
    const boardRef = ref(db, `rooms/${roomID}/board`);
    get(boardRef).then((snapshot) => {
        if (!snapshot.exists()) {
            resetGameOnServer();
        }
    });
}

function resetGameOnServer() {
    set(ref(db, `rooms/${roomID}/board`), {
        pawnStacks: { 
                    "B2": 5, "B4": 5, "D2": 5, "D4": 5,
        },
        kingPositions: { king1: "C1", king2: "C5" }, 
        currentTurn: 'pawn', 
        movesPlayed: 0,
        winner: null,
        lastMove: null
    });
}

// ==========================================
// 4. LISTEN FOR UPDATES (Main Logic)
// ==========================================
const roomRef = ref(db, `rooms/${roomID}/board`);

onValue(roomRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return; // Data abhi load ho raha hai

    // Sound Effect Logic (Change detect karke)
    if (currentGameState && !isMuted) {
        const oldPawns = countPawns(currentGameState);
        const newPawns = countPawns(data);
        const oldTurn = currentGameState.currentTurn;
        
        if (oldTurn !== data.currentTurn) {
             if (oldPawns > newPawns) killSound.play().catch(()=>{});
             else moveSound.play().catch(()=>{});
        }
    }

    currentGameState = data;
    renderBoard(data);
    updateStatusUI(data);
    
    // Rotate Board Check
    rotateBoard();

    // Check Win (Only Host updates DB to avoid conflict)
    if (myRole === 'host') checkWinCondition(data);
});

// ==========================================
// 5. RENDER BOARD
// ==========================================
function renderBoard(data) {
    piecesGroup.innerHTML = "";
    aiMoveGroup.innerHTML = ""; 

    // Draw Pawns
    for (let pos in data.pawnStacks) {
        if (data.pawnStacks[pos] > 0) {
            drawPiece(pos, 'pawn', data.pawnStacks[pos]);
        }
    }
    // Draw Kings
    if (data.kingPositions.king1) drawPiece(data.kingPositions.king1, 'king');
    if (data.kingPositions.king2) drawPiece(data.kingPositions.king2, 'king');

    // Highlight Last Move (Yellow/Green Line)
    if (data.lastMove) {
        drawTrail(data.lastMove.from, data.lastMove.to);
    }
}

// Draw a single piece
function drawPiece(pos, type, count=1) {
    const {x, y} = getCoords(pos);
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    
    // Main Icon
    const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
    txt.setAttribute("x", x); txt.setAttribute("y", y);
    txt.setAttribute("font-size", type==='king'?"65":"54");
    txt.setAttribute("text-anchor", "middle"); txt.setAttribute("dominant-baseline", "middle");
    txt.textContent = type === 'king' ? "♚" : "♟️";
    txt.setAttribute("fill", type==='king' ? "black" : "#003600");
    txt.setAttribute("class", "standing-piece"); // Animation class
    g.appendChild(txt);

    // Pawn Count Badge
    if(count > 1) {
        const cnt = document.createElementNS("http://www.w3.org/2000/svg","text");
        cnt.setAttribute("x", x+20); cnt.setAttribute("y", y-4);
        cnt.setAttribute("font-size", "20"); cnt.setAttribute("fill", "blue"); cnt.setAttribute("font-weight", "bold");
        cnt.textContent = count; g.appendChild(cnt);
    }
    piecesGroup.appendChild(g);
}

// Draw Line for previous move
function drawTrail(from, to) {
    const f = getCoords(from);
    const t = getCoords(to);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", f.x); line.setAttribute("y1", f.y);
    line.setAttribute("x2", t.x); line.setAttribute("y2", t.y);
    line.setAttribute("class", "ai-trail-line"); // CSS class for glow
    aiMoveGroup.appendChild(line);
}

// ==========================================
// 6. UI UPDATES & ROTATION
// ==========================================
function updateStatusUI(data) {
    // Winner Check
    if (data.winner) {
        showWinModal(data.winner);
        turnEl.textContent = "GAME OVER";
        return;
    }

    // Turn Indicator
    if (data.currentTurn === myPieceType) {
        isMyTurn = true;
        turnEl.textContent = "🟢 YOUR TURN";
        turnEl.style.color = "#4ade80";
        if("vibrate" in navigator) navigator.vibrate(50);
    } else {
        isMyTurn = false;
        turnEl.textContent = "🔴 WAITING...";
        turnEl.style.color = "#f87171";
    }

    // Stats
    moveCountEl.textContent = data.movesPlayed || 0;
    pawnCountEl.textContent = countPawns(data);
    
    // King Status
    const k1Safe = getValidKingMoves(data.kingPositions.king1, data).length > 0;
    const k2Safe = getValidKingMoves(data.kingPositions.king2, data).length > 0;
    
    k1StatusEl.textContent = k1Safe ? "SAFE" : "BLOCKED";
    k1StatusEl.className = `status-value ${k1Safe ? "safe" : "blocked"}`;
    
    k2StatusEl.textContent = k2Safe ? "SAFE" : "BLOCKED";
    k2StatusEl.className = `status-value ${k2Safe ? "safe" : "blocked"}`;
}

// 🔥 ROTATION LOGIC (Aapka Feature)
function rotateBoard() {
    const boardContainer = document.querySelector('.board'); // CSS class check karein
    if (!boardContainer) return;

    // Logic: Agar main KING hu, to board ulta karo taaki main niche rahu
    // Agar main PAWN hu, to board seedha rakho
    if (myPieceType === 'king') {
        boardContainer.style.transform = "rotate(0deg)";
        // Text ko wapas seedha karna padega taaki ulta na dikhe
        document.querySelectorAll('text').forEach(t => {
            t.style.transformBox = "fill-box";
            t.style.transformOrigin = "center";
            t.style.transform = "rotate(0deg)";
        });
    } else {
        boardContainer.style.transform = "rotate(0deg)";
        document.querySelectorAll('text').forEach(t => {
            t.style.transform = "rotate(0deg)";
        });
    }
}

// ==========================================
// 7. INTERACTION (Handle Clicks)
// ==========================================
function handleBoardClick(clickedPos) {
    if (!currentGameState || currentGameState.winner) return;
    
    if (!isMyTurn) {
        showToast("⏳ Wait for opponent!");
        return;
    }

    // Step 1: Selection
    if (selectedPos === null) {
        // Can only select MY pieces
        if (myPieceType === 'pawn' && currentGameState.pawnStacks[clickedPos]) {
            selectedPos = clickedPos;
            highlight(clickedPos);
        } 
        else if (myPieceType === 'king' && Object.values(currentGameState.kingPositions).includes(clickedPos)) {
            selectedPos = clickedPos;
            highlight(clickedPos);
        }
    } 
    // Step 2: Movement
    else {
        if (selectedPos === clickedPos) { selectedPos = null; clearHighlights(); return; }

        // Validate Locally
        if (validateMove(selectedPos, clickedPos, myPieceType)) {
            executeMove(selectedPos, clickedPos, myPieceType);
        } else {
            showToast("❌ Invalid Move!");
            if("vibrate" in navigator) navigator.vibrate([50, 50]);
        }
        selectedPos = null;
        clearHighlights();
    }
}

function executeMove(from, to, type) {
    const data = JSON.parse(JSON.stringify(currentGameState)); // Clone state

    if (type === 'pawn') {
        data.pawnStacks[from]--;
        if(data.pawnStacks[from]===0) delete data.pawnStacks[from];
        data.pawnStacks[to] = (data.pawnStacks[to] || 0) + 1;
        data.currentTurn = 'king';
    } else {
        if (data.kingPositions.king1 === from) data.kingPositions.king1 = to;
        else if (data.kingPositions.king2 === from) data.kingPositions.king2 = to;
        
        // Jump Logic
        const mid = getMidPoint(from, to);
        if(mid) {
            data.pawnStacks[mid]--;
            if(data.pawnStacks[mid]===0) delete data.pawnStacks[mid];
        }
        data.currentTurn = 'pawn';
    }

    data.movesPlayed++;
    data.lastMove = { from, to };
    
    // Update Firebase (Server)
    update(ref(db, `rooms/${roomID}/board`), data);
}

// ==========================================
// 8. HELPERS & VALIDATION
// ==========================================
function getCoords(p) { 
    const c = cols.indexOf(p[0]), r = parseInt(p[1])-1;
    return {x: c*size, y: r*size};
}

function validateMove(from, to, type) {
    if (currentGameState.pawnStacks[to] > 0 || Object.values(currentGameState.kingPositions).includes(to)) return false; 
    
    if (type === 'pawn') return isOneStep(from, to);
    
    // King Logic
    if (isOneStep(from, to)) return true;
    const mid = getMidPoint(from, to);
    return (mid && currentGameState.pawnStacks[mid] > 0);
}

function isOneStep(f, t) {
    const fc = cols.indexOf(f[0]), fr = parseInt(f[1]);
    const tc = cols.indexOf(t[0]), tr = parseInt(t[1]);
    const dc = Math.abs(fc - tc), dr = Math.abs(fr - tr);
    return (dc <= 1 && dr <= 1 && (dc+dr) > 0);
}

function getMidPoint(f, t) {
    const fc = cols.indexOf(f[0]), fr = parseInt(f[1]);
    const tc = cols.indexOf(t[0]), tr = parseInt(t[1]);
    if (Math.abs(fc-tc) > 2 || Math.abs(fr-tr) > 2) return null;
    const mc = (fc + tc) / 2, mr = (fr + tr) / 2;
    return (Number.isInteger(mc) && Number.isInteger(mr)) ? `${cols[mc]}${mr}` : null;
}

function getValidKingMoves(pos, data) {
    if(!pos) return [];
    let moves = [];
    const fc = cols.indexOf(pos[0]), fr = parseInt(pos[1]);
    for(let r=fr-2; r<=fr+2; r++) for(let c=fc-2; c<=fc+2; c++) {
        const t = `${cols[c]}${r}`;
        if(c>=0 && c<5 && r>=1 && r<=5 && pos!==t) {
             if (data.pawnStacks[t] || Object.values(data.kingPositions).includes(t)) continue;
             if (isOneStep(pos, t)) moves.push(t);
             else {
                 const mid = getMidPoint(pos, t);
                 if(mid && data.pawnStacks[mid]) moves.push(t);
             }
        }
    }
    return moves;
}

function countPawns(data) {
    let total = 0;
    for(let k in data.pawnStacks) total += data.pawnStacks[k];
    return total;
}

// ==========================================
// 9. WIN LOGIC & EVENTS
// ==========================================
function checkWinCondition(data) {
    if(data.winner) return;

    let winner = null;
    const pawns = countPawns(data);
    const k1Moves = getValidKingMoves(data.kingPositions.king1, data).length;
    const k2Moves = getValidKingMoves(data.kingPositions.king2, data).length;

    if (pawns <= 5) winner = "king";
    else if (data.movesPlayed >= totalMovesLimit) winner = "king";
    else if (k1Moves === 0 && k2Moves === 0) winner = "pawn";

    if (winner) update(ref(db, `rooms/${roomID}/board`), { winner: winner });
}

function showWinModal(winner) {
    if(!isMuted) winSound.play().catch(()=>{});
    const modal = document.getElementById("gameOverModal");
    if(modal) {
        document.getElementById("winTitle").textContent = "GAME OVER";
        document.getElementById("winMessage").textContent = `${winner.toUpperCase()} Wins!`;
        document.getElementById("winIcon").textContent = winner === 'king' ? '👑' : '♟️';
        modal.style.display = "flex";
    }
}

// Draw Grid (One time)
pointsGroup.innerHTML = "";
for(let r=0; r<5; r++) {
    for(let c=0; c<5; c++) {
        const cx = c*size, cy = r*size; const pt = `${cols[c]}${r+1}`;
        const circ = document.createElementNS("http://www.w3.org/2000/svg","circle");
        circ.setAttribute("cx",cx); circ.setAttribute("cy",cy); circ.setAttribute("r","40");
        circ.setAttribute("fill","rgba(255,255,255,0.01)"); 
        circ.dataset.point = pt;
        circ.addEventListener("pointerdown", (e)=>{ e.preventDefault(); handleBoardClick(pt); });
        pointsGroup.appendChild(circ);
    }
}
// Labels
cols.forEach((c, i) => { const t = document.createElementNS("http://www.w3.org/2000/svg", "text"); t.setAttribute("x", i*size); t.setAttribute("y", -35); t.setAttribute("class", "point-label"); t.textContent = c; pointsGroup.appendChild(t); });
for(let r=0; r<5; r++){ const t = document.createElementNS("http://www.w3.org/2000/svg", "text"); t.setAttribute("x", -35); t.setAttribute("y", r*size+8); t.setAttribute("class", "point-label"); t.textContent = r+1; pointsGroup.appendChild(t); }

// Button Events
document.getElementById("soundBtn").addEventListener("click", function() {
    isMuted = !isMuted;
    this.style.opacity = isMuted ? "0.5" : "1";
    this.textContent = isMuted ? "🔇 Muted" : "🔊 Sound";
});

document.getElementById("resetBtn").addEventListener("click", () => {
    if(confirm("Reset Board for BOTH players?")) resetGameOnServer();
});

// Helper for highlights
function highlight(p) { const c = pointsGroup.querySelector(`circle[data-point="${p}"]`); if(c) c.setAttribute("fill", "rgba(0, 255, 0, 0.4)"); }
function clearHighlights() { document.querySelectorAll("circle").forEach(c => c.setAttribute("fill", "rgba(255,255,255,0.01)")); }
function showToast(msg) { turnEl.textContent = msg; setTimeout(() => { if(currentGameState) updateStatusUI(currentGameState); }, 1500); }
