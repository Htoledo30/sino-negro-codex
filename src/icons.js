const paths = {
  blade: 'M19 3 8 14l-3-1-2 2 6 6 2-2-1-3L21 5V3h-2ZM8 14l2 2M4 20l-1 1',
  shield: 'M12 2 3 6v7c0 5 9 9 9 9s9-4 9-9V6L12 2Zm0 4v12M7 10h10',
  hammer: 'm14 3 7 7-4 4-7-7 4-4ZM12 12 3 21M4 18l2 2',
  spear: 'M21 3 19 9l-4-4 6-2ZM17 7 3 21M4 17l3 3',
  bow: 'M4 3c17 1 17 17 0 18L16 12 4 3ZM2 12h20m-4-3 3 3-3 3',
  flame:
    'M13 2c1 7 8 7 7 14a8 8 0 0 1-16 0c0-4 3-7 5-9 0 4 2 5 2 5s4-3 2-10ZM12 14c4 4 2 7 0 7s-4-3 0-7Z',
  drop: 'M12 2c-2 5-8 9-8 14a8 8 0 0 0 16 0c0-5-6-9-8-14Zm-4 14c0 3 2 4 4 4',
  steps: 'm5 2 3 1 1 7-4 1-2-6 2-3Zm10 9 4 1 2 7-3 3-4-2 1-9ZM4 15l5 1M11 7l4-1',
  arrow: 'M3 12h17m-6-6 6 6-6 6M3 5v14',
  flask: 'M9 2h6m-5 0v7L4 18c-1 2 1 4 3 4h10c2 0 4-2 3-4l-6-9V2M6 16h12',
  burst: 'm12 2 2 6 6-4-2 6 4 2-6 2 4 6-6-2-2 4-2-6-6 4 2-6-4-2 6-2-4-6 6 2 2-4Z',
  skull: 'M5 16v-3a7 7 0 1 1 14 0v3l-4 2v4H9v-4l-4-2Zm3-5v2m8-2v2m-5 5 1-2 1 2M12 19v3',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  chest: 'M3 9h18v12H3V9Zm0 0V6c0-2 18-2 18 0v3M3 14h18m-10-2h2v5h-2v-5Z',
  camp: 'M2 19 12 3l10 16H2Zm10-8-4 8h8l-4-8ZM2 22h20',
  coins:
    'M12 2c-5 0-8 2-8 4s3 4 8 4 8-2 8-4-3-4-8-4ZM4 6v5c0 5 16 5 16 0V6M4 11v5c0 5 16 5 16 0v-5M4 16v3c0 4 16 4 16 0v-3',
  bell: 'M6 17V9c0-9 12-9 12 0v8l3 3H3l3-3ZM9 23h6M12 1v2',
  chain: 'm9 14-2 2c-5 5-9 1-4-4l4-4m8 2 2-2c5-5 1-9-4-4l-4 4m-3 4 4-4',
  book: 'M3 3h7l2 2 2-2h7v17h-7l-2 2-2-2H3V3Zm9 2v17M6 7h3m6 0h3M6 11h3m6 0h3',
  gear: 'M9 2h6l1 4 4 1 2 5-3 3 1 4-5 3-3-3-4 1-4-5 3-3-1-4 3-1 1-4Zm3 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  heart: 'M12 21 3 12C-3 4 7-1 12 6 17-1 27 4 21 12l-9 9Z',
  star: 'm12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1 3-6Z',
  exit: 'M9 3H3v18h6m-1-9h14m-5-5 5 5-5 5',
  check: 'm4 12 5 5L20 6',
  sound: 'M3 9h4l5-5v16l-5-5H3V9Zm12-2c5 2 5 8 0 10m2-14c8 3 8 15 0 18',
  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2',
};
export function icon(name, cls = '') {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.skull}"/></svg>`;
}
const figures = {
  player:
    'M29 5h6l3 7-5 5-7-4 3-8ZM26 19l12-2 7 21-9 3-2 18h-6l-1-20-8-2 7-18ZM40 22l9-5 4 3-9 13M21 22l-6 13 2 4 9-10M51 3v41m-3-38h6',
  husk: 'M24 6h12l4 11-8 5-10-8 2-8ZM22 24l13-2 7 17-10 6 4 14h-7l-4-18-7 16-5-2 7-23-4-5-6 15-5-2 11-20 6 4Z',
  hound:
    'm9 27 12-9 18 3 12-7 7 7-5 11-9-3-8 10 7 13-6 4-12-15-8 5-2 16h-6l-1-20-9-2-3-10ZM10 25 3 12l6 4 7 10',
  soldier:
    'M26 5h13l3 12-18 2 2-14Zm-4 19 21-3 3 19-10 3 2 16h-8l-3-15-6 15h-7l5-26 3-9ZM10 20h12v26H10V20ZM51 7v47m-4-19h9',
  archer:
    'M25 4h12l5 13-14 5-7-10 4-8ZM24 24l12-2 5 17-8 5 4 15h-7l-4-16-5 16h-7l7-26 3-9ZM38 25l12 8M50 10q19 20 0 40l10-20-10-20ZM29 31h32',
  brute:
    'M21 3h19l4 18-23 2V3ZM16 25l29-2 10 19-11 5-5-12-1 9 5 15H32l-5-14-7 14H10l8-22-7 9-8-7 13-14ZM7 11v43m-5-3h10',
  cantor:
    'M27 4h11l5 12-16 5-5-10 5-7ZM26 22l13-1 12 37H12l14-36ZM18 25 8 38l3 4 14-11M39 25l11 7 7-12m-4-10v42m-5-35h10',
  leech:
    'M21 4c26-5 30 15 14 20s-10 9 3 15 13 19-10 21l-13-8 10-2-15-16 9-10-7-9 9-11Zm4 3 6 6-6 5m10 23-9 7',
  boss: 'M19 1l7 9 6-10 6 10 8-9-2 20-23 2-2-22ZM21 25l23-2 13 28-16-3 1 14H29l-2-18-10 16H7l9-27 5-8ZM7 7v44M3 15h10M50 24l9 3-2 24-5-1',
};
export function figure(name, cls = '') {
  return `<svg class="figure ${cls}" viewBox="0 0 64 64" aria-hidden="true"><path d="${figures[name] || figures.husk}" fill="currentColor" stroke="currentColor" stroke-width=".6"/><path d="M29 12h2m4 0h2" stroke="#121513" stroke-width="2"/></svg>`;
}
export function skyline() {
  return `<svg class="skyline" viewBox="0 0 600 340" aria-hidden="true"><defs><linearGradient id="fog" x2="0" y2="1"><stop stop-color="#181d19"/><stop offset="1" stop-color="#101211"/></linearGradient></defs><circle cx="305" cy="90" r="65" fill="#b9af8a" opacity=".12"/><g fill="#1e2420" stroke="#4c5144" stroke-width="1"><path d="M0 300v-85l45-27 40 27v85h35V163l36-48 36 48v137h26V136l28-40 28 40v164h46V90l21-59 21 59v210h20V170l41-60 41 60v130h21V210l60-38 55 38v90h60v40H0Z"/><path d="M268 300V180l32-51 32 51v120M287 168h26v34h-26ZM335 32V5m-12 13h24"/></g><g fill="#101211"><path d="M0 340v-47l77-25 69 16 50-16 53 25 61-20 61 22 78-38 65 31 86-2v54H0Z"/><path d="M264 340V222l36-27 36 27v118ZM280 233v45h40v-45Z"/></g><g stroke="#aa5147" opacity=".5"><path d="M300 236v37m-12-25h24m-15 6h6"/><path d="M156 190v19m288-24v15"/></g></svg>`;
}
