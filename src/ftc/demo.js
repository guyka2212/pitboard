// Sample event for demo mode, shaped like a real hybrid schedule response.
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
};

function demoDashboard(teamNumber) {
  const us = Number(teamNumber);
  const names = { ...NAMES, [us]: 'הקבוצה שלנו' };
  const day = new Date().toISOString().slice(0, 10);

  const match = (n, time, red, blue, score) => ({
    tournamentLevel: 'QUALIFICATION',
    series: 0,
    matchNumber: n,
    description: `Qualification ${n}`,
    startTime: `${day}T${time}:00`,
    actualStartTime: score ? `${day}T${time}:30` : null,
    postResultTime: score ? `${day}T${time}:59` : null,
    scoreRedFinal: score ? score[0] : null,
    scoreBlueFinal: score ? score[1] : null,
    teams: [
      { teamNumber: red[0], station: 'Red1' },
      { teamNumber: red[1], station: 'Red2' },
      { teamNumber: blue[0], station: 'Blue1' },
      { teamNumber: blue[1], station: 'Blue2' },
    ],
  });

  const schedule = [
    match(3, '09:20', [us, 11111], [33333, 44444], [142, 98]),
    match(9, '09:56', [55555, 66666], [us, 77777], [120, 131]),
    match(14, '10:26', [us, 22222], [88888, 99999]),
    match(21, '11:08', [33333, 88888], [us, 55555]),
    match(27, '11:44', [us, 44444], [66666, 11111]),
    match(33, '12:20', [99999, 77777], [us, 22222]),
  ];

  return {
    season: 2026,
    teamNumber: us,
    teamName: names[us],
    event: { code: 'DEMO', name: 'אירוע הדגמה', city: '', dateStart: day, dateEnd: day },
    ...buildMatches(schedule, us, names),
  };
}

module.exports = { demoDashboard };
