import './game/ui/ui.css';
import { Game } from './game/core/game';

const stage = document.getElementById('stage');
if (!stage) throw new Error('Missing #stage');

const game = new Game(stage);
(window as unknown as { __tide: Game }).__tide = game;
game.start().catch((err: unknown) => {
  console.error('Tidewalker failed to start', err);
});
