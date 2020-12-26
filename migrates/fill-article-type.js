
const fn = async () => {
  require('..');
  await syzoj.untilStarted;

  const Article = syzoj.model('article');

  const articles = await Article.find();

  const solution_titles = ["题解", "社论", "solution", "editorial"];

  for (let article of articles) {
    if (article.forum) continue;
    if (article.problem_id) {
      const is_solution = solution_titles.some(str => article.title.toLowerCase().includes(str));
      article.forum = is_solution ? "solutions" : "problems";
    } else {
      article.forum = 'global';
    }
    await article.save();
  }

  process.exit(0);
};

fn();
