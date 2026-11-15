import './game/ui/ui.css';
import { Game } from './game/core/game';

const stage = document.getElementById('stage');
const hud = document.getElementById('hud');
const ui = document.getElementById('ui');
if (!stage || !hud || !ui) throw new Error('Tidewalker: page is missing its root elements');

const game = new Game(stage, hud, ui);
// Test hook used by the end-to-end suite and automated playtests.
(window as unknown as { __tide: Game }).__tide = game;

game.start().catch((err: unknown) => {
  console.error('Tidewalker failed to start', err);
});

// Offline play: cache the built game. Skipped in development so edits always show.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
