class GameUI {
  constructor() {
    this.game = new Game();
    this.audioCtx = null; // Web Audio Context
    this.initializeElements();
    this.setupEventListeners();
    this.updateDisplay();
  }

  // Simple Synthesized Beep
  playTone(freq = 440, type = 'sine', duration = 0.1) {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
    
    gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    
    osc.start();
    osc.stop(this.audioCtx.currentTime + duration);
  }

  initializeElements() {
    // Board squares
    this.squares = document.querySelectorAll('.square');
    
    // Controls
    this.rollButton = document.getElementById('roll-button');
    this.turnIndicator = document.getElementById('turn-indicator');
    this.turnText = document.getElementById('turn-text');
    this.dicePanel = document.querySelector('.dice-panel'); // Added reference
    
    // Dice
    this.dice = [
      document.querySelector('#die-0 .die-value'),
      document.querySelector('#die-1 .die-value'),
      document.querySelector('#die-2 .die-value'),
      document.querySelector('#die-3 .die-value')
    ];
    this.sumDie = document.querySelector('#die-sum .die-value');
    
    // Scores
    this.blueScore = document.getElementById('blue-score');
    this.redScore = document.getElementById('red-score');
    
    // Off-board pieces
    this.blueOffBoard = document.getElementById('blue-off-board');
    this.redOffBoard = document.getElementById('red-off-board');
    this.blueCount = document.getElementById('blue-count');
    this.redCount = document.getElementById('red-count');
  }

  setupEventListeners() {
    this.rollButton.addEventListener('click', () => this.handleRoll());
    
    // Add click listeners to board squares
    this.squares.forEach(square => {
      square.addEventListener('click', () => {
        const pos = parseInt(square.dataset.pos);
        const player = square.dataset.player ? parseInt(square.dataset.player) : null;
        this.handleSquareClick(pos, player);
      });
    });
    
    // Add click listeners to off-board piles (to enter pieces)
    this.blueOffBoard.addEventListener('click', () => this.handleOffBoardClick(1));
    this.redOffBoard.addEventListener('click', () => this.handleOffBoardClick(2));

    // Keyboard accessibility for off-board buttons
    const onOffboardKey = (playerNum) => (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.handleOffBoardClick(playerNum);
      }
    };

    this.blueOffBoard.addEventListener('keydown', onOffboardKey(1));
    this.redOffBoard.addEventListener('keydown', onOffboardKey(2));
  }

  handleRoll() {
    if (this.game.gameState !== 'rolling') return;
    
    // Resume audio context if needed
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    try {
      const roll = this.game.rollDice();
      
      // Animate Dice sequentially
      const diceValues = this.game.lastRoll;
      
      // Reset Dice Display first
      this.dice.forEach(d => {
        d.textContent = '';
        d.parentElement.classList.remove('active', 'rolling');
      });
      this.sumDie.textContent = '';
      this.sumDie.parentElement.classList.remove('active');

      // Sequential Animation
      diceValues.forEach((val, idx) => {
        setTimeout(() => {
          const dieEl = this.dice[idx].parentElement;
          dieEl.classList.add('active', 'rolling'); // Invert color + green glow
          this.dice[idx].textContent = val;
          this.playTone(600 + (idx * 50), 'triangle', 0.1); // Rising pitch
          
          // Remove glow after short delay but keep active (inverted)
          setTimeout(() => dieEl.classList.remove('rolling'), 200);
          
        }, idx * 200);
      });

      // Show Sum after individual dice
      setTimeout(() => {
        this.sumDie.parentElement.classList.add('active', 'rolling');
        this.sumDie.textContent = roll;
        this.playTone(800, 'sine', 0.3); // High pitch for sum
        
        setTimeout(() => this.sumDie.parentElement.classList.remove('rolling'), 300);
        
        // Final UI Update (enables moves)
        this.updateDisplay(true); // pass flag to keep dice active
      }, diceValues.length * 200 + 100);

    } catch (error) {
      console.error('Roll error:', error);
    }
  }

  handleOffBoardClick(playerNum) {
    const state = this.game.getState();
    if (state.currentTurn !== playerNum || state.gameState !== 'moving') return;

    // Find the first piece that is at position 0 (off-board) AND is a valid move
    const validPieceIndex = state.players[playerNum].pieces.findIndex(
        (pos, idx) => pos === 0 && state.validMoves.includes(idx)
    );

    if (validPieceIndex !== -1) {
      this.movePiece(validPieceIndex);
    }
  }

  handleSquareClick(pos, player) {
    const state = this.game.getState();
    
    if (state.gameState !== 'moving') return;
    
    const currentPlayer = state.currentTurn;
    const validMoves = state.validMoves;
    
    // If clicking on a square with a piece, try to move that piece
    // We match if the square belongs to the current player OR is shared
    if (player === currentPlayer || player === null) {
      const pieces = state.players[currentPlayer].pieces;
      
      // Find piece on this square that is valid to move
      const pieceId = pieces.findIndex((piecePos, idx) => piecePos === pos && validMoves.includes(idx));
      
      if (pieceId !== -1) {
        this.movePiece(pieceId);
      }
    }
  }

  movePiece(pieceId) {
    try {
      const result = this.game.movePiece(pieceId);
      this.updateDisplay();
      
      if (result.captured) {
        // Animation for capture could go here
      }
      
      if (result.winner) {
        setTimeout(() => alert(`Player ${result.winner === 1 ? 'Blue' : 'Red'} wins!`), 100);
      }
    } catch (error) {
      console.error('Move error:', error);
    }
  }

  updateDiceDisplay(keepActive = false) {
    const state = this.game.getState();
    
    // If there is no meaningful dice result (either no roll yet, or the previous
    // roll has been consumed / was a zero), show neutral dice tied to the
    // current player's color and clear any active styling.
    if (!this.game.lastRoll || state.diceResult === null || state.diceResult === 0) {
      this.dice.forEach(die => {
        die.textContent = '0';
        die.parentElement.classList.remove('active', 'rolling');
      });
      this.sumDie.textContent = '0';
      this.sumDie.parentElement.classList.remove('active', 'rolling');
      return;
    }

    // Otherwise, we have an active non-zero roll to display.
    this.game.lastRoll.forEach((value, idx) => {
      this.dice[idx].textContent = value;
    });
    this.sumDie.textContent = state.diceResult;
    
    // When simply refreshing state (not in the middle of the roll animation),
    // drop the "active" styling so dice revert to their neutral appearance.
    if (!keepActive) {
      this.dice.forEach(d => d.parentElement.classList.remove('active', 'rolling'));
      this.sumDie.parentElement.classList.remove('active', 'rolling');
    }
  }

  updateDisplay(keepDiceActive = false) {
    const state = this.game.getState();
    
    // 1. Update Turn Indicator
    if (state.currentTurn === 1) {
      this.turnIndicator.classList.remove('red-turn');
      this.turnIndicator.classList.add('blue-turn');
      this.turnText.textContent = 'BLUE TURN';
    } else {
      this.turnIndicator.classList.remove('blue-turn');
      this.turnIndicator.classList.add('red-turn');
      this.turnText.textContent = 'RED TURN';
    }

    // Keep dice color aligned with the player whose turn it is (Blue or Red),
    // so the fill/outline color always matches the current turn indicator.
    this.dicePanel.classList.toggle('red-turn', state.currentTurn === 2);
    
    // 2. Update Roll Button
    this.rollButton.disabled = state.gameState !== 'rolling';
    
    // 3. Update Scores
    this.blueScore.textContent = state.players[1].score;
    this.redScore.textContent = state.players[2].score;
    
    // 4. Update Board Pieces
    // Clear existing pieces
    this.squares.forEach(square => {
      const pieces = square.querySelectorAll('.piece');
      pieces.forEach(p => p.remove());
      square.classList.remove('valid-move');
    });
    
    // Render pieces
    [1, 2].forEach(playerNum => {
      const player = state.players[playerNum];
      const color = playerNum === 1 ? 'blue' : 'red';
      
      player.pieces.forEach((pos, pieceId) => {
        if (pos === 0 || pos === 15) return; // Off-board or finished
        
        // Find the DOM element for this position
        // Logic: 
        // - Shared squares (5-12) have no data-player
        // - Private squares have data-player matching playerNum
        const square = Array.from(this.squares).find(s => {
          const sPos = parseInt(s.dataset.pos);
          const sPlayer = s.dataset.player ? parseInt(s.dataset.player) : null;
          
          if (sPos === pos) {
            if (sPlayer === playerNum) return true; // Private match
            if (sPlayer === null && pos >= 5 && pos <= 12) return true; // Shared match
          }
          return false;
        });
        
        if (square) {
          const piece = document.createElement('div');
          piece.className = `piece ${color}-piece`;
          piece.dataset.pieceId = pieceId; // for debug/reference
          square.appendChild(piece);
          
          // Highlight if valid move
          if (state.gameState === 'moving' && 
              state.currentTurn === playerNum && 
              state.validMoves.includes(pieceId)) {
            square.classList.add('valid-move');
          }
        }
      });
    });
    
    // 5. Update Off-board Counts & Highlights
    const blueOff = state.players[1].pieces.filter(p => p === 0).length;
    const redOff = state.players[2].pieces.filter(p => p === 0).length;
    
    this.blueCount.textContent = `x${blueOff}`;
    this.redCount.textContent = `x${redOff}`;
    
    // Highlight off-board piles if valid to enter
    const canEnter = (pNum) => 
      state.gameState === 'moving' && 
      state.currentTurn === pNum &&
      state.players[pNum].pieces.some((pos, idx) => pos === 0 && state.validMoves.includes(idx));

    this.blueOffBoard.classList.toggle('valid-move', canEnter(1));
    this.redOffBoard.classList.toggle('valid-move', canEnter(2));
    
    this.updateDiceDisplay(keepDiceActive);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  new GameUI();
});
