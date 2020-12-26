
const fn = async () => {
  require('..');
  await syzoj.untilStarted;

  const User = syzoj.model('user');
  const Problem = syzoj.model('problem');
  const JudgeState = syzoj.model('judge_state');
  const Contest = syzoj.model('contest');

  let contestIds = new Set((await Contest.find({ type: 'crt' })).map(contest => contest.id));
  let problemIds = new Set();
  let userIds = new Set();

  for (let judge_state of await JudgeState.find({ type: 1 })) {
    const { problem_id, user_id, type_info } = judge_state;

    if (contestIds.has(type_info)) {
      problemIds.add(problem_id);
      userIds.add(user_id);

      judge_state.type = 2;
      await judge_state.save();

      let problem = await Problem.findById(problem_id);
      await problem.updateStatistics(user_id);
    }
  }

  await Promise.all([...userIds].map(async userId => {
    let user = await User.findById(userId);
    await user.refreshSubmitInfo();
  }));

  await Promise.all([...problemIds].map(async problemId => {
    let problem = await Problem.findById(problemId);
    await problem.resetSubmissionCount();
  }));

  process.exit(0);
};

fn();
