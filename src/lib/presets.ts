// Well-known categorical palettes offered as a starting point; swapping one
// in replaces the whole list rather than appending to it. EmptyState shows the
// first three as its starter chips, so insert below them unless you mean to
// change that screen too.
export const PRESET_PALETTES: { name: string; colors: string[] }[] = [
  {
    name: 'Okabe–Ito',
    colors: ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7', '#999999'],
  },
  {
    name: 'Tableau 10',
    colors: ['#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC'],
  },
  {
    name: 'Observable 10',
    colors: ['#4269D0', '#EFB118', '#FF725C', '#6CC5B0', '#3CA951', '#FF8AB7', '#A463F2', '#97BBF5', '#9C6B4E', '#9498A0'],
  },
  // Petroff's cycles are the nearest published work to this app's own
  // objective — perceptual distance under simulated CVD plus an explicit
  // lightness separation for grayscale. Each length is optimized separately,
  // so Petroff 8 is not the first eight of Petroff 10; pick the entry that
  // matches the color count rather than truncating a longer one.
  {
    name: 'Petroff 6',
    colors: ['#5790FC', '#F89C20', '#E42536', '#964A8B', '#9C9CA1', '#7A21DD'],
  },
  {
    name: 'Petroff 8',
    colors: ['#1845FB', '#FF5E02', '#C91F16', '#C849A9', '#ADAD7D', '#86C8DD', '#578DFF', '#656364'],
  },
  {
    name: 'Petroff 10',
    colors: ['#3F90DA', '#FFA90E', '#BD1F01', '#94A4A2', '#832DB6', '#A96B59', '#E76300', '#B9AC70', '#717581', '#92DADD'],
  },
  {
    name: 'ColorBrewer Set2',
    colors: ['#66C2A5', '#FC8D62', '#8DA0CB', '#E78AC3', '#A6D854', '#FFD92F', '#E5C494', '#B3B3B3'],
  },
  {
    name: 'ColorBrewer Set3',
    colors: ['#8DD3C7', '#FFFFB3', '#BEBADA', '#FB8072', '#80B1D3', '#FDB462', '#B3DE69', '#FCCDE5', '#D9D9D9', '#BC80BD', '#CCEBC5', '#FFED6F'],
  },
  {
    name: 'Adobe Spectrum',
    colors: ['#0FB5AE', '#4046CA', '#F68511', '#DE3D82', '#7E84FA', '#72E06A', '#147AF3', '#7326D3', '#E8C600', '#CB5D00', '#008F5D', '#BCE931'],
  },
  {
    name: 'IBM Carbon',
    colors: ['#6929C4', '#1192E8', '#005D5D', '#9F1853', '#FA4D56', '#570408', '#198038', '#002D9C', '#EE538B', '#B28600', '#009D9A', '#012749', '#8A3800', '#A56EFF'],
  },
]
