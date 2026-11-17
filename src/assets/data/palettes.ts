import type { BiomeId } from '../../game/core/types';

/** Colour script for one biome. Everything on screen derives from these values. */
export interface Palette {
  /** Which family of painted silhouettes the backdrop uses. */
  style: 'stacks' | 'hills' | 'kelp' | 'ruins' | 'spires';
  sky: [string, string, string];
  fog: string;
  layers: [string, string, string];
  ground: number;
  groundDeep: number;
  rim: number;
  water: number;
  waterDeep: number;
  surface: number;
  /** Unlit ambient light, multiplied over the world (0..1 per channel). */
  ambient: [number, number, number];
  accent: number;
  moon: string;
}

export const PALETTES: Record<BiomeId, Palette> = {
  shallows: { style: 'stacks', sky: ['#070b1c', '#141c3d', '#2a3358'], fog: '#2c3760', layers: ['#232c52', '#161d3c', '#0c1128'], ground: 0x1c2548, groundDeep: 0x0b1024, rim: 0x9fb2e6, water: 0x1d3f66, waterDeep: 0x07142b, surface: 0xa9c8ef, ambient: [0.74, 0.8, 1], accent: 0x9fe8ff, moon: '#dfe6ff' },
  pools: { style: 'hills', sky: ['#090d2b', '#1a2659', '#3b4f8f'], fog: '#42589a', layers: ['#33457f', '#1f2c5c', '#111a3e'], ground: 0x222d60, groundDeep: 0x0e1536, rim: 0xa8bdf2, water: 0x1f5a80, waterDeep: 0x0a2140, surface: 0xd2ecff, ambient: [0.66, 0.74, 0.96], accent: 0xaef4ff, moon: '#f4f7ff' },
  kelp: { style: 'kelp', sky: ['#04101c', '#0a2836', '#11474d'], fog: '#14504f', layers: ['#0f3f43', '#0a2c33', '#051a20'], ground: 0x12353c, groundDeep: 0x061a20, rim: 0x6fd0b8, water: 0x0f5a5c, waterDeep: 0x031e24, surface: 0xa6f0dc, ambient: [0.6, 0.8, 0.84], accent: 0x8dffd6, moon: '#d8fff0' },
  ruins: { style: 'ruins', sky: ['#0b0820', '#1d1846', '#42366f'], fog: '#473a78', layers: ['#352b62', '#211a47', '#120e2b'], ground: 0x282050, groundDeep: 0x110c2a, rim: 0xb3a2ea, water: 0x2a3a7a, waterDeep: 0x0d1034, surface: 0xcfc6ff, ambient: [0.72, 0.7, 0.98], accent: 0xc9b8ff, moon: '#ece6ff' },
  storm: { style: 'stacks', sky: ['#05070f', '#0f1830', '#28324e'], fog: '#2a3654', layers: ['#1f2a48', '#131b34', '#090e20'], ground: 0x18223e, groundDeep: 0x080d1c, rim: 0xbcd0ff, water: 0x1a3a5c, waterDeep: 0x061226, surface: 0xcfe2ff, ambient: [0.66, 0.74, 0.96], accent: 0xe8f4ff, moon: '#c8d4f0' },
  coral: { style: 'spires', sky: ['#160a24', '#3a1848', '#8a3a66'], fog: '#70405f', layers: ['#5a2c58', '#3a1c44', '#200f2c'], ground: 0x3a1f4a, groundDeep: 0x180b24, rim: 0xffb0c4, water: 0x5a2a66, waterDeep: 0x1c0c2c, surface: 0xffd0e0, ambient: [0.84, 0.72, 0.86], accent: 0xff9fb8, moon: '#ffe4ee' },
  forge: { style: 'ruins', sky: ['#120606', '#3a1410', '#8a3c1c'], fog: '#5c2c1c', layers: ['#4a2018', '#2c1210', '#160808'], ground: 0x32181a, groundDeep: 0x14080a, rim: 0xffa070, water: 0x5a2418, waterDeep: 0x1c0a08, surface: 0xffc890, ambient: [0.9, 0.72, 0.64], accent: 0xffb060, moon: '#ffd8b0' },
  gardens: { style: 'kelp', sky: ['#0a0618', '#28103c', '#562a66'], fog: '#3c2a56', layers: ['#3a2054', '#24143a', '#120a20'], ground: 0x26163c, groundDeep: 0x0e0818, rim: 0xe0a0f0, water: 0x3a2060, waterDeep: 0x120a26, surface: 0xf0c8ff, ambient: [0.74, 0.68, 0.9], accent: 0xb0ffb0, moon: '#f0d8ff' },
  deep: { style: 'stacks', sky: ['#020208', '#06061a', '#10102c'], fog: '#0c0c24', layers: ['#0e0e2a', '#08081c', '#04040e'], ground: 0x101028, groundDeep: 0x040410, rim: 0x7070c0, water: 0x0c0c30, waterDeep: 0x020210, surface: 0x8888d8, ambient: [0.42, 0.42, 0.62], accent: 0x9090ff, moon: '#8888b8' },
  throne: { style: 'spires', sky: ['#081330', '#23557a', '#f0b56e'], fog: '#8a8a8e', layers: ['#4a6a86', '#284a68', '#12283f'], ground: 0x1c4060, groundDeep: 0x0c2236, rim: 0xffe0a0, water: 0x1d6f86, waterDeep: 0x0a2c40, surface: 0xfff0c8, ambient: [0.8, 0.82, 0.88], accent: 0xffd98a, moon: '#fff4d8' },
};

/** Shared light colours. Warm = alive and safe; red-violet = danger. */
export const LIGHT = {
  creatureDim: 0x9fb8c8,
  creatureWarm: 0xffd98a,
  creatureCore: 0xfff6dc,
  pool: 0xbfe9ff,
  plant: 0x9ff2e0,
  firefly: 0xffe9a8,
  shell: 0xffd0b0,
  moonglass: 0xc8f0ff,
  danger: 0xb04a9a,
  dangerEye: 0xd070c8,
  lantern: 0xffdf9a,
  kin: 0xffe6b0,
  safeCurrent: 0x8ff0ff,
  blade: 0xeaf8ff,
} as const;
