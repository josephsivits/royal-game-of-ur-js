/**
 * Royal Game of Ur - Headless Engine
 * Finkel Ruleset implementation
 */

class Game {
  // Game Constants
  static ROSETTES = [4, 8, 14];
  static SHARED_PATH = [5, 6, 7, 8, 9, 10, 11, 12];
  static MAX_STEPS = 14;
  static PIECES_PER_PLAYER = 7;

  constructor() {
    this.reset();
  }

  /**
   * Initializes or resets the game state
   */
  reset() {
    this.players = {
      1: {
        pieces: Array(Game.PIECES_PER_PLAYER).fill(0), // 0 is start, 1-14 board, 15 is finished
        score: 0
      },
      2: {
        pieces: Array(Game.PIECES_PER_PLAYER).fill(0),
        score: 0
      }
    };
    this.currentTurn = 1; // Player 1 (Blue) starts
    this.diceResult = null;
    this.gameState = 'rolling'; // 'rolling' or 'moving' or 'finished'
    this.winner = null;
    this.lastRoll = null;
    this.history = [];
  }

  /**
   * Simulates rolling 4 tetrahedral dice (binary 0 or 1)
   * Probability Distribution (Binomial Distribution n=4, p=0.5):
   * 0: 1/16 (6.25%)
   * 1: 4/16 (25%)
   * 2: 6/16 (37.5%)
   * 3: 4/16 (25%)
   * 4: 1/16 (6.25%)
   * @returns {number} The sum of the roll (0-4)
   */
  rollDice() {
    if (this.gameState !== 'rolling') {
      throw new Error("Cannot roll now. Current state: " + this.gameState);
    }

    // Roll 4 binary dice
    const dice = Array.from({ length: 4 }, () => Math.round(Math.random()));
    const roll = dice.reduce((a, b) => a + b, 0);
    
    this.diceResult = roll;
    this.lastRoll = dice;

    if (roll === 0) {
      // Roll of 0 is an immediate turn change
      this.gameState = 'rolling';
      this.currentTurn = this.currentTurn === 1 ? 2 : 1;
    } else {
      // Check if any moves are possible
      const validMoves = this.getValidMoves(this.currentTurn, roll);
      
      if (validMoves.length === 0) {
        // No moves available, skip turn
        this.gameState = 'rolling';
        this.currentTurn = this.currentTurn === 1 ? 2 : 1;
      } else {
        // Player must move
        this.gameState = 'moving';
      }
    }

    return roll;
  }

  /**
   * Gets all valid piece IDs for the current player and roll
   * @param {number} player 1 or 2
   * @param {number} roll 1-4
   * @returns {number[]} Array of piece IDs (0-6) that can move
   */
  getValidMoves(player, roll) {
    if (roll === 0 || roll === null) return [];

    const validPieceIds = [];
    const playerState = this.players[player];
    const opponent = player === 1 ? 2 : 1;
    const opponentState = this.players[opponent];

    playerState.pieces.forEach((currentPos, pieceId) => {
      // 1. Piece must not have finished
      if (currentPos === Game.MAX_STEPS + 1) return;

      const targetPos = currentPos + roll;

      // 2. Must not exceed the board (exact roll to finish is targetPos = 15)
      if (targetPos > Game.MAX_STEPS + 1) return;

      // 3. Target position checks
      if (targetPos <= Game.MAX_STEPS) {
        // Cannot land on your own piece
        const ownPieceAtTarget = playerState.pieces.some(p => p === targetPos);
        if (ownPieceAtTarget) return;

        // Shared lane checks (5-12)
        if (Game.SHARED_PATH.includes(targetPos)) {
          // Check for opponent piece
          const opponentPieceAtTarget = opponentState.pieces.some(p => p === targetPos);
          
          if (opponentPieceAtTarget) {
            // Cannot capture (land on) an opponent on the center rosette (pos 8)
            if (targetPos === 8) {
              return;
            }
          }
        }
      }

      // If we got here, the move is valid
      validPieceIds.push(pieceId);
    });

    return validPieceIds;
  }

  /**
   * Moves a piece
   * @param {number} pieceId 0-6
   * @param {number} roll Optional roll override (defaults to current dice result)
   * @returns {object} Result of the move
   */
  movePiece(pieceId, roll = this.diceResult) {
    if (this.gameState !== 'moving' && !roll) {
      throw new Error("Cannot move now. Roll the dice first.");
    }

    const player = this.currentTurn;
    const opponent = player === 1 ? 2 : 1;
    
    // Validate move again for safety
    const validMoves = this.getValidMoves(player, roll);
    if (!validMoves.includes(pieceId)) {
      throw new Error(`Invalid move for piece ${pieceId} with roll ${roll}`);
    }

    const currentPos = this.players[player].pieces[pieceId];
    const targetPos = currentPos + roll;

    let capturedPieceId = null;

    // Handle movement
    if (targetPos <= Game.MAX_STEPS) {
      // Check for capture in shared lane
      if (Game.SHARED_PATH.includes(targetPos)) {
        const opponentPieceIdx = this.players[opponent].pieces.findIndex(p => p === targetPos);
        if (opponentPieceIdx !== -1) {
          // Capture! Send opponent piece back to start (0)
          this.players[opponent].pieces[opponentPieceIdx] = 0;
          capturedPieceId = opponentPieceIdx;
        }
      }
      
      this.players[player].pieces[pieceId] = targetPos;
    } else {
      // Piece finished (targetPos === 15)
      this.players[player].pieces[pieceId] = Game.MAX_STEPS + 1;
      this.players[player].score++;
    }

    // Check for win condition
    if (this.players[player].score === Game.PIECES_PER_PLAYER) {
      this.winner = player;
      this.gameState = 'finished';
    }

    // Handle Turn Change vs Rosette (Extra Turn)
    const hitRosette = Game.ROSETTES.includes(targetPos);
    
    if (this.winner) {
       // Game Over
    } else if (hitRosette) {
      // Landed on Rosette: Player keeps turn, rolls again
      this.gameState = 'rolling';
      this.diceResult = null;
    } else {
      // Normal turn end: Switch to opponent
      this.gameState = 'rolling';
      this.diceResult = null;
      this.currentTurn = opponent;
    }

    const result = {
      player,
      pieceId,
      from: currentPos,
      to: targetPos,
      captured: capturedPieceId !== null,
      capturedPieceId,
      extraTurn: hitRosette,
      winner: this.winner
    };

    this.history.push(result);
    return result;
  }

  /**
   * Utility for external UI to get current state
   */
  getState() {
    return {
      players: JSON.parse(JSON.stringify(this.players)), // Deep copy
      currentTurn: this.currentTurn,
      diceResult: this.diceResult,
      gameState: this.gameState,
      winner: this.winner,
      // Only calculate valid moves if we are in 'moving' state to save perf
      validMoves: this.gameState === 'moving' ? this.getValidMoves(this.currentTurn, this.diceResult) : [],
      rosettes: Game.ROSETTES,
      sharedPath: Game.SHARED_PATH
    };
  }
}
