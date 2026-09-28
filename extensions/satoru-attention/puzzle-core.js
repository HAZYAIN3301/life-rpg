/* Satoru Attention 0.10.0 — pure chess-puzzle logic for the doomscroll boundary.
 * No legality engine is needed: a puzzle is solved only by the exact Lichess solution moves, so
 * the board only has to show positions and apply known moves (castling, en passant, promotion).
 * Contract shared with native: PUZZLES-CONTRACT.md.
 */
(function exposePuzzleCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SatoruPuzzleCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildPuzzleCore() {
  'use strict';

  const TIERS = Object.freeze(['normal', 'hard', 'brutal']);
  const FILES = 'abcdefgh';
  const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

  // board[rank][file], rank 0 = 8th rank (as in FEN). Pieces: FEN letters, '' for empty.
  function parseFen(fen) {
    const [placement, side, castling, enPassant] = String(fen || '').split(' ');
    const rows = (placement || '').split('/');
    if (rows.length !== 8) throw new Error('fen_invalid');
    const board = rows.map((row) => {
      const cells = [];
      for (const ch of row) {
        if (/[1-8]/.test(ch)) for (let i = 0; i < Number(ch); i += 1) cells.push('');
        else if (/[pnbrqkPNBRQK]/.test(ch)) cells.push(ch);
        else throw new Error('fen_invalid');
      }
      if (cells.length !== 8) throw new Error('fen_invalid');
      return cells;
    });
    return { board, side: side === 'b' ? 'b' : 'w', castling: castling || '-', enPassant: enPassant || '-' };
  }

  function square(name) {
    return { file: FILES.indexOf(name[0]), rank: 8 - Number(name[1]) };
  }

  function colorOf(piece) { return piece ? (piece === piece.toUpperCase() ? 'w' : 'b') : null; }

  // Applies a UCI move to a position (returns a new position). Moves come from the solution, so
  // only the special cases need care: castling rook, en-passant capture, promotion.
  function applyMove(position, uci) {
    if (!UCI.test(uci)) throw new Error('move_invalid');
    const board = position.board.map((row) => row.slice());
    const from = square(uci.slice(0, 2)); const to = square(uci.slice(2, 4));
    const piece = board[from.rank][from.file];
    if (!piece) throw new Error('move_from_empty');
    const lower = piece.toLowerCase();
    if (lower === 'k' && Math.abs(to.file - from.file) === 2) {
      const rookFrom = to.file > from.file ? 7 : 0; const rookTo = to.file > from.file ? 5 : 3;
      board[from.rank][rookTo] = board[from.rank][rookFrom]; board[from.rank][rookFrom] = '';
    }
    if (lower === 'p' && from.file !== to.file && !board[to.rank][to.file]) board[from.rank][to.file] = '';
    board[from.rank][from.file] = '';
    const promotion = uci[4];
    board[to.rank][to.file] = promotion ? (colorOf(piece) === 'w' ? promotion.toUpperCase() : promotion) : piece;
    return { ...position, board, side: position.side === 'w' ? 'b' : 'w' };
  }

  function pick(dataset, tier, random = Math.random) {
    const list = dataset && dataset.puzzles && dataset.puzzles[TIERS.includes(tier) ? tier : 'hard'];
    if (!Array.isArray(list) || !list.length) return null;
    const [id, fen, moves, rating] = list[Math.floor(random() * list.length) % list.length];
    return { id, fen, moves: moves.split(' '), rating };
  }

  // What the page may know: the start position after the opponent's first move, whose turn it is
  // and the rating — never the remaining solution.
  function publicStart(puzzle) {
    const start = applyMove(parseFen(puzzle.fen), puzzle.moves[0]);
    return { id: puzzle.id, fen: puzzle.fen, opening: puzzle.moves[0], player: start.side, rating: puzzle.rating,
      playerMoves: (puzzle.moves.length - 1 + 1) >> 1 };
  }

  // ply is the index in moves of the move the player must make now (1, 3, 5 …).
  function checkMove(puzzle, ply, uci) {
    const expected = puzzle.moves[ply];
    if (!expected || ply % 2 !== 1) return { ok: false, error: 'puzzle_state_invalid' };
    const move = String(uci || '').toLowerCase();
    // A promotion is judged by the square; a missing piece letter means the default queen.
    const correct = move === expected || (expected.length === 5 && move.length === 4 && `${move}q` === expected);
    if (!correct) return { ok: true, correct: false, expected };
    const reply = puzzle.moves[ply + 1] || null;
    return { ok: true, correct: true, reply, nextPly: reply ? ply + 2 : null, solved: !reply };
  }

  return Object.freeze({ TIERS, parseFen, applyMove, pick, publicStart, checkMove, colorOf });
});
