// @ts-check

export const WORLD = Object.freeze({
  width: 1280,
  height: 720,
  margin: 72,
  playerRadius: 13,
  fixedStepMs: 1000 / 60,
});

export const SECTORS = Object.freeze([
  { id: 1, target: 4, enemyBudget: 4, enemyMix: ['wisp'], label: 'ENTRY VECTOR', sub: 'Learn the thread. Close the loop.' },
  { id: 2, target: 6, enemyBudget: 6, enemyMix: ['wisp', 'wisp', 'striker'], label: 'CROSS TALK', sub: 'Chain clean seals before the field closes in.' },
  { id: 3, target: 7, enemyBudget: 8, enemyMix: ['wisp', 'striker', 'sentinel'], label: 'DEAD CHANNEL', sub: 'Ranged pressure makes route choice matter.' },
  { id: 4, target: 9, enemyBudget: 10, enemyMix: ['wisp', 'striker', 'sentinel', 'striker'], label: 'REDLINE', sub: 'Keep the chain alive under maximum pressure.' },
  { id: 5, target: 0, enemyBudget: 5, enemyMix: ['wisp', 'striker'], label: 'NULL CORE', sub: 'Three locks. Three core cages. End it.' },
]);

export const DEFAULT_SETTINGS = Object.freeze({
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.85,
  quality: 'high',
  cameraShake: true,
  reducedMotion: false,
  highContrast: false,
  uiScale: 1,
});

export const PALETTE = Object.freeze({
  bg: '#05080f',
  grid: '#16374b',
  cyan: '#72f6ff',
  cyanSoft: '#17bed1',
  magenta: '#ff4fa3',
  amber: '#ffb34d',
  danger: '#ff5d6c',
  white: '#effdff',
});
