import SQUADS_2026 from './squads2026.js';
import { PLAYER_POOL } from './players.js';
import { PURSE_TOTAL } from './teams.js';

function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Role assignment based on known player names (simplified heuristic)
const ROLE_MAP = {
  // Batters
  'virat kohli': 'Batter', 'rohit sharma': 'Batter', 'shubman gill': 'Batter',
  'yashasvi jaiswal': 'Batter', 'ruturaj gaikwad': 'Batter', 'devdutt padikkal': 'Batter',
  'rajat patidar': 'Batter', 'sai sudharsan': 'Batter', 'riyan parag': 'Batter',
  'abhishek sharma': 'Batter', 'travis head': 'Batter', 'prabhsimran singh': 'Batter',
  'nehal wadhera': 'Batter', 'priyansh arya': 'Batter', 'vaibhav suryavanshi': 'Batter',
  'karun nair': 'Batter', 'nitish rana': 'Batter', 'ajinkya rahane': 'Batter',
  'manish pandey': 'Batter', 'rinku singh': 'Batter', 'angkrish raghuvanshi': 'Batter',
  'himmat singh': 'Batter', 'harnoor singh': 'Batter', 'shubham dubey': 'Batter',
  'ayush mhatre': 'Batter', 'anuj rawat': 'Batter', 'shahrukh khan': 'Batter',
  'musheer khan': 'Batter', 'aniket verma': 'Batter',
  // WK-Batters
  'ms dhoni': 'WK-Batter', 'rishabh pant': 'WK-Batter', 'sanju samson': 'WK-Batter',
  'ishan kishan': 'WK-Batter', 'jitesh sharma': 'WK-Batter', 'dhruv jurel': 'WK-Batter',
  'abhishek porel': 'WK-Batter', 'ryan rickelton': 'WK-Batter', 'heinrich klaasen': 'WK-Batter',
  'nicholas pooran': 'WK-Batter', 'jos buttler': 'WK-Batter', 'phil salt': 'WK-Batter',
  'quinton de kock': 'WK-Batter', 'urvil patel': 'WK-Batter', 'kumar kushagra': 'WK-Batter',
  'vishnu vinod': 'WK-Batter', 'robin minz': 'WK-Batter',
  // All-Rounders
  'hardik pandya': 'All-Rounder', 'ravindra jadeja': 'All-Rounder', 'axar patel': 'All-Rounder',
  'sunil narine': 'All-Rounder', 'andre russell': 'All-Rounder', 'washington sundar': 'All-Rounder',
  'krunal pandya': 'All-Rounder', 'mitchell marsh': 'All-Rounder', 'marcus stoinis': 'All-Rounder',
  'sam curran': 'All-Rounder', 'marco jansen': 'All-Rounder', 'jacob bethell': 'All-Rounder',
  'will jacks': 'All-Rounder', 'shivam dube': 'All-Rounder', 'nitish kumar reddy': 'All-Rounder',
  'tilak varma': 'All-Rounder', 'ramandeep singh': 'All-Rounder', 'shahbaz ahmed': 'All-Rounder',
  'ayush badoni': 'All-Rounder', 'shashank singh': 'All-Rounder', 'naman dhir': 'All-Rounder',
  'ashutosh sharma': 'All-Rounder', 'rahul tewatia': 'All-Rounder', 'pat cummins': 'All-Rounder',
  'harshal patel': 'All-Rounder', 'corbin bosch': 'All-Rounder', 'azmatullah omarzai': 'All-Rounder',
  'romario shepherd': 'All-Rounder', 'rovman powell': 'All-Rounder', 'kamindu mendis': 'All-Rounder',
  'mitchell santner': 'All-Rounder', 'moeen ali': 'All-Rounder', 'liam livingstone': 'All-Rounder',
  'glenn phillips': 'All-Rounder', 'aiden markram': 'All-Rounder', 'donovan ferreira': 'All-Rounder',
  'nishant sindhu': 'All-Rounder', 'jayant yadav': 'All-Rounder', 'swapnil singh': 'All-Rounder',
  'arjun tendulkar': 'All-Rounder', 'raj angad bawa': 'All-Rounder', 'suryansh shedge': 'All-Rounder',
  'gurnoor brar': 'All-Rounder', 'harpreet brar': 'All-Rounder', 'brydon carse': 'All-Rounder',
  'shardul thakur': 'All-Rounder', 'jamie overton': 'All-Rounder', 'dewald brevis': 'All-Rounder',
  'tim david': 'All-Rounder', 'sherfane rutherford': 'All-Rounder', 'matthew breetzke': 'All-Rounder',
  'ajay mandal': 'All-Rounder', 'tripurana vijay': 'All-Rounder', 'vipraj nigam': 'All-Rounder',
  'arshad khan': 'All-Rounder', 'anukul roy': 'All-Rounder', 'arshin kulkarni': 'All-Rounder',
  'sai kishore': 'All-Rounder', 'yudhvir singh': 'All-Rounder', 'madhav tiwari': 'All-Rounder',
  // Bowlers
  'jasprit bumrah': 'Bowler', 'rashid khan': 'Bowler', 'kagiso rabada': 'Bowler',
  'mitchell starc': 'Bowler', 'trent boult': 'Bowler', 'josh hazlewood': 'Bowler',
  'jofra archer': 'Bowler', 'arshdeep singh': 'Bowler', 'yuzvendra chahal': 'Bowler',
  'kuldeep yadav': 'Bowler', 'varun chakravarthy': 'Bowler', 'mohammed shami': 'Bowler',
  'mohammed siraj': 'Bowler', 'bhuvneshwar kumar': 'Bowler', 'deepak chahar': 'Bowler',
  'avesh khan': 'Bowler', 't natarajan': 'Bowler', 'mukesh kumar': 'Bowler',
  'harshit rana': 'Bowler', 'umran malik': 'Bowler', 'vaibhav arora': 'Bowler',
  'prasidh krishna': 'Bowler', 'sandeep sharma': 'Bowler', 'tushar deshpande': 'Bowler',
  'yash dayal': 'Bowler', 'rasikh salam': 'Bowler', 'suyash sharma': 'Bowler',
  'noor ahmad': 'Bowler', 'am ghazanfar': 'Bowler', 'mayank yadav': 'Bowler',
  'akash singh': 'Bowler', 'digvesh rathi': 'Bowler', 'manimaran siddharth': 'Bowler',
  'mohsin khan': 'Bowler', 'kwena maphaka': 'Bowler', 'lockie ferguson': 'Bowler',
  'dushmantha chameera': 'Bowler', 'nuwan thushara': 'Bowler', 'eshan malinga': 'Bowler',
  'zeeshan ansari': 'Bowler', 'jaydev unadkat': 'Bowler', 'mukesh choudhary': 'Bowler',
  'shreyas gopal': 'Bowler', 'nathan ellis': 'Bowler', 'gurjapneet singh': 'Bowler',
  'ramakrishna ghosh': 'Bowler', 'anshul kamboj': 'Bowler', 'vijaykumar vyshak': 'Bowler',
  'yash thakur': 'Bowler', 'manav suthar': 'Bowler', 'ishant sharma': 'Bowler',
  'prince yadav': 'Bowler', 'ashwani kumar': 'Bowler', 'ab de villiers': 'Batter',
  'shimron hetmyer': 'Batter', 'sameer rizvi': 'Batter', 'syed khaleel ahmed': 'Bowler',
};

const POOL_MAP = {
  'virat kohli': 'marquee', 'rohit sharma': 'marquee', 'jasprit bumrah': 'marquee',
  'ms dhoni': 'marquee', 'hardik pandya': 'marquee', 'rishabh pant': 'marquee',
  'suryakumar yadav': 'marquee', 'rashid khan': 'marquee', 'jos buttler': 'marquee',
  'pat cummins': 'marquee', 'heinrich klaasen': 'marquee', 'shreyas iyer': 'marquee',
  'kl rahul': 'marquee', 'yashasvi jaiswal': 'marquee',
};

const BASE_PRICE_MAP = {};
PLAYER_POOL.forEach(p => { BASE_PRICE_MAP[normalize(p.name)] = p.basePrice; });

function getRole(name) {
  return ROLE_MAP[name.toLowerCase()] || 'All-Rounder';
}

function getPool(name, isOverseas) {
  const key = name.toLowerCase();
  if (POOL_MAP[key]) return POOL_MAP[key];
  if (isOverseas) return 'overseas';
  const bp = BASE_PRICE_MAP[normalize(name)] || 0.5;
  if (bp >= 1.0) return 'capped_batters';
  if (bp <= 0.3) return 'emerging';
  return 'uncapped';
}

// Build full team states from 2026 squads (no auction, pre-set squads)
export function buildSquadTeamStates() {
  const states = {};
  for (const [teamId, players] of Object.entries(SQUADS_2026)) {
    const squad = players.map((p, i) => {
      const role = getRole(p.name);
      const pool = getPool(p.name, p.isOverseas);
      const bp = BASE_PRICE_MAP[normalize(p.name)] || 0.5;
      return {
        id: normalize(p.name).replace(/[^a-z0-9]/g, '-'),
        name: p.name,
        role,
        pool: pool || 'uncapped',
        isOverseas: p.isOverseas,
        isCapped: bp >= 1.0,
        nationality: p.isOverseas ? 'Overseas' : 'Indian',
        basePrice: parseFloat(bp) || 0.5,
        soldPrice: parseFloat(bp) || 0.5,
        source: 'squad',
        auctioned: true,
      };
    });
    states[teamId] = {
      id: teamId,
      purse: PURSE_TOTAL,
      squad,
      retentions: [],
      rtmCards: 0,
      rtmPlayers: [],
      purseHistory: [PURSE_TOTAL],
    };
  }
  return states;
}
