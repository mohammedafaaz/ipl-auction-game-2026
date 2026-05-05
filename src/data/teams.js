export const TEAMS = [
  {
    id: 'csk',
    name: 'Chennai Super Kings',
    short: 'CSK',
    city: 'Chennai',
    color: '#F9CD1C',
    bgColor: 'rgba(249,205,28,0.12)',
    logo: '/IPL_TEAM_LOGOS/CSKoutline.avif',
    fallbackInitials: 'CSK',
  },
  {
    id: 'mi',
    name: 'Mumbai Indians',
    short: 'MI',
    city: 'Mumbai',
    color: '#004BA0',
    bgColor: 'rgba(0,75,160,0.12)',
    logo: '/IPL_TEAM_LOGOS/MIoutline.avif',
    fallbackInitials: 'MI',
  },
  {
    id: 'rcb',
    name: 'Royal Challengers Bengaluru',
    short: 'RCB',
    city: 'Bengaluru',
    color: '#EC1C24',
    bgColor: 'rgba(236,28,36,0.12)',
    logo: '/IPL_TEAM_LOGOS/RCBoutline.avif',
    fallbackInitials: 'RCB',
  },
  {
    id: 'kkr',
    name: 'Kolkata Knight Riders',
    short: 'KKR',
    city: 'Kolkata',
    color: '#3A225D',
    bgColor: 'rgba(58,34,93,0.2)',
    logo: '/IPL_TEAM_LOGOS/KKRoutline.avif',
    fallbackInitials: 'KKR',
  },
  {
    id: 'dc',
    name: 'Delhi Capitals',
    short: 'DC',
    city: 'Delhi',
    color: '#0078BC',
    bgColor: 'rgba(0,120,188,0.12)',
    logo: '/IPL_TEAM_LOGOS/DCoutline.avif',
    fallbackInitials: 'DC',
  },
  {
    id: 'srh',
    name: 'Sunrisers Hyderabad',
    short: 'SRH',
    city: 'Hyderabad',
    color: '#F26522',
    bgColor: 'rgba(242,101,34,0.12)',
    logo: '/IPL_TEAM_LOGOS/SRHoutline.avif',
    fallbackInitials: 'SRH',
  },
  {
    id: 'rr',
    name: 'Rajasthan Royals',
    short: 'RR',
    city: 'Jaipur',
    color: '#E8196B',
    bgColor: 'rgba(232,25,107,0.12)',
    logo: '/IPL_TEAM_LOGOS/RRoutline.png',
    fallbackInitials: 'RR',
  },
  {
    id: 'pbks',
    name: 'Punjab Kings',
    short: 'PBKS',
    city: 'Mohali',
    color: '#ED1B24',
    bgColor: 'rgba(237,27,36,0.12)',
    logo: '/IPL_TEAM_LOGOS/PBKSoutline.avif',
    fallbackInitials: 'PBKS',
  },
  {
    id: 'lsg',
    name: 'Lucknow Super Giants',
    short: 'LSG',
    city: 'Lucknow',
    color: '#A4D65E',
    bgColor: 'rgba(164,214,94,0.12)',
    logo: '/IPL_TEAM_LOGOS/LSGoutline.avif',
    fallbackInitials: 'LSG',
  },
  {
    id: 'gt',
    name: 'Gujarat Titans',
    short: 'GT',
    city: 'Ahmedabad',
    color: '#1D2951',
    bgColor: 'rgba(29,41,81,0.2)',
    logo: '/IPL_TEAM_LOGOS/GToutline.avif',
    fallbackInitials: 'GT',
  },
];

export const POOLS = [
  { id: 'marquee', label: 'Marquee Players', order: 1 },
  { id: 'capped_batters', label: 'Capped Indian Batters', order: 2 },
  { id: 'capped_bowlers', label: 'Capped Indian Bowlers', order: 3 },
  { id: 'capped_allrounders', label: 'Capped Indian All-Rounders', order: 4 },
  { id: 'overseas', label: 'Overseas Players', order: 5 },
  { id: 'uncapped', label: 'Uncapped Indians', order: 6 },
  { id: 'emerging', label: 'Emerging Players', order: 7 },
];

export const PURSE_TOTAL = 120; // Crores
export const MAX_SQUAD = 25;
export const MIN_SQUAD = 18;
export const MAX_OVERSEAS = 8;
export const MAX_OVERSEAS_PLAYING = 4;
export const MAX_RETENTIONS = 3;
export const RETENTION_COSTS = [16, 12, 8]; // Crore deductions per slot
export const MAX_RTM_CARDS = 2;

export const BID_INCREMENTS = [
  { threshold: 0, increment: 0.05 },     // Under 1Cr: 5L increments
  { threshold: 1, increment: 0.1 },      // 1-5Cr: 10L increments
  { threshold: 5, increment: 0.25 },     // 5-10Cr: 25L increments
  { threshold: 10, increment: 0.5 },     // 10-15Cr: 50L increments
  { threshold: 15, increment: 1 },       // 15Cr+: 1Cr increments
];

export function getNextBidAmount(currentBid) {
  const inc = BID_INCREMENTS.slice().reverse().find(b => currentBid >= b.threshold);
  return Math.round((currentBid + inc.increment) * 100) / 100;
}

export function formatCrore(val) {
  if (val >= 1) return `${val.toFixed(2).replace(/\.?0+$/, '')} Cr`;
  return `${Math.round(val * 100)}L`;
}

export function getTeamById(id) {
  return TEAMS.find(t => t.id === id);
}