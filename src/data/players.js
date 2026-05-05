// Combined player pool: IPL 2025 auction CSV + IPL 2026 squad list
// Deduplication by slug, 2026 data takes priority for isOverseas flag

import SQUADS_2026 from './squads2026.js';

const NATIONALITY_MAP = {
  'Heinrich Klaasen': 'South African', 'Pat Cummins': 'Australian',
  'Travis Head': 'Australian', 'Matheesha Pathirana': 'Sri Lankan',
  'Tristan Stubbs': 'South African', 'Sunil Narine': 'West Indian',
  'Andre Russell': 'West Indian', 'Shimron Hetmyer': 'West Indian',
  'Rashid Khan': 'Afghan', 'Jos Buttler': 'English',
  'Kagiso Rabada': 'South African', 'Mitchell Starc': 'Australian',
  'Liam Livingstone': 'English', 'David Miller': 'South African',
  'Harry Brook': 'English', 'Devon Conway': 'New Zealander',
  'Jake Fraser-McGurk': 'Australian', 'Aiden Markram': 'South African',
  'David Warner': 'Australian', 'Mitchell Marsh': 'Australian',
  'Glenn Maxwell': 'Australian', 'Rachin Ravindra': 'New Zealander',
  'Marcus Stoinis': 'Australian', 'Jonny Bairstow': 'English',
  'Quinton de Kock': 'South African', 'Rahmanullah Gurbaz': 'Afghan',
  'Phil Salt': 'English', 'Trent Boult': 'New Zealander',
  'Josh Hazlewood': 'Australian', 'Anrich Nortje': 'South African',
  'Wanindu Hasaranga': 'Sri Lankan', 'Maheesh Theekshana': 'Sri Lankan',
  'Adam Zampa': 'Australian', 'Faf du Plessis': 'South African',
  'Glenn Phillips': 'New Zealander', 'Rovman Powell': 'West Indian',
  'Sam Curran': 'English', 'Marco Jansen': 'South African',
  'Donovan Ferreira': 'South African', 'Josh Inglis': 'Australian',
  'Ryan Rickelton': 'South African', 'Gerald Coetzee': 'South African',
  'Lockie Ferguson': 'New Zealander', 'AM Ghazanfar': 'Afghan',
  'Jacob Bethell': 'English', 'Brydon Carse': 'English',
  'Aaron Hardie': 'Australian', 'Kamindu Mendis': 'Sri Lankan',
  'Dushmantha Chameera': 'Sri Lankan', 'Nathan Ellis': 'Australian',
  'Shamar Joseph': 'West Indian', 'Jofra Archer': 'English',
  'Spencer Johnson': 'Australian', 'Nuwan Thushara': 'Sri Lankan',
  'Fazalhaq Farooqi': 'Afghan', 'Kwena Maphaka': 'South African',
  'Will Jacks': 'English', 'Tim David': 'Singaporean',
  'Romario Shepherd': 'West Indian', 'Mitchell Santner': 'New Zealander',
  'Sherfane Rutherford': 'West Indian', 'Moeen Ali': 'English',
  'Azmatullah Omarzai': 'Afghan', 'Matthew Breetzke': 'South African',
  'Jamie Overton': 'English', 'Dewald Brevis': 'South African',
  'Corbin Bosch': 'South African', 'Eshan Malinga': 'Sri Lankan',
  'Noor Ahmad': 'Afghan', 'Washington Sundar': 'Indian',
  'Sai Kishore': 'Indian', 'Shahbaz Ahmed': 'Indian',
};

function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function getRole(type) {
  if (type === 'BAT') return 'Batter';
  if (type === 'BOWL') return 'Bowler';
  if (type === 'AR') return 'All-Rounder';
  if (type === 'WK') return 'WK-Batter';
  return 'Batter';
}

function getPool(name, isOverseas, basePrice) {
  const marquee = [
    'Virat Kohli', 'Rohit Sharma', 'Jasprit Bumrah', 'MS Dhoni', 'Hardik Pandya',
    'Rishabh Pant', 'Suryakumar Yadav', 'Rashid Khan', 'Jos Buttler', 'Pat Cummins',
    'Heinrich Klaasen', 'Shreyas Iyer', 'KL Rahul', 'Yashasvi Jaiswal',
  ];
  if (marquee.includes(name)) return 'marquee';
  if (isOverseas) return 'overseas';
  if (basePrice >= 0.5) return 'capped_batters'; // will be overridden per role below
  if (basePrice <= 0.3) return 'emerging';
  return 'uncapped';
}

function getPoolByRole(name, role, isOverseas, basePrice) {
  const marquee = [
    // Top Indian stars
    'Virat Kohli', 'Rohit Sharma', 'Jasprit Bumrah', 'MS Dhoni', 'Hardik Pandya',
    'Rishabh Pant', 'Suryakumar Yadav', 'Shreyas Iyer', 'KL Rahul', 'Yashasvi Jaiswal',
    'Shubman Gill', 'Ravindra Jadeja', 'Axar Patel', 'Yuzvendra Chahal', 'Mohammed Shami',
    'Arshdeep Singh', 'Ruturaj Gaikwad', 'Sanju Samson', 'Venkatesh Iyer',
    // Top overseas stars
    'Rashid Khan', 'Jos Buttler', 'Pat Cummins', 'Heinrich Klaasen', 'Travis Head',
    'Mitchell Starc', 'Jofra Archer', 'Nicholas Pooran', 'Sunil Narine', 'Andre Russell',
    'Trent Boult', 'Josh Hazlewood', 'Kagiso Rabada',
  ];
  if (marquee.includes(name)) return 'marquee';
  if (isOverseas) return 'overseas';
  if (basePrice >= 0.5) {
    if (role === 'Bowler') return 'capped_bowlers';
    if (role === 'All-Rounder') return 'capped_allrounders';
    return 'capped_batters';
  }
  if (basePrice <= 0.3) return 'emerging';
  return 'uncapped';
}

// ── 2025 CSV RAW DATA ──
const RAW_2025 = [
  ['Virat Kohli','BAT',2,21],['Rajat Patidar','BAT',2,11],['Yash Dayal','BOWL',2,5],
  ['Jasprit Bumrah','BOWL',2,18],['Suryakumar Yadav','BAT',2,16.35],['Hardik Pandya','AR',2,16.35],
  ['Rohit Sharma','BAT',2,16.30],['Tilak Varma','AR',2,8],['Heinrich Klaasen','BAT',2,23],
  ['Pat Cummins','AR',2,18],['Abhishek Sharma','AR',2,14],['Travis Head','BAT',2,14],
  ['Nitish Kumar Reddy','AR',2,6],['Ruturaj Gaikwad','BAT',2,18],['Ravindra Jadeja','AR',2,18],
  ['Matheesha Pathirana','BOWL',2,13],['Shivam Dube','AR',2,12],['MS Dhoni','BAT',2,4],
  ['Axar Patel','AR',2,16.5],['Kuldeep Yadav','BOWL',2,13.25],['Tristan Stubbs','BAT',2,10],
  ['Abishek Porel','BAT',2,4],['Rinku Singh','BAT',2,13],['Varun Chakravarthy','AR',2,12],
  ['Sunil Narine','BOWL',2,12],['Andre Russell','AR',2,12],['Harshit Rana','BOWL',2,4],
  ['Ramandeep Singh','AR',2,4],['Sanju Samson','BAT',2,18],['Yashasvi Jaiswal','AR',2,18],
  ['Riyan Parag','AR',2,14],['Dhruv Jurel','BAT',2,14],['Shimron Hetmyer','BAT',2,11],
  ['Sandeep Sharma','BOWL',2,4],['Rashid Khan','BOWL',2,18],['Shubman Gill','BAT',2,16.5],
  ['Sai Sudharsan','AR',2,8.5],['Rahul Tewatia','AR',2,4],['Nicholas Pooran','BAT',2,21],
  ['Ravi Bishnoi','BOWL',2,11],['Mayank Yadav','BOWL',2,11],['Ayush Badoni','AR',2,4],
  ['Shashank Singh','AR',2,5.5],['Prabhsimran Singh','BAT',2,4],['Jos Buttler','BAT',2,15.75],
  ['Shreyas Iyer','BAT',2,26.75],['Rishabh Pant','BAT',2,27],['Kagiso Rabada','BOWL',2,10.75],
  ['Arshdeep Singh','BOWL',2,18],['Mitchell Starc','BOWL',2,11.75],['Yuzvendra Chahal','BOWL',2,18],
  ['Liam Livingstone','AR',2,8.75],['David Miller','BAT',1.5,7.5],['KL Rahul','BAT',2,14],
  ['Mohammed Shami','BOWL',2,10],['Mohammed Siraj','BOWL',2,12.25],['Harry Brook','BAT',2,6.25],
  ['Devon Conway','BAT',2,6.25],['Jake Fraser-McGurk','BAT',2,9],['Aiden Markram','BAT',2,2],
  ['Devdutt Padikkal','BAT',2,2],['Rahul Tripathi','BAT',0.75,3.4],['Ravichandran Ashwin','AR',2,9.75],
  ['Venkatesh Iyer','AR',2,23.75],['Mitchell Marsh','AR',2,3.4],['Glenn Maxwell','AR',2,4.2],
  ['Harshal Patel','AR',2,8],['Rachin Ravindra','AR',1.5,4],['Marcus Stoinis','AR',2,11],
  ['Quinton de Kock','BAT',2,3.6],['Rahmanullah Gurbaz','BAT',2,2],['Ishan Kishan','BAT',2,11.25],
  ['Phil Salt','BAT',2,11.5],['Jitesh Sharma','BAT',1,11],['Khaleel Ahmed','BOWL',2,4.8],
  ['Trent Boult','BOWL',2,12.5],['Josh Hazlewood','BOWL',2,12.5],['Avesh Khan','BOWL',2,9.75],
  ['Prasidh Krishna','BOWL',2,9.5],['T Natarajan','BOWL',2,10.75],['Anrich Nortje','BOWL',2,6.5],
  ['Noor Ahmad','BOWL',2,10],['Rahul Chahar','BOWL',1,3.2],['Wanindu Hasaranga','BOWL',2,5.25],
  ['Maheesh Theekshana','BOWL',2,4.4],['Adam Zampa','BOWL',2,2.4],['Abhinav Manohar','BAT',0.3,3.2],
  ['Angkrish Raghuvanshi','BAT',0.3,3],['Nehal Wadhera','BAT',0.3,4.2],['Naman Dhir','AR',0.3,5.25],
  ['Abdul Samad','AR',0.3,4.2],['Ashutosh Sharma','AR',0.3,3.8],['Faf du Plessis','BAT',2,2],
  ['Glenn Phillips','BAT',2,2],['Rovman Powell','BAT',1.5,1.5],['Sam Curran','AR',2,2.4],
  ['Marco Jansen','AR',1.25,7],['Krunal Pandya','AR',2,5.75],['Nitish Rana','AR',1.5,4.2],
  ['Washington Sundar','AR',2,3.2],['Josh Inglis','BAT',2,2.6],['Deepak Chahar','BOWL',2,9.25],
  ['Gerald Coetzee','BOWL',1.25,2.4],['Akash Deep','BOWL',1,8],['Tushar Deshpande','BOWL',1,6.5],
  ['Bhuvneshwar Kumar','BOWL',2,10.75],['Mukesh Kumar','BOWL',2,8],['AM Ghazanfar','BOWL',0.75,4.8],
  ['Spencer Johnson','BOWL',2,2.8],['Nuwan Thushara','BOWL',0.75,1.6],['Jacob Bethell','AR',1.25,2.6],
  ['Brydon Carse','AR',1,1],['Aaron Hardie','AR',1.25,1.25],['Kamindu Mendis','AR',0.75,0.75],
  ['Dushmantha Chameera','BOWL',0.75,0.75],['Nathan Ellis','BOWL',1.25,2],['Shamar Joseph','BOWL',0.75,0.75],
  ['Jofra Archer','BOWL',2,12.5],['Will Jacks','AR',2,5.25],['Tim David','AR',2,3],
  ['Romario Shepherd','AR',1.5,1.5],['Mitchell Santner','AR',2,2],['Sherfane Rutherford','BAT',1.5,2.6],
  ['Shahbaz Ahmed','AR',1,2.4],['Moeen Ali','AR',2,2],['Azmatullah Omarzai','AR',1.5,2.4],
  ['Matthew Breetzke','BAT',0.75,0.75],['Karim Janat','AR',0.75,0.75],['Fazalhaq Farooqi','BOWL',2,2],
  ['Kwena Maphaka','BOWL',0.75,1.5],['Vaibhav Suryavanshi','BAT',0.3,1.1],['Priyansh Arya','AR',0.3,3.8],
  ['Rasikh Salam','BOWL',0.3,6],['Suyash Sharma','BOWL',0.3,2.6],['Anshul Kamboj','AR',0.3,3.4],
  ['Gurjapneet Singh','BOWL',0.3,2.2],['Gurnoor Brar','BOWL',0.3,1.3],['Arshad Khan','AR',0.3,1.3],
  ['Akash Madhwal','BOWL',0.3,1.2],['Eshan Malinga','BOWL',0.3,1.2],['Harpreet Brar','AR',0.3,1.5],
  ['Yash Thakur','BOWL',0.4,1.6],['Vijaykumar Vyshak','BOWL',0.3,1.8],['Vaibhav Arora','BOWL',0.3,1.8],
  ['Simarjeet Singh','BOWL',0.3,1.5],['Mohit Sharma','BOWL',0.5,2.2],['Sameer Rizvi','AR',0.3,0.95],
  ['Mahipal Lomror','AR',0.5,1.7],['Musheer Khan','AR',0.3,0.3],['Suryansh Shedge','AR',0.3,0.3],
  ['Yudhvir Singh','AR',0.3,0.35],['Shubham Dubey','BAT',0.3,0.8],['Kunal Singh Rathore','BAT',0.3,0.3],
  ['Ajinkya Rahane','BAT',1.5,1.5],['Manish Pandey','BAT',0.75,0.75],['Anukul Roy','AR',0.3,0.4],
  ['Umran Malik','BOWL',0.75,0.75],['Akash Deep','BOWL',1,8],['Deepak Hooda','AR',0.75,1.7],
  ['Sai Kishore','AR',0.75,2],['Jayant Yadav','AR',0.75,0.75],['Ishant Sharma','BOWL',0.75,0.75],
  ['Karun Nair','BAT',0.3,0.5],['Tripurana Vijay','AR',0.3,0.3],['Madhav Tiwari','AR',0.3,0.4],
  ['Vipraj Nigam','AR',0.3,0.5],['Ajay Mandal','AR',0.3,0.3],['Abhishek Porel','BAT',2,4],
  ['Ramakrishna Ghosh','AR',0.3,0.3],['Shreyas Gopal','BOWL',0.3,0.3],['Mukesh Choudhary','BOWL',0.3,0.3],
  ['Ayush Mhatre','BAT',0.3,null],['Urvil Patel','BAT',0.3,null],['Harnoor Singh','BAT',0.3,0.3],
  ['Vishnu Vinod','BAT',0.3,0.95],['Pyla Avinash','BAT',0.3,0.3],['Arshin Kulkarni','AR',0.3,0.3],
  ['Digvesh Rathi','BOWL',0.3,0.3],['Himmat Singh','BAT',0.3,0.3],['Manimaran Siddharth','BOWL',0.3,0.75],
  ['Prince Yadav','BOWL',0.3,0.3],['Akash Singh','BOWL',0.3,0.3],['Raj Angad Bawa','AR',0.3,0.3],
  ['Robin Minz','BAT',0.3,0.65],['Ashwani Kumar','BOWL',0.3,0.3],['Naman Dhir','AR',0.3,5.25],
  ['Zeeshan Ansari','BOWL',0.3,0.4],['Aniket Verma','BAT',0.3,0.3],['Harsh Dubey','AR',0.3,null],
  ['Nishant Sindhu','AR',0.3,0.3],['Anuj Rawat','BAT',0.3,0.3],['Kumar Kushagra','BAT',0.3,0.65],
  ['Manav Suthar','BOWL',0.3,0.3],['Shahrukh Khan','BAT',0.3,4],['Swapnil Singh','AR',0.3,0.5],
  ['Abhinandan Singh','BOWL',0.3,0.3],
  // Additional players from 2025 auction
  ['David Warner','BAT',2,null],['Jonny Bairstow','BAT',2,null],['Faf du Plessis','BAT',2,2],
  ['Steven Smith','BAT',2,null],['Kane Williamson','BAT',2,null],['Ben Stokes','AR',2,null],
  ['Daryl Mitchell','AR',2,null],['Glenn Phillips','BAT',2,2],['Finn Allen','BAT',2,null],
  ['Devon Conway','BAT',2,6.25],['Rachin Ravindra','AR',1.5,4],['Mitchell Santner','AR',2,2],
  ['Lockie Ferguson','BOWL',2,2],['Trent Boult','BOWL',2,12.5],['Matt Henry','BOWL',2,null],
  ['Kyle Jamieson','BOWL',1.5,null],['Tim Southee','BOWL',1.5,null],
  ['Alzarri Joseph','BOWL',2,null],['Jason Holder','AR',2,null],['Rovman Powell','BAT',1.5,1.5],
  ['Shimron Hetmyer','BAT',2,11],['Nicholas Pooran','BAT',2,21],['Shamar Joseph','BOWL',0.75,0.75],
  ['Shai Hope','BAT',1.25,null],['Evin Lewis','BAT',2,null],
  ['Wanindu Hasaranga','BOWL',2,5.25],['Maheesh Theekshana','BOWL',2,4.4],
  ['Kusal Mendis','BAT',0.75,null],['Pathum Nissanka','BAT',0.75,null],
  ['Mujeeb Ur Rahman','BOWL',2,null],['Rahmanullah Gurbaz','BAT',2,2],
  ['Fazalhaq Farooqi','BOWL',2,2],['Azmatullah Omarzai','AR',1.5,2.4],
  ['Naveen-ul-Haq','BOWL',2,null],['Ibrahim Zadran','BAT',0.75,null],
  ['Adil Rashid','BOWL',2,null],['Sam Curran','AR',2,2.4],['Liam Livingstone','AR',2,8.75],
  ['Harry Brook','BAT',2,6.25],['Phil Salt','BAT',2,11.5],['Jacob Bethell','AR',1.25,2.6],
  ['Brydon Carse','AR',1,1],['Jofra Archer','BOWL',2,12.5],['Will Jacks','AR',2,5.25],
  ['Jos Buttler','BAT',2,15.75],['Ben Duckett','BAT',2,null],['Ollie Pope','BAT',0.75,null],
  ['Pat Cummins','AR',2,18],['Mitchell Starc','BOWL',2,11.75],['Josh Hazlewood','BOWL',2,12.5],
  ['Travis Head','BAT',2,14],['David Warner','BAT',2,null],['Glenn Maxwell','AR',2,4.2],
  ['Marcus Stoinis','AR',2,11],['Aaron Hardie','AR',1.25,1.25],['Mitch Owen','BAT',0.75,null],
  ['Xavier Bartlett','BOWL',0.75,0.8],['Spencer Johnson','BOWL',2,2.8],
  ['Heinrich Klaasen','BAT',2,23],['Kagiso Rabada','BOWL',2,10.75],
  ['Marco Jansen','AR',1.25,7],['Gerald Coetzee','BOWL',1.25,2.4],
  ['Anrich Nortje','BOWL',2,6.5],['Rassie van der Dussen','BAT',2,null],
  ['Donovan Ferreira','BAT',0.75,0.75],['Dewald Brevis','BAT',1.5,null],
  ['Kwena Maphaka','BOWL',0.75,1.5],['Nandre Burger','BOWL',1.25,null],
  ['Lhuan-Dre Pretorius','AR',0.75,null],
  ['Rashid Khan','BOWL',2,18],['AM Ghazanfar','BOWL',0.75,4.8],
  ['Noor Ahmad','BOWL',2,10],['Karim Janat','AR',0.75,0.75],
  ['Matthew Breetzke','BAT',0.75,0.75],['Aiden Markram','BAT',2,2],
  ['Ryan Rickelton','BAT',1,1],['Corbin Bosch','AR',0.3,null],
  ['Eshan Malinga','BOWL',0.3,1.2],['Nuwan Thushara','BOWL',0.75,1.6],
  ['Kamindu Mendis','AR',0.75,0.75],['Dushmantha Chameera','BOWL',0.75,0.75],
  ['Matheesha Pathirana','BOWL',2,13],['Nathan Ellis','BOWL',1.25,2],
  ['Jamie Overton','AR',1.5,1.5],['Tim David','AR',2,3],
  ['Romario Shepherd','AR',1.5,1.5],['Sherfane Rutherford','BAT',1.5,2.6],
  ['Shamar Joseph','BOWL',0.75,0.75],['Rovman Powell','BAT',1.5,1.5],
  ['Sunil Narine','BOWL',2,12],['Andre Russell','AR',2,12],
  ['Moeen Ali','AR',2,2],['Shahbaz Ahmed','AR',1,2.4],
  ['Washington Sundar','AR',2,3.2],['Sai Kishore','AR',0.75,2],
  ['Jayant Yadav','AR',0.75,0.75],['Ishant Sharma','BOWL',0.75,0.75],
  ['Umran Malik','BOWL',0.75,0.75],['Manish Pandey','BAT',0.75,0.75],
  ['Ajinkya Rahane','BAT',1.5,1.5],['Deepak Hooda','AR',0.75,1.7],
];

// 2026-only players not in 2025 CSV
const SQUAD_2026_ONLY = [
  { name: 'Jamie Overton', role: 'All-Rounder', isOverseas: true, basePrice: 1.5, nationality: 'English' },
  { name: 'Dewald Brevis', role: 'Batter', isOverseas: true, basePrice: 1.5, nationality: 'South African' },
  { name: 'Corbin Bosch', role: 'All-Rounder', isOverseas: true, basePrice: 0.3, nationality: 'South African' },
  { name: 'Lhuan-Dre Pretorius', role: 'All-Rounder', isOverseas: true, basePrice: 0.75, nationality: 'South African' },
  { name: 'Nandre Burger', role: 'Bowler', isOverseas: true, basePrice: 1.25, nationality: 'South African' },
  { name: 'Mitch Owen', role: 'Batter', isOverseas: true, basePrice: 0.75, nationality: 'Australian' },
  { name: 'Xavier Bartlett', role: 'Bowler', isOverseas: true, basePrice: 0.75, nationality: 'Australian' },
];

// Build overseas lookup from 2026 squads
const OVERSEAS_2026 = new Set();
Object.values(SQUADS_2026).forEach(players =>
  players.forEach(p => { if (p.isOverseas) OVERSEAS_2026.add(p.name.toLowerCase().replace(/[^a-z0-9]/g, '')); })
);

function normalize(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Build pool from 2025 CSV
const seen = new Set();
const pool = [];

for (const [name, type, basePrice, soldPrice] of RAW_2025) {
  const slug = toSlug(name);
  if (seen.has(slug)) continue;
  seen.add(slug);

  const isOverseas = OVERSEAS_2026.has(normalize(name)) ||
    NATIONALITY_MAP[name] !== undefined && NATIONALITY_MAP[name] !== 'Indian';
  const role = getRole(type);

  pool.push({
    id: slug,
    name,
    nationality: NATIONALITY_MAP[name] || 'Indian',
    role,
    isCapped: basePrice >= 1.0,
    isOverseas,
    pool: getPoolByRole(name, role, isOverseas, basePrice),
    basePrice,
    country: isOverseas ? 'OS' : 'IN',
    stats: soldPrice ? `IPL 2025: Sold for ₹${soldPrice}Cr` : `Base: ₹${basePrice}Cr`,
    auctioned: false,
  });
}

// Add 2026-only players
for (const p of SQUAD_2026_ONLY) {
  const slug = toSlug(p.name);
  if (seen.has(slug)) continue;
  seen.add(slug);
  pool.push({
    id: slug,
    name: p.name,
    nationality: p.nationality,
    role: p.role,
    isCapped: p.basePrice >= 1.0,
    isOverseas: p.isOverseas,
    pool: 'overseas',
    basePrice: p.basePrice,
    country: 'OS',
    stats: `IPL 2026 squad player`,
    auctioned: false,
  });
}

// Shuffle within each pool group (not across pools)
function shuffleWithinPools(players) {
  const poolOrder = ['marquee','capped_batters','capped_bowlers','capped_allrounders','overseas','uncapped','emerging'];
  const groups = {};
  poolOrder.forEach(p => { groups[p] = []; });
  players.forEach(p => {
    if (groups[p.pool]) groups[p.pool].push(p);
    else groups['uncapped'].push(p);
  });
  // Fisher-Yates shuffle within each pool
  Object.values(groups).forEach(arr => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  });
  return poolOrder.flatMap(p => groups[p]);
}

export const PLAYER_POOL = shuffleWithinPools(pool);

export const TEAM_SQUAD_MAP = {};

export default PLAYER_POOL;
