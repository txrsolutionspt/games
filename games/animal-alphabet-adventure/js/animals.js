export const ANIMALS = [
  { letter: 'A', name: 'Alligator', emoji: '🐊', color: '#4CAF50', bg: '#C8E6C9' },
  { letter: 'B', name: 'Bear',      emoji: '🐻', color: '#795548', bg: '#D7CCC8' },
  { letter: 'C', name: 'Cat',       emoji: '🐱', color: '#FF9800', bg: '#FFE0B2' },
  { letter: 'D', name: 'Dog',       emoji: '🐶', color: '#FF5722', bg: '#FFCCBC' },
  { letter: 'E', name: 'Elephant',  emoji: '🐘', color: '#607D8B', bg: '#CFD8DC' },
  { letter: 'F', name: 'Fox',       emoji: '🦊', color: '#E64A19', bg: '#FFCCBC' },
  { letter: 'G', name: 'Giraffe',   emoji: '🦒', color: '#F57F17', bg: '#FFF9C4' },
  { letter: 'H', name: 'Horse',     emoji: '🐴', color: '#6D4C41', bg: '#EFEBE9' },
  { letter: 'L', name: 'Lion',      emoji: '🦁', color: '#F9A825', bg: '#FFF8E1' },
  { letter: 'M', name: 'Monkey',    emoji: '🐒', color: '#8D6E63', bg: '#EFEBE9' },
  { letter: 'O', name: 'Owl',       emoji: '🦉', color: '#5D4037', bg: '#D7CCC8' },
  { letter: 'P', name: 'Penguin',   emoji: '🐧', color: '#263238', bg: '#ECEFF1' },
  { letter: 'R', name: 'Rabbit',    emoji: '🐰', color: '#E91E63', bg: '#FCE4EC' },
  { letter: 'T', name: 'Turtle',    emoji: '🐢', color: '#2E7D32', bg: '#C8E6C9' },
  { letter: 'Z', name: 'Zebra',     emoji: '🦓', color: '#37474F', bg: '#ECEFF1' },
];

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function getChoices(correct, count) {
  const others = shuffle(ANIMALS.filter(a => a.letter !== correct.letter));
  return shuffle([correct, ...others.slice(0, count - 1)]);
}

export function pickRandom(excluding = []) {
  const pool = ANIMALS.filter(a => !excluding.includes(a.letter));
  if (pool.length === 0) return ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}
