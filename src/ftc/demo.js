// Sample event for demo mode, shaped like a real hybrid schedule response.
// Qualification 11 is on the field and ours is Q14, so the "two matches before" alert shows.
const { buildMatches } = require('./schedule');

const NAMES = {
  11111: 'Gear Wizards',
  22222: 'Robo Lions',
  33333: 'Circuit Breakers',
  44444: 'Iron Owls',
  55555: 'Byte Me',
  66666: 'Tech Tigers',
  77777: 'Bolt Brigade',
  88888: 'Quantum Cats',
  99999: 'Spark Plugs',
  12121: 'Torque Tribe',
  13131: 'Pixel Pilots',
  14141: 'Servo Squad',
};
const OTHERS = Object.keys(NAMES).map(Number);
const OUR_MATCHES = {
  3: [['us', 11111], [33333, 44444]],
  9: [[55555, 66666], ['us', 77777]],
  14: [['us', 22222], [88888, 99999]],
  21: [[33333, 88888], ['us', 55555]],
  27: [['us', 44444], [66666, 11111]],
  33: [[99999, 77777], ['us', 22222]],
};
const ON_FIELD = 11;

function demoDashboard(teamNumber) {
  const us = Number(teamNumber);
  const names = { ...NAMES, [us]: 'הקבוצה שלנו' };
  const day = new Date().toISOString().slice(0, 10);
  const pad = (n) => String(n).padStart(2, '0');

  const schedule = [];
  for (let n = 1; n <= 36; n += 1) {
    const minutes = 9 * 60 + (n - 1) * 6;
    const time = `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
    const ours = OUR_MATCHES[n];
    const pick = (i) => OTHERS[(n * 5 + i * 7) % OTHERS.length];
    const [red, blue] = ours
      ? ours.map((side) => side.map((t) => (t === 'us' ? us : t)))
      : [[pick(0), pick(1)], [pick(2), pick(3)]];
    const started = n <= ON_FIELD;
    const scored = n < ON_FIELD;
    const redScore = 80 + ((n * 37) % 90);
    const blueScore = 80 + ((n * 53) % 90);
    schedule.push({
      tournamentLevel: 'QUALIFICATION',
      series: 0,
      matchNumber: n,
      description: `Qualification ${n}`,
      startTime: `${day}T${time}:00`,
      actualStartTime: started ? `${day}T${time}:30` : null,
      postResultTime: scored ? `${day}T${time}:59` : null,
      scoreRedFinal: scored ? redScore : null,
      scoreBlueFinal: scored ? blueScore : null,
      teams: [
        { teamNumber: red[0], station: 'Red1' },
        { teamNumber: red[1], station: 'Red2' },
        { teamNumber: blue[0], station: 'Blue1' },
        { teamNumber: blue[1], station: 'Blue2' },
      ],
    });
  }

  return {
    season: 2026,
    teamNumber: us,
    teamName: names[us],
    event: { code: 'DEMO', name: 'אירוע הדגמה', city: '', dateStart: day, dateEnd: day },
    eventTeams: Object.entries(names).map(([number, name]) => ({ number: Number(number), name })),
    ...buildMatches(schedule, us, names),
  };
}

module.exports = { demoDashboard };
