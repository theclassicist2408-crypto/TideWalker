import type { BiomeId } from '../../game/core/types';

/** Colour script for one biome. Everything on screen derives from these values. */
export interface Palette {
  /** Sky gradient stops, top to horizon. */
  sky: [string, string, string];
  /** Colour distant layers fade into. */
  fog: string;
  /** Far, mid and near silhouette colours. */
  layers: [string, string, string];
  /** Solid ground body and its moonlit rim. */
  ground: number;
  groundDeep: number;
  rim: number;
  /** Water body and surface line. */
  water: number;
  waterDeep: number;
  surface: number;
  /** Unlit ambient light, multiplied over the world (0..1 per channel). */
  ambient: [number, number, number];
  /** Accent used for plants, pools and safe things. */
  accent: number;
  moon: string;
}

export const PALETTES: Record<BiomeId, Palette> = {
  storm: {
    sky: ['#070b1c', '#141c3d', '#2a3358'],
    fog: '#2c3760',
    layers: ['#232c52', '#161d3c', '#0c1128'],
    ground: 0x1c2548,
    groundDeep: 0x0b1024,
    rim: 0x9fb2e6,
    water: 0x1d3f66,
    waterDeep: 0x07142b,
    surface: 0xa9c8ef,
    ambient: [0.74, 0.8, 1],
    accent: 0x9fe8ff,
    moon: '#dfe6ff',
  },
  pools: {
    sky: ['#090d2b', '#1a2659', '#3b4f8f'],
    fog: '#42589a',
    layers: ['#33457f', '#1f2c5c', '#111a3e'],
    ground: 0x222d60,
    groundDeep: 0x0e1536,
    rim: 0xa8bdf2,
    water: 0x1f5a80,
    waterDeep: 0x0a2140,
    surface: 0xd2ecff,
    ambient: [0.66, 0.74, 0.96],
    accent: 0xaef4ff,
    moon: '#f4f7ff',
  },
  kelp: {
    sky: ['#04101c', '#0a2836', '#11474d'],
    fog: '#14504f',
    layers: ['#0f3f43', '#0a2c33', '#051a20'],
    ground: 0x12353c,
    groundDeep: 0x061a20,
    rim: 0x6fd0b8,
    water: 0x0f5a5c,
    waterDeep: 0x031e24,
    surface: 0xa6f0dc,
    ambient: [0.6, 0.8, 0.84],
    accent: 0x8dffd6,
    moon: '#d8fff0',
  },
  ruins: {
    sky: ['#0b0820', '#1d1846', '#42366f'],
    fog: '#473a78',
    layers: ['#352b62', '#211a47', '#120e2b'],
    ground: 0x282050,
    groundDeep: 0x110c2a,
    rim: 0xb3a2ea,
    water: 0x2a3a7a,
    waterDeep: 0x0d1034,
    surface: 0xcfc6ff,
    ambient: [0.72, 0.7, 0.98],
    accent: 0xc9b8ff,
    moon: '#ece6ff',
  },
  sanctuary: {
    sky: ['#081330', '#17406a', '#e0a963'],
    fog: '#7a7f8c',
    layers: ['#4a6a86', '#284a68', '#12283f'],
    ground: 0x1c4060,
    groundDeep: 0x0c2236,
    rim: 0xffe0a0,
    water: 0x1d6f86,
    waterDeep: 0x0a2c40,
    surface: 0xfff0c8,
    ambient: [0.8, 0.82, 0.88],
    accent: 0xffd98a,
    moon: '#fff4d8',
  },
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
  lure: 0xf2c4a0,
  lantern: 0xffdf9a,
  kin: 0xffe6b0,
  safeCurrent: 0x8ff0ff,
} as const;
