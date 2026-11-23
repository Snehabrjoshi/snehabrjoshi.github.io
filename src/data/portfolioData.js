// A project without a repository URL links to the profile.
const GITHUB_PROFILE = 'https://github.com/Snehabrjoshi';
const githubLink = (url) => ({ href: url || GITHUB_PROFILE, text: 'View on GitHub →' });

export const PORTFOLIO_BOOKS = [
  {
    id: 'about',
    blurb: 'Background and how I work',
    // Cover/spine motif on the shared 5×5 grid: an "S" monogram in cells.
    motif: { type: 'cells', rows: ['.####', '#....', '.###.', '....#', '####.'] },
    volume: '01',
    title: 'ABOUT',
    subtitle: 'My story',
    coverColor: '#173f32',
    foilColor: '#d9bb79',
    lead: 'Uncovering patterns in data and engineering thoughtful solutions around them.',
    html: `
      <h3>The opening chapter</h3>
      <p>
      Hello, I’m Sneha! I work with large datasets to help teams spot patterns and anticipate what’s 
      next for their projects and programs. I love building new things from scratch and whether a project 
      already has a clear direction or needs one defined, I enjoy finding the thread that makes it matter. 
      To me, the best engineering happens when you pay close attention to real people, understand what they actually need, 
      and build something intuitive that works.</p>
      <p>Outside of code and data, I’ve gotten really into reading this year (I’m always open to book recs!). 
      I also play a ton of sports and can easily spend an entire day at the beach without feeling like it was 
      nearly enough time; in fact, two of my favorite projects started as ideas while I was sitting by the ocean. 
      I love picking up new skills, and once I set my mind to learning something, I’m all in until I get it right.</p>
    `,
  },
  {
    id: 'experience',
    name: 'Work Experience',
    blurb: 'Data analysis, software and learning design',
    // A Gantt-style timeline: [row, first column, length] per bar.
    motif: {
      type: 'gantt',
      bars: [
        [0, 0, 2],
        [1, 1, 2],
        [2, 2, 3],
        [3, 1, 3],
        [4, 3, 2],
      ],
    },
    volume: '02',
    title: 'WORK EXPERIENCE',
    spineTitle: 'EXPERIENCE', // "WORK EXPERIENCE" is too long to stay legible on a spine
    subtitle: 'Where I’ve worked',
    coverColor: '#652b2e',
    foilColor: '#e2c586',
    lead: 'Two roles: turning program data into decisions, and building learning games that adapt to their players.',
    html: '',
    cards: [
      {
        colour: '#293458',
        kicker: 'Arizona State University',
        logo: 'logos/asu.png',
        title: 'Data Analyst',
        meta: 'Since May 2026',
        summary:
          'Builds the pipelines, databases and analyses that turn program data into same-day decisions.',
        detailsLabel: 'Skills',
        details: ['Python', 'SQL', 'Statistical modelling', 'Airtable', 'Power BI'],
        bullets: [
          'Built automated Python/SQL pipelines and statistical models that clean and analyse 100,000+ daily student records, cutting processing errors by 40%.',
          'Architected a relational database in Airtable powering real-time analytics across 60+ organisations, enabling same-day operational adjustments.',
          'Analysed 50,000+ rows of engagement data with program leadership; the behavioural trends found drove a 35% increase in participation.',
        ],
      },
      {
        colour: '#652b2e',
        kicker: 'Mentamorph Money',
        logo: 'logos/mentamorph.png',
        title: 'Software Engineer & Learning Experience Designer',
        meta: 'Since August 2026',
        summary: 'Builds the systems behind educational games, and designs the learning in them.',
        detailsLabel: 'Skills',
        details: ['Figma', 'Unity', 'React.js', 'C#'],
        bullets: [
          'Designed the initial Figma prototypes for weaving educational content into gameplay, defining where and how learning moments appear without breaking the player’s flow.',
          'Implemented the educational content UI from those designs using React.js and C# in Unity, working with the team to turn prototypes into in-game components.',
          'Co-built the backend system that tracks player confidence, triggering the right educational content on the front end when a player is struggling.',
        ],
      },
    ],
    cardLayout: 'right',
    cardAction: 'Explore experience',
    timeline: true,
  },
  {
    id: 'projects',
    blurb: 'SignalTrace, ResilientLink and CueShift',
    // Connected nodes, like a small system diagram: [column, row] per node.
    motif: {
      type: 'graph',
      nodes: [
        [0, 2],
        [2, 0],
        [2, 4],
        [4, 2],
        [2, 2],
      ],
      edges: [
        [0, 4],
        [1, 4],
        [2, 4],
        [3, 4],
        [1, 3],
      ],
    },
    volume: '03',
    title: 'PROJECTS',
    subtitle: 'Selected work',
    coverColor: '#755025',
    foilColor: '#e8cb83',
    lead: 'A collection of systems and experiments built around meaningful technical problems.',
    html: '',
    cards: [
      {
        colour: '#173f32',
        kicker: 'AI · Observability',
        id: 'signaltrace', // public/projects/signaltrace.jpg, if present, replaces the motif
        title: 'SignalTrace',
        meta: 'Incident Intelligence',
        summary: 'Finds which service caused a microservice failure, and shows the evidence.',
        detailsLabel: 'Stack',
        details: [
          'Python',
          'FastAPI',
          'Next.js',
          'PostgreSQL + pgvector',
          'OpenTelemetry',
          'Docker',
          'Grafana',
        ],
        bullets: [
          'Problem: During an incident, engineers dig through scattered traces, logs and metrics to find the failing service, and AI tools often guess without showing why.',
          'Approach: Correlates telemetry from the OpenTelemetry demo’s microservices to rank likely root causes, with every diagnosis linked to the exact traces, logs and recent changes behind it, plus a confidence score and a suggested next step.',
          'Evaluation: 15–20 injected faults, measuring top-1/top-3 root-cause accuracy, detection time, diagnosis latency, unsupported-claim rate, and accuracy when telemetry is missing.',
        ],
        link: githubLink(''),
      },
      {
        colour: '#174750',
        kicker: 'Distributed systems · Offline-first',
        id: 'resilientlink', // public/projects/resilientlink.jpg, if present, replaces the motif
        title: 'ResilientLink',
        meta: 'Emergency Coordination',
        summary: 'Disaster coordination that keeps working when the network doesn’t.',
        detailsLabel: 'Stack',
        details: [
          'TypeScript',
          'React (PWA)',
          'Service Workers',
          'IndexedDB',
          'FastAPI',
          'PostgreSQL/PostGIS',
          'WebSockets',
        ],
        bullets: [
          'Problem: Coordinating requests, volunteers, shelters and supplies breaks down exactly when connectivity is worst.',
          'Approach: Records are created and edited offline, then synced on reconnect with explicit conflict resolution, duplicate-request prevention and a full audit history, with role-based access throughout.',
          'Matching: Map-based request and supply matching that prioritises by urgency and distance, using live USGS earthquake feeds and OpenFEMA disaster data.',
          'Evaluation: Network-partition simulations verifying no records are lost or duplicated after sync.',
        ],
        link: githubLink(''),
      },
      {
        colour: '#755025',
        kicker: 'Multimodal ML · Privacy-first',
        id: 'cueshift', // public/projects/cueshift.jpg, if present, replaces the motif
        title: 'CueShift',
        meta: 'Multimodal Conversation Dynamics',
        summary:
          'Pinpoints where someone’s observable behaviour shifts during a conversation, and around which topic.',
        detailsLabel: 'Stack',
        details: [
          'Python',
          'MediaPipe Face Landmarker',
          'openSMILE',
          'pyannote',
          'speech-to-text',
          'change-point detection',
        ],
        bullets: [
          'Problem: Emotion-recognition tools assign labels like “angry” that the evidence can’t support.',
          'Approach: Aligns facial movement, vocal features, speaker turns and transcript topics on one timeline, compares each moment with the speaker’s own baseline, and reports a change magnitude with its evidence: describing behaviour, never labelling emotions.',
          'Evaluation: Consented recordings with planned topic changes, measuring change-point F1, timing error, correlation with participants’ self-ratings, and face-only vs voice-only vs combined performance.',
          'Privacy: Explicit consent, local processing, and a mode that keeps only derived numbers and deletes the recording.',
        ],
        link: githubLink(''),
      },
    ],
    cardLayout: 'spread',
    cardAction: 'Explore project',
  },
  {
    id: 'skills',
    blurb: 'Languages, data, software and tools',
    // A crossword grid: '#' filled, '.' an empty outlined cell.
    motif: { type: 'cells', rows: ['#.##.', '.#..#', '###.#', '..##.', '#.#..'], outline: true },
    volume: '04',
    title: 'SKILLS',
    subtitle: 'My toolkit',
    coverColor: '#293458',
    foilColor: '#ddc17e',
    lead: 'The languages, analytical tools, and design methods I use to bring ideas to life.',
    html: '',
    skillsOnLeft: 2,
    skillGroups: [
      {
        heading: 'Languages',
        items: [
          { name: 'Python', libs: ['Pandas', 'NumPy', 'Matplotlib', 'Scikit-learn'] },
          'Java',
          'C#',
          'JavaScript',
          'React.js',
          'HTML',
          'CSS',
        ],
      },
      {
        heading: 'Data & Analytics',
        items: [
          'SQL',
          'Data Pipeline Design',
          'ETL Workflows',
          'Data Cleaning & Transformation',
          'Exploratory Data Analysis',
          'Statistical Analysis',
          'Hypothesis Testing',
          'Data Visualization',
        ],
      },
      {
        heading: 'Software Development',
        items: [
          'Full-Stack Development',
          'Backend Architecture',
          'RESTful API Design',
          'System Design',
          'Object-Oriented Programming',
          'Software Architecture',
        ],
      },
      {
        heading: 'Development Tools',
        items: [
          'Git/GitHub',
          'JIRA',
          'Agile/Scrum',
          'Version Control',
          'CI/CD Fundamentals',
          'Collaborative Development',
        ],
      },
      {
        heading: 'Design & Game Development',
        items: ['Figma', 'Prototyping', 'Unity'],
      },
      {
        heading: 'Professional Strengths',
        plain: true,
        items: [
          'Analytical Problem-Solving',
          'Attention to Detail',
          'Systems Thinking',
          'Reliability-Focused Development',
          'Communication Skills',
          'Independent Learning',
          'Remote Collaboration',
          'Business Acumen',
        ],
      },
      {
        heading: 'Currently learning',
        plain: true,
        items: [
          'FastAPI',
          'Docker',
          'OpenTelemetry',
          'PostgreSQL/PostGIS',
          'TypeScript',
          'Service Workers & IndexedDB',
          'MediaPipe',
        ],
      },
    ],
  },
  {
    id: 'contact',
    blurb: 'Links and a note card',
    // "hi" in Morse code, one letter per row.
    motif: { type: 'morse', text: 'hi' },
    volume: '05',
    title: 'CONTACT',
    subtitle: 'Say hello',
    coverColor: '#174750',
    foilColor: '#e4c984',
    lead: 'Interested in software engineering, AI/ML, analytics, and product-focused opportunities.',
    html: `
      <h3>Start a conversation</h3>
      <p>If you have an interesting problem, opportunity, or idea, I would love to hear about
      it.</p>
    `,
    contact: true,
  },
];

export const PROFILE = {
  firstName: 'Sneha',
  lastName: 'Joshi',
  statement: 'I turn complicated ideas into experiences that feel clear, useful, and human.',
};

export const LINKS = {
  resume: 'resume.pdf', // the masthead hides it while public/resume.pdf is missing
  github: GITHUB_PROFILE,
  // This site's repository; the colophon links to `github` while it is empty.
  repo: '',
  email: 'snehabjoshi05@gmail.com',
  linkedin: 'https://www.linkedin.com/in/sneha-joshi-380b88299',
  goodreads: 'https://www.goodreads.com/user/show/204912018-sneha-joshi',
};

// AVIF and WebP sizes are generated from these before every build (npm run photos).
export const PHOTOS = [
  {
    src: '/photos/work.jpg',
    alt: 'Sneha working on a laptop at a desk',
    caption: 'How you’ll usually find me: mid-debug',
    place: 'Phoenix',
    date: '2026',
  },
  {
    src: '/photos/hackathon.jpg',
    alt: 'My teammates working at a hackathon table',
    caption: 'Demo day: one-day hackathon, one working prototype, very little sleep.',
    place: 'Tempe',
    date: '2026',
  },
  {
    src: '/photos/beach.jpg',
    alt: 'A pier with a red-roofed building over grey surf under a cloudy sky',
    caption: 'Where most of my projects actually happen.',
    place: 'SoCal',
    date: '2026',
  },
];

// Build-time fallback for the live Goodreads shelves. Covers are downloaded at
// build time (npm run covers) so visitors never request a third-party image.
export const READING = {
  title: 'Reading',
  intro: 'Whatever is face down next to the coffee.',
  entries: [
    {
      label: 'Last read',
      title: 'The Seven Husbands of Evelyn Hugo',
      author: 'Taylor Jenkins Reid',
      isbn: '', // optional: pins the exact edition's cover
      note: '',
    },
    {
      label: 'Currently reading',
      title: 'Anxious People',
      author: 'Fredrik Backman',
      isbn: '',
      note: '',
    },
    {
      label: 'Next read',
      title: 'Atomic Habits',
      author: 'James Clear',
      isbn: '',
      note: '',
    },
  ],
  goodreads: LINKS.goodreads,
};

// Live from the API worker when it answers, else the committed build-time
// snapshot. The Spotify player loads only when "Play on Spotify" is pressed.
export const PLAYLIST = {
  title: 'Playlist',
  // Used only if the oEmbed name is missing (first build offline).
  name: 'Playlist',
  intro: 'On rotation while I work.',
  spotifyUrl: 'https://open.spotify.com/playlist/2ep3pk5VLPVoh6opRSkP79',
};

export const COLOPHON = {
  title: 'How this was built',
  html: `
    <p>Built with Three.js, GSAP and Vite: no templates or UI kits.</p>
    <p>Everything in the room is generated in code: there are no 3D model files. Book covers,
    textures and the garden outside the window are drawn as the page loads.</p>
    <p>The book pages are real HTML, so the text is selectable and works with screen readers.</p>
    <p>My reading list and playlist come from a small Cloudflare Worker I built. It pulls from
    Goodreads and Spotify every six hours and caches the results, so the site stays fast and the
    cards are never empty.</p>
    <p class="card-prose__source"><a href="${LINKS.repo || LINKS.github}" target="_blank" rel="noopener">View the source on GitHub →</a></p>
  `,
};
