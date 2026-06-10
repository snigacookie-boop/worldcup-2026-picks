// Map FIFA 3-letter codes (TLA) to ISO 3166-1 alpha-2 codes used by flagcdn.com.
// Covers the likely WC 2026 field plus common confederation members. Extend as needed.
const TLA_TO_ISO = {
  // CONCACAF
  USA: 'us', CAN: 'ca', MEX: 'mx', CRC: 'cr', PAN: 'pa', JAM: 'jm', HON: 'hn', SLV: 'sv',
  HAI: 'ht', TRI: 'tt', CUR: 'cw', GUA: 'gt',
  // CONMEBOL
  ARG: 'ar', BRA: 'br', URU: 'uy', COL: 'co', CHI: 'cl', ECU: 'ec', PER: 'pe', PAR: 'py',
  BOL: 'bo', VEN: 've',
  // UEFA
  ENG: 'gb-eng', SCO: 'gb-sct', WAL: 'gb-wls', NIR: 'gb-nir',
  FRA: 'fr', GER: 'de', ESP: 'es', POR: 'pt', NED: 'nl', BEL: 'be', ITA: 'it', SUI: 'ch',
  AUT: 'at', POL: 'pl', CRO: 'hr', DEN: 'dk', SWE: 'se', NOR: 'no', FIN: 'fi', IRL: 'ie',
  CZE: 'cz', SVK: 'sk', SVN: 'si', SRB: 'rs', UKR: 'ua', TUR: 'tr', HUN: 'hu', ROU: 'ro',
  GRE: 'gr', ISL: 'is', RUS: 'ru', BUL: 'bg', ALB: 'al', BIH: 'ba', MKD: 'mk', MNE: 'me',
  GEO: 'ge',
  // CAF
  MAR: 'ma', SEN: 'sn', TUN: 'tn', ALG: 'dz', EGY: 'eg', CMR: 'cm', GHA: 'gh', NGA: 'ng',
  CIV: 'ci', RSA: 'za', MLI: 'ml', BFA: 'bf', GUI: 'gn', CGO: 'cg', COD: 'cd', ANG: 'ao',
  ZAM: 'zm', UGA: 'ug', KEN: 'ke', TAN: 'tz',
  // AFC
  JPN: 'jp', KOR: 'kr', AUS: 'au', IRN: 'ir', KSA: 'sa', QAT: 'qa', UAE: 'ae', IRQ: 'iq',
  UZB: 'uz', JOR: 'jo', OMA: 'om', CHN: 'cn', VIE: 'vn', THA: 'th', IDN: 'id', MAS: 'my',
  PRK: 'kp', SYR: 'sy', LBN: 'lb', BHR: 'bh', KGZ: 'kg', TJK: 'tj', PLE: 'ps', IND: 'in',
  // OFC
  NZL: 'nz', FIJ: 'fj', SOL: 'sb', VAN: 'vu', NCL: 'nc', TAH: 'pf',
};

// flagcdn.com is a free, no-auth CDN of country SVG/PNG flags.
export function flagUrl(code, size = 40) {
  if (!code) return '';
  const iso = TLA_TO_ISO[String(code).toUpperCase()];
  if (!iso) return '';
  return `https://flagcdn.com/w${size}/${iso}.png`;
}

export function flagSrcSet(code, size = 40) {
  const iso = TLA_TO_ISO[String(code).toUpperCase()];
  if (!iso) return '';
  return `https://flagcdn.com/w${size * 2}/${iso}.png 2x`;
}
