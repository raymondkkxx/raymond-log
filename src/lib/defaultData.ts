export type PriorityLevel = 'critical' | 'medium' | 'important'

export interface CountdownItem {
  id: string
  category: string
  title: string
  subtitle: string
  targetDate: string
  image: string
  badgeText?: string
  color?: string
  link?: string
  isPinned?: boolean
  isArchived?: boolean
  priority?: PriorityLevel
}

export interface ImpossibleItem {
  id: string
  title: string
  completed: boolean
  completedDate?: string
  progress?: string
  linkText?: string
  linkUrl?: string
  nextItemId?: string
  parentItemId?: string
}

export interface ImpossibleCategory {
  id: string
  name: string
  items: ImpossibleItem[]
}

export interface ImpossibleListData {
  categories: ImpossibleCategory[]
  zeroInOnIds: string[]
}

export const DEFAULT_DEADLINES: CountdownItem[] = [
  {
    id: '1',
    category: 'TV',
    title: 'TED LASSO',
    subtitle: 'SEASON 4 EPISODE 10 RELEASE DATE',
    targetDate: '2026-10-06T15:00',
    image: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=80',
    color: '#0071e3',
    isPinned: true,
    priority: 'medium',
  },
  {
    id: '2',
    category: 'TV',
    title: 'HELLUVA BOSS',
    subtitle: 'SEASON 3 PREMIERE DATE',
    targetDate: '2026-10-13T12:00',
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    color: '#ff375f',
    link: 'https://baidu.com',
    priority: 'important',
  },
  {
    id: '3',
    category: 'TV',
    title: 'BLEACH: THOUSAND-YEAR BLOOD WAR',
    subtitle: 'SEASON 4 EPISODE 9 RELEASE DATE',
    targetDate: '2026-10-19T23:00',
    image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80',
    color: '#ff9f0a',
    priority: 'medium',
  },
  {
    id: '4',
    category: 'TV',
    title: 'SOUTH PARK',
    subtitle: 'SEASON 29 EPISODE 3 RELEASE DATE',
    targetDate: '2026-10-24T22:00',
    image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80',
    color: '#34c759',
    priority: 'important',
  },
  {
    id: '5',
    category: 'MOVIE',
    title: 'GATTO',
    subtitle: 'OFFICIAL THEATRICAL RELEASE DATE',
    targetDate: '2026-11-05T00:00',
    image: 'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?auto=format&fit=crop&w=800&q=80',
    color: '#30b0c7',
    priority: 'important',
  },
  {
    id: '6',
    category: 'GAME',
    title: 'GRAND THEFT AUTO VI (GTA 6)',
    subtitle: 'OFFICIAL WORLDWIDE RELEASE DATE',
    targetDate: '2026-11-20T00:00',
    image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80',
    color: '#af52de',
    priority: 'critical',
  },
  {
    id: '7',
    category: 'TEST',
    title: '考研初试',
    subtitle: '全国硕士研究生统一招生考试',
    targetDate: '2026-12-19T08:30',
    image: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80',
    badgeText: 'FINAL SPRINT',
    color: '#ff453a',
    isPinned: true,
    priority: 'critical',
  },
  {
    id: '8',
    category: 'MOVIE',
    title: 'AVENGERS: DOOMSDAY',
    subtitle: 'MARVEL STUDIOS PREMIERE',
    targetDate: '2026-12-25T00:00',
    image: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?auto=format&fit=crop&w=800&q=80',
    badgeText: 'CONFIRMED',
    color: '#34c759',
    priority: 'medium',
  },
  {
    id: '9',
    category: 'OTHER',
    title: 'THE YEAR 2027',
    subtitle: 'COUNTDOWN TO NEW YEARS DAY',
    targetDate: '2027-01-01T00:00',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
    color: '#ffd60a',
    priority: 'important',
  },
  {
    id: '10',
    category: 'MOVIE',
    title: 'SONIC THE HEDGEHOG 4',
    subtitle: 'THEATRICAL RELEASE DATE',
    targetDate: '2027-03-18T00:00',
    image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
    color: '#0071e3',
    priority: 'important',
  },
  {
    id: '11',
    category: 'TV',
    title: 'STICK',
    subtitle: 'SEASON 2 PREMIERE DATE',
    targetDate: '2027-05-10T00:00',
    image: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=800&q=80',
    color: '#ff9f0a',
    priority: 'important',
  },
  {
    id: '12',
    category: 'TV',
    title: 'SILO',
    subtitle: 'SEASON 4 PREMIERE DATE',
    targetDate: '2027-08-15T00:00',
    image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80',
    badgeText: 'UNCONFIRMED',
    color: '#bf5af2',
    priority: 'medium',
  },
  {
    id: '13',
    category: 'TV',
    title: 'DARLING IN THE FRANXX',
    subtitle: 'SEASON 2 RELEASE DATE',
    targetDate: '2027-09-15T00:00',
    image: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80',
    badgeText: 'UNCONFIRMED',
    color: '#ff375f',
    priority: 'important',
  },
  {
    id: '14',
    category: 'TV',
    title: 'GAME OF THRONES: SNOW',
    subtitle: 'SEQUEL SERIES PREMIERE',
    targetDate: '2027-11-05T00:00',
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    badgeText: 'UNCONFIRMED',
    color: '#5e5ce6',
    priority: 'important',
  },
  {
    id: '15',
    category: 'GAME',
    title: 'ZIBA',
    subtitle: 'PC RELEASE DATE',
    targetDate: '2028-06-01T00:00',
    image: 'https://images.unsplash.com/photo-1552824722-ddab1374e622?auto=format&fit=crop&w=800&q=80',
    badgeText: 'UNCONFIRMED',
    color: '#30b0c7',
    priority: 'important',
  },
  {
    id: 'archived-1',
    category: 'GAME',
    title: 'BLACK MYTH: WUKONG',
    subtitle: '全球同步正式发售与首发通关',
    targetDate: '2024-08-20T10:00',
    image: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80',
    badgeText: 'LAUNCHED',
    color: '#ffffff',
    link: 'https://store.steampowered.com',
    isArchived: true,
    priority: 'critical',
  },
  {
    id: 'archived-2',
    category: 'TEST',
    title: '硕士毕业论文答辩',
    subtitle: '论文最终定稿与学位答辩委员会表决通过',
    targetDate: '2026-06-15T09:00',
    image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80',
    badgeText: 'PASSED',
    color: '#ffffff',
    isArchived: true,
    priority: 'critical',
  },
  {
    id: 'archived-3',
    category: 'LIFE',
    title: '城市半程马拉松',
    subtitle: '首场 21.0975km 挑战顺利完赛',
    targetDate: '2026-04-19T07:30',
    image: 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?auto=format&fit=crop&w=800&q=80',
    badgeText: 'FINISHED',
    color: '#ffffff',
    isArchived: true,
    priority: 'medium',
  },
]

export const DEFAULT_IMPOSSIBLE_CATEGORIES: ImpossibleCategory[] = [
  {
    id: 'cat-travel',
    name: 'Travel',
    items: [
      { id: 't-1', title: 'Visit Every Continent', completed: true, completedDate: 'Jan 20th, 2017' },
      { id: 't-2', title: 'Go Swimming in Every Ocean', completed: false },
      { id: 't-3', title: 'Travel For 1 Year Straight', completed: true, completedDate: 'Jun 30th, 2017' },
      { id: 't-4', title: 'Get a 2nd U.S. Passport', completed: false },
      { id: 't-5', title: 'Obtain dual citizenship with another country', completed: false },
      { id: 't-6', title: 'Become an Estonian E-citizen', completed: true, completedDate: 'Aug 8th, 2016' },
      { id: 't-7', title: 'Own a small flat in 4 different countries.', completed: false },
      { id: 't-8', title: 'Live on the beach in some tropical country for 3 months.', completed: false },
      { id: 't-9', title: 'Do A Cross Country Road Trip And Make a Film About It', completed: false },
      { id: 't-10', title: 'Do A Round-The-World Trip And Make A Film About It', completed: false },
      { id: 't-11', title: 'Visit All 50 States', completed: false, progress: '49/50' },
      { id: 't-12', title: 'Visit 20 Countries', completed: true, completedDate: 'Mar 10th, 2018', nextItemId: 't-13' },
      { id: 't-13', title: 'Visit 50 Countries', completed: false, parentItemId: 't-12' },
      { id: 't-14', title: 'Visit 100 Countries', completed: false },
      { id: 't-15', title: 'Visit 150 Countries', completed: false },
      { id: 't-16', title: 'Visit all the Countries', completed: false, progress: '47 total' },
      { id: 't-17', title: 'Start Impossible Island', completed: false, linkText: 'Link', linkUrl: 'https://impossiblehq.com' },
    ],
  },
  {
    id: 'cat-minimalism',
    name: 'Minimalism',
    items: [
      { id: 'm-1', title: 'Go without internet for a month', completed: true, completedDate: 'Jul 31st, 2009' },
      { id: 'm-2', title: 'Go without a car for a month', completed: true, completedDate: 'Feb 29th, 2012' },
      { id: 'm-3', title: 'Count & document all my crap', completed: true, completedDate: 'Feb 28th, 2014' },
      { id: 'm-4', title: 'Own less than 300 things', completed: true, completedDate: 'May 2nd, 2014' },
      { id: 'm-5', title: 'Create a "Getaway" Backpack', completed: false, linkText: 'Link', linkUrl: '#' },
    ],
  },
  {
    id: 'cat-adrenaline',
    name: 'Adrenaline Rushes',
    items: [
      { id: 'a-1', title: 'Go Skydiving', completed: true, completedDate: 'May 1st, 2011' },
      { id: 'a-2', title: 'Go Bungee Jumping', completed: true, completedDate: 'Jun 6th, 2011' },
      { id: 'a-3', title: 'Go Paragliding', completed: true, completedDate: 'May 1st, 2012' },
      { id: 'a-4', title: 'Go Parasailing', completed: true, completedDate: 'Aug 1st, 2009' },
      { id: 'a-5', title: 'Learn to Kitesurf', completed: true, completedDate: 'May 14th, 2012', nextItemId: 'a-6' },
      { id: 'a-6', title: 'Kitesurf for a month', completed: false, parentItemId: 'a-5' },
      { id: 'a-7', title: 'Learn to Surf', completed: false },
      { id: 'a-8', title: 'Bike Across America', completed: false },
      { id: 'a-9', title: 'Get PADI Certified & go scuba diving', completed: false },
      { id: 'a-10', title: 'Climb a Volcano', completed: true, completedDate: 'Jan 7th, 2004' },
      { id: 'a-11', title: 'Learn To Freedive', completed: false },
      { id: 'a-12', title: 'Go Zorbing', completed: true, completedDate: 'Sep 1st, 2013' },
      { id: 'a-13', title: 'Go Indoor Skydiving', completed: true, completedDate: 'Sep 1st, 2013' },
      { id: 'a-14', title: 'Walk With Wolves (and get kissed by one)', completed: true, completedDate: 'Sep 1st, 2013' },
      { id: 'a-15', title: 'Fly A Rocketman Water Jet Lev Fly Board', completed: true, completedDate: 'Aug 19th, 2013' },
      { id: 'a-16', title: 'Fly A Flyboard Water Hoverboard', completed: true, completedDate: 'Aug 20th, 2013' },
    ],
  },
  {
    id: 'cat-misc',
    name: 'Misc.',
    items: [
      { id: 'mi-1', title: 'Be an Extra in a Movie', completed: true, completedDate: 'Nov 12th, 2010' },
      { id: 'mi-2', title: 'Do Adventure Roulette', completed: true, completedDate: 'Aug 30th, 2013' },
      { id: 'mi-3', title: 'Get something named after me', completed: false },
    ],
  },
  {
    id: 'cat-events',
    name: 'Events to Attend',
    items: [
      { id: 'e-1', title: 'Visit Burning Man And Document It', completed: false },
      { id: 'e-2', title: 'Participate in Tomatina', completed: false },
      { id: 'e-3', title: 'Running of the Bulls', completed: false },
      { id: 'e-4', title: 'See The Northern Lights & Make A Time Lapse Film Of It', completed: false },
      { id: 'e-5', title: 'Coachella', completed: false },
      { id: 'e-6', title: 'Bonnaroo', completed: true, completedDate: 'Jun 1st, 2013' },
      { id: 'e-7', title: 'SXSW', completed: true, completedDate: 'May 31st, 2012' },
      { id: 'e-8', title: 'Lollapalooza', completed: false },
      { id: 'e-9', title: 'Mardi Gras', completed: false },
    ],
  },
]

export const DEFAULT_ZERO_IN_ON = ['t-13', 'a-6', 't-2']