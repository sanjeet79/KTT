// 🧩 PUZZLE DATA STORE
// Har level ka custom board setup yahan define hoga

window.PUZZLE_LEVELS = {
    "Beginners": {
        // Simple: 2 Pawns vs Kings (Easy Win)
        pawnStacks: { "C3": 2, "B2": 3, "B4":5, "B1":1, "C1":1,"A4":1,"A5":1,"C5":1,"B3":1}, 
        kingPositions: { king1: "A1", king2: "A3" },
        movesLimit: 2,
        solution:[ { from: "B2", to: "A2" }]
    },
    "Easy": {
        pawnStacks: { "D4": 5, "C2": 5, "B3": 5 },
        kingPositions: { king1: "E1", king2: "A5" },
        movesLimit: 15
    },
    "Medium": {
        pawnStacks: { "C3": 3, "B2": 4, "D4": 4, "A3": 2 },
        kingPositions: { king1: "A1", king2: "E5" },
        movesLimit: 20
    },
    "Hard": {
        // 1. Aapki Positioning
        pawnStacks: { 
            "C3": 2, "B2": 1, "B4": 1, "B1": 1, "C1": 1, 
            "A4": 1, "A5": 1, "C4": 1, "B3": 1, "C2": 2, // C2 do baar tha, maine 2 kar diya
            "D4": 1, "D5": 1, "E5": 1, "E3": 1, "B5": 1
        },
        kingPositions: { king1: "A1", king2: "C5" },
        movesLimit: 4,

        // 2. SCRIPTED MOVES (Player Move : King Response)
        // Format: "FROM-TO"
        scriptedMoves: {
            "C5-A3": "A1-A2" 
        },

        // 3. HINT SOLUTION
        solution: [
            { from: "B3", to: "A3" }, // Move 1
            { from: "B1", to: "A1" }  // Move 2
        ]
    },

    "Advance": {
    pawnStacks: { "C3": 1, "B2": 5, "D4": 5, "B4": 5, "D2": 5 },
    kingPositions: { king1: "A3", king2: "E3" },
    movesLimit: 25
    },

    "Expert": {
    pawnStacks: { "C3": 1, "B2": 5, "D4": 5, "B4": 5, "D2": 5 },
    kingPositions: { king1: "A3", king2: "E3" },
    movesLimit: 25
    },
    "Pro": {
    pawnStacks: { "C3": 1, "B2": 5, "D4": 5, "B4": 5, "D2": 5 },
    kingPositions: { king1: "A3", king2: "E3" },
    movesLimit: 25
    },
    "Master": {
    pawnStacks: { "C3": 1, "B2": 5, "D4": 5, "B4": 5, "D2": 5 },
    kingPositions: { king1: "A3", king2: "E3" },
    movesLimit: 25
    },
    "Pro Master": {
    pawnStacks: { "C3": 1, "B2": 5, "D4": 5, "B4": 5, "D2": 5 },
    kingPositions: { king1: "A3", king2: "E3" },
    movesLimit: 25
    },


    "Legend": {
        // Impossible Challenge: Scattered Pawns
        pawnStacks: { "A1": 1, "E5": 1, "C3": 1, "B2": 1, "D4": 1, "A5": 1, "E1": 1 },
        kingPositions: { king1: "B3", king2: "D3" },
        movesLimit: 30
    }
    // Aap baaki levels (Expert, Pro, etc.) yahan add kar sakte hain
};