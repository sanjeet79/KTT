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
        });




document.addEventListener('DOMContentLoaded', function() {
    console.log("🎮 TRAP THE KING: AI ENGINE (ULTIMATE EDITION v8.0)");

    // ==========================================
    // 1. CONFIGURATION
    // ==========================================
    const urlParams = new URLSearchParams(window.location.search);
    const USER_ROLE = urlParams.get('role') || 'pawn'; 
    const DIFFICULTY = urlParams.get('diff') || 'medium'; 

    let AI_DEPTH = 3; 
    let AI_RANDOMNESS = 0.05;

    // 🔥 ADJUSTED DIFFICULTY SETTINGS
    switch(DIFFICULTY) {
        case 'easy': 
            AI_DEPTH = 3; 
            AI_RANDOMNESS = 0.30; 
            break; 
        case 'medium': 
            AI_DEPTH = 5; 
            AI_RANDOMNESS = 0.10; 
            break; 
        case 'hard': 
            AI_DEPTH = 9; // Deep Thinking
            AI_RANDOMNESS = 0; 
            break; 
        default: AI_DEPTH = 4;
    }

    // UI Setup
    ['aiDifficulty', 'easyBtn', 'mediumBtn', 'hardBtn'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });

    // ==========================================
    // 2. STATE VARIABLES
    // ==========================================
    const size = 118;
    const cols = ["A","B","C","D","E"];
    const pointsGroup = document.getElementById("points");
    const piecesGroup = document.getElementById("pieces");
    const helperBtn = document.getElementById("helperBtn");
    
    // Initial State
    let pawnStacks = {"B2":5,"D2":5,"C3":0,"B4":5,"D4":5};
    let kingPositions = {king1:"C1", king2:"C5"};
    let recentBoardHistory = [];
    
    let currentTurn = "pawn";
    let selectedPawn = null;
    let selectedKing = null;
    let gameState = "PLAYING"; 
    let gameOver = false;
    let totalMovesLimit = 100; 
    let movesPlayed = 0;
    
    // 🔥 NEW MEMORY VARIABLE (Anti-Loop)
    let previousAiMove = null;

    let winAlertShown = false; 

    let undoStack = [];
    let redoStack = [];
    let animationQueue = [];
    let isAnimating = false;
    let helperEnabled = false;

        // ==========================================
    // SOUND SYSTEM (FIXED)
    // ==========================================
    const WIN_SOUND = "music/win.mp3";
    const PAWN_KILL_SOUND = "music/pawnKill.mp3";
    
    // Background Music Object
    const bgMusic = new Audio("music/bgGame.mp3");
    bgMusic.loop = true;
    bgMusic.volume = 0.5; // 50% Volume

    let isMuted = false;
    const soundBtn = document.getElementById("soundBtn");

    // 1. Central Function to Control BG Music
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

    // 2. Sound Button Click Listener
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
    // 3. HELPERS
    // ==========================================
    function pointName(col, row) { return `${cols[col]}${row+1}`; }
    
    function parsePoint(p) { 
        if(!p) return {col:-1, row:-1};
        const col = cols.indexOf(p[0]);
        const row = parseInt(p[1])-1;
        return {col, row}; 
    }
    
    function pointToCoord(p) { 
        const c = parsePoint(p); 
        return {x: c.col*size, y: c.row*size}; 
    }

    function hasPawn(p) { return (pawnStacks[p] || 0) > 0; }
    function isKingAt(p) { return kingPositions.king1 === p || kingPositions.king2 === p; }
    function isOccupied(p) { return hasPawn(p) || isKingAt(p); }
    function isOccupiedState(p, pStk, kPos) { return (pStk[p] || 0) > 0 || kPos.king1 === p || kPos.king2 === p; }

    const VALID_NEIGHBORS = new Set([
        "A1-B2","B2-A1","B2-C3","C3-B2","C3-D4","D4-C3","D4-E5","E5-D4",
        "E1-D2","D2-E1","D2-C3","C3-D2","C3-B4","B4-C3","B4-A5","A5-B4",
        "C1-B2","B2-C1","B2-A3","A3-B2","A3-B4","B4-A3","B4-C5","C5-B4",
        "C1-D2","D2-C1","D2-E3","E3-D2","E3-D4","D4-E3","D4-C5","C5-D4",
        "A1-C3","C3-A1","E1-C3","C3-E1","A5-C3","C3-A5","E5-C3","C3-E5"
    ]);

    function isOneStepMove(f, t) {
        const a = parsePoint(f), b = parsePoint(t);
        if (a.col < 0 || a.row < 0 || b.col < 0 || b.row < 0) return false;
        const dr = Math.abs(a.row - b.row), dc = Math.abs(a.col - b.col);
        if ((dr === 0 && dc === 1) || (dc === 0 && dr === 1)) return true;
        if (dr === 1 && dc === 1) return VALID_NEIGHBORS.has(`${f}-${t}`) || VALID_NEIGHBORS.has(`${t}-${f}`);
        return false;
    }

    function isValidKingJump(from, to) {
        const a = parsePoint(from), b = parsePoint(to);
        const dr = b.row - a.row, dc = b.col - a.col;
        if (!((Math.abs(dr)===2 && dc===0) || (Math.abs(dc)===2 && dr===0) || (Math.abs(dr)===2 && Math.abs(dc)===2))) return null;
        const mid = pointName(a.col + Math.sign(dc), a.row + Math.sign(dr));
        return (isOneStepMove(from, mid) && isOneStepMove(mid, to)) ? mid : null;
    }

    function kingHasAnyMove(kingPos, pStk=pawnStacks, kPos=kingPositions) {
        for (let r=0; r<5; r++) for (let c=0; c<5; c++) {
            const t = pointName(c,r);
            if (isOccupiedState(t, pStk, kPos)) continue;
            if (isOneStepMove(kingPos, t)) return true;
            const mid = isValidKingJump(kingPos, t);
            if (mid && (pStk[mid]||0)>0) return true;
        }
        return false;
    }   

    function isPawnSupported(pos, pStk) {
        let support = 0;
        for(let r=0; r<5; r++) for(let c=0; c<5; c++) {
            const neighbor = pointName(c,r);
            if(pos !== neighbor && (pStk[neighbor]||0) > 0 && isOneStepMove(pos, neighbor)) {
                support++;
            }
        }
        return support;
    }

    function getMobilityScore(pos, pStk, kPos) {
        let moves = 0;
        for(let r=0; r<5; r++) for(let c=0; c<5; c++) {
            const tgt = pointName(c,r);
            if (!isOccupiedState(tgt, pStk, kPos)) {
                if (isOneStepMove(pos, tgt)) moves += 1; 
                else {
                    const mid = isValidKingJump(pos, tgt);
                    if (mid && (pStk[mid] || 0) > 0) moves += 50; 
                }
            }
        }
        return moves;
    }
    
    
    // 📸 BOARD MEMORY HELPER
    function getBoardSignature(pStk, kPos) {
        const pKeys = Object.keys(pStk).sort();
        let sig = "P:";
        pKeys.forEach(k => { if(pStk[k]>0) sig += `${k}(${pStk[k]})`; });
        sig += "|K:";
        sig += `K1${kPos.king1}K2${kPos.king2}`;
        return sig;
    }
    
    // ==========================================
    // 4. AI LOGIC (DIFFICULTY SPECIALIZED) 🧠
    // ==========================================

    // ♟️ PAWN KE LIYE (Ye change nahi hoga)
    // Pawn hamesha Center (C3) ko pasand karega aur Edges ko avoid karega.
    function getSquareValue(pos) {
        if (["C3"].includes(pos)) return 1000; 
        if (["B2", "D2", "B4", "D4"].includes(pos)) return 200; 
        if (["A1", "B1", "D1", "E1", "A5", "E5"].includes(pos)) return -300; 
        return 0; 
    }       


        // 🏰 BOARD EVALUATION (FULL LOGIC: SAFETY + STRATEGY + PHASED)
    function evaluateBoard(pStk, kPos, curMoves) {
        const pCount = Object.values(pStk).reduce((a,b)=>a+b,0);
        
        // --- TERMINAL STATES (Game Over Checks) ---
        // Agar Pawns khatam ho gaye ya moves limit cross ho gayi -> King Wins
        if (pCount <= 5 || curMoves >= totalMovesLimit) return 100000000; 
        
        // Calculate Mobility (King ke paas kitni jagah hai)
        const k1Mob = getMobilityScore(kPos.king1, pStk, kPos);
        const k2Mob = getMobilityScore(kPos.king2, pStk, kPos);
        
        // Agar King ke paas 0 moves hain -> Pawn Wins
        if (k1Mob === 0 && k2Mob === 0) return -100000000; 

        let score = 0;
        
        // 🔥 PHASE DETECTION
        // 69 moves ke baad AI "Aggressive" ho jayega
        const PHASE = (curMoves >= 69) ? 2 : 1; 

        // ==========================================
        // 1. MATERIAL SCORE (Pawn Count)
        // ==========================================
        score -= (pCount * 1000000); // Har pawn ki keemat heere jaisi hai

        // ==========================================
        // 2. MOBILITY CHOKE (Jitne kam moves, utna achha)
        // ==========================================
        if (PHASE === 2) {
            // Phase 2 mein King ko saans mat lene do
            score += ((k1Mob + k2Mob) * 30000); 
        } else {
            // Phase 1 mein normal pressure rakho
            score += ((k1Mob + k2Mob) * 5000);
        }

        // ==========================================
        // 3. DANGER CHECK (Global Suicide Detection)
        // ==========================================
        // Agar board par koi bhi pawn "Capture Position" mein hai, to penalty lagao.
        let dangerPenalty = 0;
        ['king1', 'king2'].forEach(k => {
            const kLoc = parsePoint(kPos[k]);
            const jumps = [
                {r:2, c:0}, {r:-2, c:0}, {r:0, c:2}, {r:0, c:-2},
                {r:2, c:2}, {r:2, c:-2}, {r:-2, c:2}, {r:-2, c:-2}
            ];

            jumps.forEach(j => {
                const lRow = kLoc.row + j.r; 
                const lCol = kLoc.col + j.c;
                const mRow = kLoc.row + (j.r / 2); 
                const mCol = kLoc.col + (j.c / 2);

                if (lRow >= 0 && lRow < 5 && lCol >= 0 && lCol < 5) {
                    const landing = pointName(lCol, lRow);
                    const victim = pointName(mCol, mRow);

                    if ((pStk[victim] || 0) > 0 && !isOccupiedState(landing, pStk, kPos)) {
                        // King jump maar sakta hai! Bachaao!
                        if (victim === "C3") dangerPenalty += 500000; 
                        else if (pStk[victim] === 1) dangerPenalty += 50000; // Single Pawn High Risk
                        else dangerPenalty += 5000; // Stack Low Risk
                    }
                }
            });
        });
        score += dangerPenalty; 

        // ==========================================
        // 4. POSITIONAL HEATMAP (Smart Positioning)
        // ==========================================
        const center = "C3";
        const pillars = ["B2", "D2", "B4", "D4"];
        const edges = ["A1","A2","A3","A4","A5", "E1","E2","E3","E4","E5", "B1","C1","D1", "B5","C5","D5"];
        
        const k1c = parsePoint(kPos.king1);
        const k2c = parsePoint(kPos.king2);

        for (let p in pStk) {
            if (pStk[p] > 0) {
                const pc = parsePoint(p);
                
                // Distance to nearest King
                const d1 = Math.abs(pc.row - k1c.row) + Math.abs(pc.col - k1c.col);
                const d2 = Math.abs(pc.row - k2c.row) + Math.abs(pc.col - k2c.col);
                const minDist = Math.min(d1, d2);

                // --- EDGE LOGIC (THE FIX) ---
                // Normal case: Edge par mat jao (Penalty).
                // Special case: Agar King bagal mein hai, to Edge par jao (No Penalty).
                if (edges.includes(p)) {
                    if (minDist > 2) score += 400; // King door hai? To edge se hato.
                    // Agar King paas hai (minDist <= 2), to koi penalty nahi (Go to A3!).
                }

                // Center & Pillars (Always Good)
                if (p === center) score -= 3000; 
                else if (pillars.includes(p)) score -= 500; 

                // Phase 2: Compression (King ke paas jao)
                if (PHASE === 2) {
                    score -= ((10 - minDist) * 100); 
                }
            }
        }
        
        return score;
    }







// 🚀 MOVE GENERATION (FULL DETAILED LOGIC: ANTI-LOOP + FREE PAWN)
    function getAllMoves(state, turn) {
        const moves = [];
        const { pawnStacks: pStk, kingPositions: kPos } = state;
        const isKingAt = (pos) => (kPos.king1 === pos || kPos.king2 === pos);

        function pawnCountAt(sq) { return pStk[sq] || 0; }
        
        function canJumpFrom(pos, currentPStk) {
            let jumps = 0;
            for(let r=0; r<5; r++) for(let c=0; c<5; c++) {
                const t = pointName(c,r);
                const mid = isValidKingJump(pos, t);
                if (mid && (currentPStk[mid]||0) > 0 && !isOccupiedState(t, currentPStk, kPos)) jumps++;
            }
            return jumps;
        }

        if (turn === 'king') {
            // ... KING LOGIC (SAME AS BEFORE) ...
            ['king1', 'king2'].forEach(k => {
                const pos = kPos[k];
                const otherKing = k === 'king1' ? kPos.king2 : kPos.king1;
                const okc = parsePoint(otherKing);
                for(let r=0; r<5; r++) for(let c=0; c<5; c++) {
                    const tgt = pointName(c,r);
                    if (!isOccupiedState(tgt, pStk, kPos)) {
                        const tc = parsePoint(tgt);
                        const distToOther = Math.abs(tc.row - okc.row) + Math.abs(tc.col - okc.col);
                        if (isOneStepMove(pos, tgt)) {
                            let moveScore = 10;
                            if (DIFFICULTY === 'easy') { if (distToOther <= 3) moveScore += 1000; } 
                            else if (DIFFICULTY === 'medium') { if (distToOther > 3) moveScore += 1000; }
                            else { if (distToOther > 2) moveScore += 500; }
                            if (tgt === "C3" && DIFFICULTY !== 'hard') moveScore -= 5000;
                            moves.push({type:'move', piece:'king', king:k, from:pos, to:tgt, score: moveScore});
                        } else {
                            const mid = isValidKingJump(pos, tgt);
                            if (mid && (pStk[mid]||0)>0) {
                                let killScore = 20000; 
                                if (mid === "C3") {
                                    if (DIFFICULTY === 'hard') killScore += 100000;
                                    else if (DIFFICULTY === 'medium') killScore = 3000; 
                                    else killScore -= 5000; 
                                }
                                if (mid !== "C3" || DIFFICULTY === 'hard') {
                                    const victimCount = pawnCountAt(mid);
                                    if (victimCount === 1) killScore += 15000; else killScore += 5000; 
                                }
                                if (DIFFICULTY === 'easy') { if (distToOther <= 3) killScore += 2000; } 
                                else { if (distToOther > 3) killScore += 2000; }
                                if (DIFFICULTY === 'hard') {
                                    let tempStk = {...pStk}; tempStk[mid]--;
                                    if (canJumpFrom(tgt, tempStk) > 0) killScore += 5000;
                                }
                                moves.push({type:'jump', piece:'king', king:k, from:pos, to:tgt, mid:mid, score: killScore});
                            }
                        }
                    }
                }
            });

        } else {
            // ==========================================
            // ♟️ PAWN LOGIC (THE FIXER)
            // ==========================================
            
            // 1. Threat & Block Pre-Calculation (Kaun marne wala hai?)
            let threatenedPawns = new Set();
            let squaresToBlock = {};

            ['king1', 'king2'].forEach(k => {
                const kLoc = parsePoint(kPos[k]);
                const jumpOffsets = [
                    {r:2, c:0}, {r:-2, c:0}, {r:0, c:2}, {r:0, c:-2},
                    {r:2, c:2}, {r:2, c:-2}, {r:-2, c:2}, {r:-2, c:-2}
                ];
                jumpOffsets.forEach(j => {
                    const lRow = kLoc.row + j.r; const lCol = kLoc.col + j.c; // Landing
                    const mRow = kLoc.row + (j.r/2); const mCol = kLoc.col + (j.c/2); // Victim
                    
                    if(lRow>=0 && lRow<5 && lCol>=0 && lCol<5) {
                        const landing = pointName(lCol, lRow);
                        const victim = pointName(mCol, mRow);
                        
                        if((pStk[victim]||0) > 0 && !isOccupiedState(landing, pStk, kPos)) {
                            threatenedPawns.add(victim);
                            // C3 > Single > Stack
                            let urgency = (victim === "C3") ? 3000000 : ((pStk[victim]===1) ? 200000 : 20000);
                            if(!squaresToBlock[landing] || urgency > squaresToBlock[landing]) {
                                squaresToBlock[landing] = urgency;
                            }
                        }
                    }
                });
            });

            // Kings Location for Distance Calculation
            const k1c = parsePoint(kPos.king1);
            const k2c = parsePoint(kPos.king2);

            for (let p in pStk) {
                if (pStk[p]>0) {
                    for(let r=0; r<5; r++) for(let c=0; c<5; c++) {
                        const tgt = pointName(c,r);
                        
                        if (isOneStepMove(p, tgt) && !isOccupiedState(tgt, pStk, kPos)) {
                            let bonus = 0;
                            const isHardMode = (typeof AI_DEPTH !== 'undefined' && AI_DEPTH >= 3);
                            
                            // Prevent instant reverse move (Basic Anti-Loop)
                            if (previousAiMove && p === previousAiMove.to && tgt === previousAiMove.from) bonus -= 50000;
                            
                            // ----------------------------------------------------
                            // 🛑 1. STRICT ANTI-LOOP (MEMORY CHECK)
                            // ----------------------------------------------------
                            if (typeof recentBoardHistory !== 'undefined' && recentBoardHistory.length > 0) {
                                // Simulate future state
                                const tempPStk = {...pStk};
                                tempPStk[p]--; if(tempPStk[p]===0) delete tempPStk[p];
                                tempPStk[tgt] = (tempPStk[tgt]||0)+1;
                                const futureSig = getBoardSignature(tempPStk, kPos);
                                
                                // Agar ye state history mein hai -> BLOCK IT
                                if (recentBoardHistory.includes(futureSig)) {
                                    bonus -= 100000000; // Loop = Death
                                }
                            }

                            // ----------------------------------------------------
                            // 💀 2. SUICIDE CHECK (Future Projection)
                            // ----------------------------------------------------
                            let isSuicide = false;
                            const tLoc = parsePoint(tgt);
                            ['king1', 'king2'].forEach(k => {
                                const kLoc = parsePoint(kPos[k]);
                                const dr = tLoc.row - kLoc.row; 
                                const dc = tLoc.col - kLoc.col;
                                
                                // King mere naye ghar (Target) ke bagal mein hai
                                if(Math.abs(dr)<=1 && Math.abs(dc)<=1) {
                                    // Landing spot calculate karo
                                    const lRow = tLoc.row + dr; 
                                    const lCol = tLoc.col + dc;
                                    
                                    if(lRow>=0 && lRow<5 && lCol>=0 && lCol<5) {
                                        const lSpot = pointName(lCol, lRow);
                                        let stack = pStk[lSpot]||0;
                                        if(p === lSpot) stack--; // Main khud wahan se hat gaya hoon
                                        
                                        // Agar landing spot khali hai -> Suicide
                                        let blocked = (stack > 0) || isKingAt(lSpot);
                                        if(!blocked) isSuicide = true;
                                    }
                                }
                            });

                            if(isSuicide) {
                                bonus -= 20000000; // Suicide is extremely bad
                            } 
                            else {
                                // ✅ SAFE MOVES ONLY (Bonuses)

                                // A. FREE PAWN ACTIVATION (The Fix for E5/D4/A1)

                                


                                const pc = parsePoint(p);
                                const tc = parsePoint(tgt);
                                
                                const distK1 = Math.abs(pc.row - k1c.row) + Math.abs(pc.col - k1c.col);
                                const distK2 = Math.abs(pc.row - k2c.row) + Math.abs(pc.col - k2c.col);
                                const currentMinDist = Math.min(distK1, distK2);

                                const newDistK1 = Math.abs(tc.row - k1c.row) + Math.abs(tc.col - k1c.col);
                                const newDistK2 = Math.abs(tc.row - k2c.row) + Math.abs(tc.col - k2c.col);
                                const newMinDist = Math.min(newDistK1, newDistK2);

                                // Agar Pawn King se door hai (> 2 steps) aur wo PAAS ja raha hai
                                if (currentMinDist > 2 && newMinDist < currentMinDist) {
                                    bonus += 50000; // MASSIVE BONUS: "Go get the King!"
                                }

                                // B. KING RESTRICTION (A3 Fix)
                                // Agar move King ke bagal mein hai (limiting space) -> Good
                                function isKingNeighbor(target) {
                                    const t = parsePoint(target);
                                    const kings = [parsePoint(kPos.king1), parsePoint(kPos.king2)];
                                    return kings.some(k => Math.abs(k.row - t.row) <= 1 && Math.abs(k.col - t.col) <= 1);
                                }
                                if (isKingNeighbor(tgt)) {
                                    bonus += 3000; // Attack the King!
                                }

                                // C. BLOCKING THREATS
                                if(squaresToBlock[tgt]) bonus += squaresToBlock[tgt];

                                // D. SELF PRESERVATION
                                if(threatenedPawns.has(p)) {
                                    if(p === "C3") bonus += 500000;
                                    else if(pStk[p]===1) bonus += 50000;
                                    else bonus += 5000;
                                }

                                // E. STANDARD POSITIONAL
                                if (tgt === "C3") bonus += 5000; 
                                if (p === "C3") bonus -= 5000; 
                                
                                const pillars = ["B2", "D2", "B4", "D4"];
                                if (pillars.includes(tgt)) bonus += (pStk["C3"] ? 800 : 200);
                                if (pillars.includes(p) && pStk["C3"] && tgt !== "C3") bonus -= 1000;

                                if (isHardMode && (state.movesPlayed || 0) < 2 && tgt === "C3") bonus += 20000;
                                
                                if (isOneStepMove(tgt, kPos.king1) || isOneStepMove(tgt, kPos.king2)) bonus += 50;
                                if (p === "B2" && tgt === "A1") { if (isKingAt("B1") || isKingAt("C1") || isKingAt("A2")) { bonus += 25000; } }
                            }

                            moves.push({type:'move', piece:'pawn', from:p, to:tgt, score: 10 + bonus});
                        }
                    }
                }
            }
        }
        return moves.sort((a, b) => (b.score - a.score) || (Math.random() - 0.5));
    }
        
        // 5. MINIMAX BRAIN
    // ==========================================

    function simulateMove(state, move) {
        const ns = {
            pawnStacks: {...state.pawnStacks},
            kingPositions: {...state.kingPositions},
            movesPlayed: (state.movesPlayed || 0)
        };

        if (move.piece === 'king') {
            ns.kingPositions[move.king] = move.to;
            if (move.type === 'jump' && move.mid) {
                ns.pawnStacks[move.mid]--;
                if (ns.pawnStacks[move.mid] === 0) delete ns.pawnStacks[move.mid];
            }
        } else {
            ns.pawnStacks[move.from]--;
            if (ns.pawnStacks[move.from] === 0) delete ns.pawnStacks[move.from];
            ns.pawnStacks[move.to] = (ns.pawnStacks[move.to] || 0) + 1;
        }
        return ns;
    }

    
        function findBestMove(state, depth, isMaximizing) {
        // 1. GENERATE ALL MOVES
        const moves = getAllMoves(state, isMaximizing ? 'king' : 'pawn');

        // ============================================================
        // 🛡️ OVERRIDE LOGIC: INSTANT KILLS (Don't think, just kill)
        // ============================================================
        if (isMaximizing && DIFFICULTY === 'hard') {
            // A. C3 Kill Priority
            const centerKillMoves = moves.filter(
                m => m.piece === 'king' && m.type === 'jump' && m.mid === "C3"
            );
            if (centerKillMoves.length > 0) {
                centerKillMoves.sort((a, b) => (b.score - a.score));
                return centerKillMoves[0]; 
            }

            // B. Outer Ring Kill Priority
            const OUTER_RING = new Set(["A1","E1","A5","E5"]);
            const outerKills = moves.filter(m =>
                m.piece === 'king' && m.type === 'jump' && OUTER_RING.has(m.from)
            );
            if (outerKills.length > 0) {
                outerKills.sort((a, b) => (b.score - a.score));
                return outerKills[0];
            }
        }

        // ============================================================
        // 🔓 REAL DEPTH LOGIC (NO SAFETY CAPS)
        // ============================================================
        // Ab ye seedha aapke "AI_DEPTH" variable ko use karega.
        // Koi dynamic reduction nahi.
        let currentDepth = depth; 
        
        console.log(`🧠 DEEP THINKING STARTED | Depth: ${currentDepth} | Possibilities checking...`);

        // ============================================================
        // 🧠 MINIMAX EXECUTION
        // ============================================================
        let bestMove = null;
        let bestValue = isMaximizing ? -Infinity : Infinity;
        let alpha = -Infinity;
        let beta = Infinity;

        for (let i = 0; i < moves.length; i++) {
            const move = moves[i];
            const newState = simulateMove(state, move);
            newState.movesPlayed = (state.movesPlayed || 0) + 1;

            // Recursive Call
            const value = minimax(newState, currentDepth - 1, alpha, beta, !isMaximizing);

            // Logging top 3 moves for debugging
            if (i < 3) {
                console.log(`Move: ${move.from}->${move.to} | Score: ${move.score.toFixed(0)} | Prediction: ${value.toFixed(0)}`);
            }

            if (isMaximizing) {
                if (value > bestValue) { 
                    bestValue = value; 
                    bestMove = move; 
                }
                alpha = Math.max(alpha, value);
            } else {
                if (value < bestValue) { 
                    bestValue = value; 
                    bestMove = move; 
                }
                beta = Math.min(beta, value);
            }

            // Alpha-Beta Pruning (Essential for high depth)
            if (beta <= alpha) break;
        }

        return bestMove || moves[0];
    }

   
    function minimax(state, depth, alpha, beta, isMaximizing) {
        const score = evaluateBoard(state.pawnStacks, state.kingPositions, state.movesPlayed);
        if (Math.abs(score) >= 50000 || depth === 0) return score;

        const moves = getAllMoves(state, isMaximizing ? 'king' : 'pawn');
        if (moves.length === 0) return isMaximizing ? -1000000 : 100000; 

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (let move of moves) {
                const ns = simulateMove(state, move);
                ns.movesPlayed = (state.movesPlayed || 0) + 1;
                const evalScore = minimax(ns, depth - 1, alpha, beta, false);
                maxEval = Math.max(maxEval, evalScore);
                alpha = Math.max(alpha, evalScore);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (let move of moves) {
                const ns = simulateMove(state, move);
                ns.movesPlayed = (state.movesPlayed || 0) + 1;
                const evalScore = minimax(ns, depth - 1, alpha, beta, true);
                minEval = Math.min(minEval, evalScore);
                beta = Math.min(beta, evalScore);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }


    async function triggerAIMove() {
        if (gameState !== "PLAYING" || currentTurn === USER_ROLE) return;
        helperBtn.textContent = "🧠 Checking...";
        await new Promise(r => setTimeout(r, 50));
        const isMaximizing = (currentTurn === 'king');

        // =====================================
        // 🛡️ EMERGENCY BLOCK: LOCKED PAWN LOGIC
        // =====================================
        if (!isMaximizing) { 
            const pStk = pawnStacks;
            const kPos = kingPositions;
            if ((pStk["C3"] || 0) > 0) {
                const c3Threats = [];
                ['king1', 'king2'].forEach(k => {
                    const kLoc = parsePoint(kPos[k]);
                    const c3Loc = parsePoint("C3");
                    if (Math.abs(kLoc.row - c3Loc.row) <= 1 && Math.abs(kLoc.col - c3Loc.col) <= 1) {
                        const dr = c3Loc.row - kLoc.row;
                        const dc = c3Loc.col - kLoc.col;
                        const landRow = c3Loc.row + dr;
                        const landCol = c3Loc.col + dc;
                        const landingSpot = pointName(landCol, landRow);
                        if (landRow >= 0 && landRow < 5 && landCol >= 0 && landCol < 5) {
                            if (!isOccupiedState(landingSpot, pStk, kPos)) c3Threats.push(landingSpot);
                        }
                    }
                });

                if (c3Threats.length > 0) {
                    const allMoves = getAllMoves({pawnStacks, kingPositions}, 'pawn');
                    const possibleSaviors = allMoves.filter(m => c3Threats.includes(m.to));
                    if (possibleSaviors.length > 0) {
                        // 🔥 SORT BY STACK SIZE (Big Stack First)
                        possibleSaviors.sort((a, b) => (pStk[b.from] || 1) - (pStk[a.from] || 1));
                        const bestSavior = possibleSaviors[0];
                        console.log(`🛡️ SMART BLOCK: ${bestSavior.from} -> ${bestSavior.to}`);
                        await executeMoveLogic(bestSavior.from, bestSavior.to, bestSavior.piece, bestSavior.king, bestSavior.mid);
                        showAIMoveLine(bestSavior.from, bestSavior.to);
                        helperBtn.textContent = "🎯 Helper";
                        return; 
                    }
                }
            }
        }
        
        // ⚡ OPENING BOOK
        if (!isMaximizing && movesPlayed < 2) {
            const allMoves = getAllMoves({pawnStacks, kingPositions}, 'pawn');
            const c3Move = allMoves.find(m => m.to === "C3");
            if (c3Move) {
                console.log("⚡ OPENING: Taking C3");
                await executeMoveLogic(c3Move.from, c3Move.to, c3Move.piece, c3Move.king, c3Move.mid);
                showAIMoveLine(c3Move.from, c3Move.to);
                helperBtn.textContent = "🎯 Helper";
                return;
            }
        }

        // --- NORMAL MINIMAX ---
        helperBtn.textContent = "🧠 Deep Thinking...";
        const currentState = {
            pawnStacks: {...pawnStacks},
            kingPositions: {...kingPositions},
            movesPlayed: movesPlayed
        };

        let bestMove;
        if (Math.random() < AI_RANDOMNESS) {
            const moves = getAllMoves(currentState, currentTurn);
            bestMove = moves[Math.floor(Math.random() * moves.length)];
        } else {
            bestMove = findBestMove(currentState, AI_DEPTH, isMaximizing);
        }

        if (bestMove) {
            // Memory Update
            previousAiMove = { from: bestMove.from, to: bestMove.to }; 
            console.log(`✅ AI SELECTED: ${bestMove.from} -> ${bestMove.to}`);
            await executeMoveLogic(bestMove.from, bestMove.to, bestMove.piece, bestMove.king, bestMove.mid);
            showAIMoveLine(bestMove.from, bestMove.to);
        } else {
            console.log("❌ AI Resigns");
        }
        helperBtn.textContent = "🎯 Helper";
    }

    // ==========================================
    // 6. EXECUTION HANDLERS
    // ==========================================
    async function executeUserMove(from, to, type, kingName=null, midPoint=null) {
        clearHighlights();
        clearAIMoveLine();
        await executeMoveLogic(from, to, type, kingName, midPoint);
    }

    async function executeMoveLogic(from, to, type, kingName=null, midPoint=null) {
        console.log(`🚀 Move: ${type} ${from} -> ${to}`);
        await animateMove(from, to, type, 500);
        saveGameState();
        if (pawnStacks) {
            const signature = getBoardSignature(pawnStacks, kingPositions);
            recentBoardHistory.push(signature);
            if (recentBoardHistory.length > 12) recentBoardHistory.shift(); // Keep last 12 moves
        }
        if (type === 'pawn') {
            const currentStack = pawnStacks[from] || 0;
            if (currentStack > 0) {
                pawnStacks[from]--;
                if (pawnStacks[from] === 0) delete pawnStacks[from];
                pawnStacks[to] = (pawnStacks[to] || 0) + 1;
                selectedPawn = null;
            } else {
                console.error("❌ ERROR: Source Pawn Empty", from);
                location.reload();
                return;
            }
        } else {
            kingPositions[kingName] = to;
            if (midPoint) {
                pawnStacks[midPoint]--;
                if (pawnStacks[midPoint] === 0) delete pawnStacks[midPoint];
                playAudio(PAWN_KILL_SOUND);
                vibrate([50,50]);
            }
            selectedKing = null;
        }

        movesPlayed++;
        renderAll();
        checkWinCondition();

        if (!gameOver) {
            currentTurn = (currentTurn === 'pawn') ? 'king' : 'pawn';
            helperBtn.textContent = helperEnabled ? "✅ Helper" : "🎯 Helper";
            updateStatusContainer();
            if (currentTurn !== USER_ROLE) setTimeout(triggerAIMove, 100);
        }
    }

    // ==========================================
    // 7. EVENT HANDLERS
    // ==========================================
    function handleBoardClick(point) {
        if (gameState !== "PLAYING" || isAnimating || currentTurn !== USER_ROLE) return;
        if (USER_ROLE === 'pawn') handlePawnUser(point);
        else handleKingUser(point);
    }

    function handlePawnUser(point) {
        if (hasPawn(point)) {
            clearHighlights(); selectedPawn = point; 
            highlightValidMoves(point, 'pawn'); renderAll(); return;
        }
        if (selectedPawn && isOneStepMove(selectedPawn, point) && !isOccupied(point)) {
            executeUserMove(selectedPawn, point, 'pawn');
        } else if(selectedPawn) vibrate(50);
    }

    function handleKingUser(point) {
        // 1. Agar user ne apne King par click kiya (Select karne ke liye)
        if (isKingAt(point)) {
            clearHighlights(); 
            selectedKing = (kingPositions.king1 === point) ? 'king1' : 'king2';
            highlightValidMoves(point, 'king'); 
            renderAll(); 
            return;
        }

        // 2. Agar King pehle se selected hai aur user ne nayi jagah click ki
        if (selectedKing) {
            const start = kingPositions[selectedKing];

            // A. NORMAL MOVE (1 Step)
            // Check: Sirf 1 step door ho AUR jagah khali ho
            if (isOneStepMove(start, point) && !isOccupied(point)) {
                executeUserMove(start, point, 'king', selectedKing);
                return;
            }

            // B. JUMP MOVE (Kill) - 🔥 BUG FIXED HERE 🔥
            const mid = isValidKingJump(start, point);
            
            // Purana Code: if (mid && hasPawn(mid)) { ... } -> GALAT THA
            // Naya Code: Check karo ki beech mein dushman hai AUR Landing Spot khali hai
            if (mid && hasPawn(mid) && !isOccupied(point)) { 
                executeUserMove(start, point, 'king', selectedKing, mid);
                return;
            }
        }

        // Agar galat jagah click kiya (Invalid Move)
        if (selectedKing) vibrate(50);
    }
    // 8. RENDERING & ANIMATION
    // ==========================================
    function renderAll() {
        piecesGroup.innerHTML = "";
        const circles = pointsGroup.querySelectorAll('circle');
        circles.forEach(c => {
            const point = c.dataset.point;
            c.setAttribute("fill", "rgba(255,255,255,0.01)");
            if (point === selectedPawn || (selectedKing && kingPositions[selectedKing] === point)) {
                c.setAttribute("fill", "rgba(1, 114, 16, 0.64)");
            }
        });

        for(let p in pawnStacks) {
            if(pawnStacks[p] > 0) {
                const {x, y} = pointToCoord(p);
                const g = document.createElementNS("http://www.w3.org/2000/svg","g");
                g.setAttribute("pointer-events", "none");
                const txt = document.createElementNS("http://www.w3.org/2000/svg","text");
                txt.setAttribute("x", x); txt.setAttribute("y", y);
                txt.setAttribute("font-size", "54"); txt.setAttribute("text-anchor", "middle"); txt.setAttribute("dominant-baseline", "middle");
                txt.setAttribute("fill", (p === selectedPawn) ? "#4ade80" : "#003600");
                txt.textContent = "♟️";
                g.appendChild(txt);
                if(pawnStacks[p] > 1) {
                    const cnt = document.createElementNS("http://www.w3.org/2000/svg","text");
                    cnt.setAttribute("x", x+20); cnt.setAttribute("y", y-4);
                    cnt.setAttribute("font-size", "20"); cnt.setAttribute("fill", "blue"); cnt.setAttribute("font-weight", "bold");
                    cnt.textContent = pawnStacks[p];
                    g.appendChild(cnt);
                }
                piecesGroup.appendChild(g);
            }
        }
        
        Object.entries(kingPositions).forEach(([k, pos]) => {
            if(pos){
                const {x, y} = pointToCoord(pos);
                const txt = document.createElementNS("http://www.w3.org/2000/svg","text");
                txt.setAttribute("x", x); txt.setAttribute("y", y);
                txt.setAttribute("font-size", "64"); txt.setAttribute("text-anchor", "middle"); txt.setAttribute("dominant-baseline", "middle");
                txt.setAttribute("pointer-events", "none"); txt.setAttribute("fill", "black");
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

    function processAnimQueue() {
        if(isAnimating || animationQueue.length===0) return;
        isAnimating = true;
        const anim = animationQueue.shift();
        const f = pointToCoord(anim.from), t = pointToCoord(anim.to);
        
        const el = document.createElementNS("http://www.w3.org/2000/svg","text");
        el.textContent = anim.type==='pawn'?'♟️':'♚';
        el.setAttribute("font-size","50"); el.setAttribute("dominant-baseline", "middle"); el.setAttribute("text-anchor", "middle");
        el.setAttribute("class", "standing-piece");
        
        const g = document.createElementNS("http://www.w3.org/2000/svg","g");
        g.appendChild(el);
        g.setAttribute("transform", `translate(${f.x},${f.y})`);
        g.style.transition = `transform ${anim.duration}ms cubic-bezier(0.175, 0.885, 0.32, 1.275)`;
        g.classList.add("moving-piece");
        piecesGroup.appendChild(g);
        
        requestAnimationFrame(() => g.setAttribute("transform", `translate(${t.x},${t.y})`));
        
        setTimeout(()=>{
            g.remove();
            isAnimating = false;
            anim.resolve();
            processAnimQueue();
        }, anim.duration + 50);
    }

    // ==========================================
    // 9. UTILITIES
    // ==========================================
    function saveGameState() {
        undoStack.push({
            pawnStacks: JSON.parse(JSON.stringify(pawnStacks)),
            kingPositions: {...kingPositions},
            currentTurn, gameState, winAlertShown, movesPlayed
        });
        redoStack = [];
    }

    function undoMove() {
        if(undoStack.length === 0 || gameState !== "PLAYING") return;
        redoStack.push({ pawnStacks: JSON.parse(JSON.stringify(pawnStacks)), kingPositions: {...kingPositions}, currentTurn, gameState, winAlertShown, movesPlayed });
        restoreState(undoStack.pop());
        if (currentTurn !== USER_ROLE && undoStack.length > 0) {
            redoStack.push({ pawnStacks: JSON.parse(JSON.stringify(pawnStacks)), kingPositions: {...kingPositions}, currentTurn, gameState, winAlertShown, movesPlayed });
            restoreState(undoStack.pop());
        }
        vibrate(30);
    }

    function redoMove() {
        if(redoStack.length === 0 || gameState !== "PLAYING") return;
        undoStack.push({ pawnStacks: JSON.parse(JSON.stringify(pawnStacks)), kingPositions: {...kingPositions}, currentTurn, gameState, winAlertShown, movesPlayed });
        restoreState(redoStack.pop());
        if (currentTurn !== USER_ROLE && redoStack.length > 0) {
            undoStack.push({ pawnStacks: JSON.parse(JSON.stringify(pawnStacks)), kingPositions: {...kingPositions}, currentTurn, gameState, winAlertShown, movesPlayed });
            restoreState(redoStack.pop());
        }
        vibrate(30);
    }

    function restoreState(s) {
        clearHighlights();
        pawnStacks = JSON.parse(JSON.stringify(s.pawnStacks));
        kingPositions = {...s.kingPositions};
        currentTurn = s.currentTurn;
        gameState = s.gameState;
        winAlertShown = s.winAlertShown;
        movesPlayed = s.movesPlayed || 0;
        selectedPawn=null; selectedKing=null;
        renderAll();
    }

    function checkWinCondition() {
        const total = Object.values(pawnStacks).reduce((a,b)=>a+b,0);
        const k1 = kingHasAnyMove(kingPositions.king1);
        const k2 = kingHasAnyMove(kingPositions.king2);
        
        if (total <= 5) { triggerWin("king", "Pawns exhausted. King survives!"); return true; }
        if (movesPlayed >= totalMovesLimit) { triggerWin("king", "Max Moves Reached! King Survived!"); return true; }
        if (!k1 && !k2) { triggerWin("pawn", "Kings trapped! Excellent strategy."); return true; }
        return false;
    }

    function triggerWin(winner, reason) {
        if(!gameOver) playAudio(WIN_SOUND);
        gameState = "GAME_OVER"; gameOver = true;
        winAlertShown = true;
        updateStatusContainer();
        setTimeout(() => showGameOverBox(winner, reason), 500);
    }

    function showGameOverBox(winner, reason) {
        const modal = document.getElementById("gameOverModal");
        if(!modal) { alert(reason); return; }
        const title = document.getElementById("winTitle");
        const msg = document.getElementById("winMessage");
        const icon = document.getElementById("winIcon");
        const card = document.querySelector(".win-card");
        modal.style.display = "flex";
        if (winner === "king") {
            title.textContent = "KING WINS!"; title.style.color = "#4ade80"; msg.textContent = reason; icon.textContent = "👑";
            card.style.boxShadow = "0 0 50px rgba(74, 222, 128, 0.3)";
        } else {
            title.textContent = "PAWN WINS!"; title.style.color = "#f472b6"; msg.textContent = reason; icon.textContent = "♟️";
            card.style.boxShadow = "0 0 50px rgba(244, 114, 182, 0.3)";
        }
        vibrate([100, 50, 100]);
    }

    function highlightValidMoves(point, type) {
        if(!helperEnabled) return;
        const moves = getAllMoves({pawnStacks, kingPositions}, type);
        moves.forEach(m => {
            let match = false;
            if(type === 'king' && m.king === selectedKing) match = true;
            if(type === 'pawn' && m.from === selectedPawn) match = true;
            if(match) {
                const circles = pointsGroup.querySelectorAll('circle');
                circles.forEach(c => {
                    if(c.dataset.point === m.to) {
                        c.setAttribute("stroke", "#00ff00"); c.setAttribute("stroke-width", "3"); c.classList.add("helper-highlight");
                    }
                });
            }
        });
    }

    function clearHighlights() {
        pointsGroup.querySelectorAll("circle").forEach(c => {
            c.setAttribute("stroke", "none"); c.classList.remove("helper-highlight");
        });
    }

    function playAudio(src) {
        if (isMuted) return;
        try { const a = new Audio(src); a.volume = 0.6; a.play().catch(e => {}); } catch(e) {}
    }
    
    function vibrate(pat) { if(navigator.vibrate) navigator.vibrate(pat); }
    
    function updateStatusContainer() {
        const total = Object.values(pawnStacks).reduce((a,b)=>a+b,0);
        document.getElementById("pawnCount").textContent = total;
        const k1 = kingHasAnyMove(kingPositions.king1);
        const k2 = kingHasAnyMove(kingPositions.king2);
        
        document.getElementById("king1Status").className = `status-value ${k1 ? "safe" : "blocked"}`;
        document.getElementById("king1Status").textContent = k1 ? "SAFE" : "BLOCKED";
        
        document.getElementById("king2Status").className = `status-value ${k2 ? "safe" : "blocked"}`;
        document.getElementById("king2Status").textContent = k2 ? "SAFE" : "BLOCKED";

        const turnEl = document.getElementById("turnIndicator");
        if(turnEl) {
            if (gameState === "GAME_OVER") {
                turnEl.textContent = "🏁 FINISHED"; turnEl.style.color = "white";
            } else if (currentTurn === 'pawn') {
                turnEl.textContent = "♟️ PAWN"; turnEl.style.color = "#4ade80";
            } else {
                turnEl.textContent = "👑 KING"; turnEl.style.color = "#f472b6";
            }
        }

        const moveEl = document.getElementById("moveCount");
        if(moveEl) {
            const left = totalMovesLimit - movesPlayed;
            moveEl.textContent = left;
            if (left <= 20) { moveEl.style.color = "#ff4444"; moveEl.style.animation = "pulse 1s infinite"; }
            else { moveEl.style.color = "cyan"; moveEl.style.animation = "none"; }
        }
    }

    function showAIMoveLine(from, to) {
        const group = document.getElementById("aiMoveGroup");
        group.innerHTML = "";
        const f = pointToCoord(from), t = pointToCoord(to);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", f.x); line.setAttribute("y1", f.y);
        line.setAttribute("x2", t.x); line.setAttribute("y2", t.y);
        line.setAttribute("class", "ai-trail-line");
        group.appendChild(line);
    }

    function clearAIMoveLine() {
        const group = document.getElementById("aiMoveGroup");
        if(group) group.innerHTML = "";
    }

    // ==========================================
    // 10. INITIALIZATION
    // ==========================================
    for(let row = 0; row < 5; row++) {
        for(let col = 0; col < 5; col++) {
            const cx = col * size, cy = row * size;
            const point = pointName(col, row);
            const circle = document.createElementNS("http://www.w3.org/2000/svg","circle");
            circle.setAttribute("cx", cx); circle.setAttribute("cy", cy); circle.setAttribute("r", "40");
            circle.setAttribute("fill", "rgba(255,255,255,0.01)");
            circle.style.cursor = "pointer";
            circle.dataset.point = point;
            circle.addEventListener("pointerdown", (e) => { e.preventDefault(); handleBoardClick(point); });
            pointsGroup.appendChild(circle);
        }
    }

    cols.forEach((c, i) => {
        const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
        t.setAttribute("x", i * size); t.setAttribute("y", -35); t.setAttribute("font-size", "25"); t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", "#333"); t.setAttribute("font-weight", "bold"); t.setAttribute("class", "point-label"); t.style.pointerEvents = "none";
        t.textContent = c; pointsGroup.appendChild(t);
    });

    for(let r=0; r<5; r++){
        const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
        t.setAttribute("x", -35); t.setAttribute("y", r * size + 8); t.setAttribute("font-size", "25"); t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", "#333"); t.setAttribute("font-weight", "bold"); t.setAttribute("class", "point-label"); t.style.pointerEvents = "none";
        t.textContent = r+1; pointsGroup.appendChild(t);
    }

    document.getElementById("undoBtn").addEventListener("pointerdown", undoMove);
    document.getElementById("redoBtn").addEventListener("pointerdown", redoMove);
    document.getElementById("resetBtn").addEventListener("pointerdown", () => { clearHighlights(); clearAIMoveLine(); location.reload(); });
    document.getElementById("helperBtn").addEventListener("pointerdown", function() {
        helperEnabled = !helperEnabled; this.textContent = helperEnabled ? "✅ Helper" : "🎯 Helper"; this.classList.toggle("helper-on");
    });

    

    renderAll();
    if (USER_ROLE === 'king') setTimeout(triggerAIMove, 1000);
});