let Problem = syzoj.model('problem');
let Article = syzoj.model('article');
let ArticleComment = syzoj.model('article-comment');
let User = syzoj.model('user');
let Contest = syzoj.model('contest');

const forum_list = syzoj.forum_list = [
  { name: 'global', title: '全局版块', icon: 'world', default: true },
  ...syzoj.config.discussion_forums,
  { name: 'problems', title: '题目', icon: 'book' },
  { name: 'solutions', title: '题解', icon: 'code' }
];
const forum_map = syzoj.forum_map = new Map(forum_list.map(forum => [forum.name, forum]));
const forums = forum_list.map(({ name }) => name);
const problem_forums = syzoj.problem_forums = ['problems', 'solutions'];

app.get('/discussion/:type?', async (req, res) => {
  try {
    if (!res.locals.user) throw new ErrorMessage('请登录后继续。', { '登录': syzoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });
    const forum = req.params.type;

    if (!forums.includes(forum)) {
      res.redirect(syzoj.utils.makeUrl(['discussion', 'global']));
    }

    let where = { forum };
    let paginate = syzoj.utils.paginate(await Article.countForPagination(where), req.query.page, syzoj.config.page.discussion);
    let articles = await Article.queryPage(paginate, where, {
      sort_time: 'DESC'
    });

    for (let article of articles) {
      await article.loadRelationships();
      if (article.problem_id) {
        article.problem = await Problem.findById(article.problem_id);
      }
    }

    res.render('discussion', {
      articles: articles,
      paginate: paginate,
      problem: null,
      forum: forum
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/discussion/problem/:pid', async (req, res) => {
  try {
    let pid = parseInt(req.params.pid);
    let problem = await Problem.findById(pid);
    if (!problem) throw new ErrorMessage('无此题目。');
    if (!await problem.isAllowedUseBy(res.locals.user)) {
      throw new ErrorMessage('您没有权限进行此操作。');
    }

    let where = { forum: "problems", problem_id: pid };
    let paginate = syzoj.utils.paginate(await Article.countForPagination(where), req.query.page, syzoj.config.page.discussion);
    let articles = await Article.queryPage(paginate, where, {
      sort_time: 'DESC'
    });

    for (let article of articles) await article.loadRelationships();

    res.render('discussion', {
      articles: articles,
      paginate: paginate,
      problem: problem,
      forum: 'problems'
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/article/:id', app.useRestriction, async (req, res) => {
  try {
    let id = parseInt(req.params.id);
    let article = await Article.findById(id);
    if (!article) throw new ErrorMessage('无此帖子。');
    await article.loadRelationships();
    article.allowedEdit = await article.isAllowedEditBy(res.locals.user);
    article.allowedComment = await article.isAllowedCommentBy(res.locals.user);
    if (article.forum === 'solutions' && article.is_public != 1 && !article.allowedEdit) throw new ErrorMessage('该题解未审核通过，暂时无法查看。');


    let where = { article_id: id };
    let commentsCount = await ArticleComment.countForPagination(where);
    let paginate = syzoj.utils.paginate(commentsCount, req.query.page, syzoj.config.page.article_comment);

    let comments = await ArticleComment.queryPage(paginate, where, {
      public_time: 'DESC'
    });

    for (let comment of comments) {
      comment.rendered_content = await syzoj.utils.markdown(comment.content);
      comment.allowedEdit = await comment.isAllowedEditBy(res.locals.user);
      await comment.loadRelationships();
    }

    let problem, contest;
    if (article.problem_id) {
      problem = article.problem = await Problem.findById(article.problem_id);
      if (req.query.contest_id) {
        contest = await Contest.findById(req.query.contest_id);
        if (!contest) throw new ErrorMessage('无此比赛。');
        contest.problems_id = await contest.getProblems();
        if (!contest.problems_id.includes(problem.id)) throw new ErrorMessage('比赛中无此题目。');
        if (!contest.allowedSeeingSolution()) throw new ErrorMessage('您没有权限进行此操作。');
      } else if (!await problem.isAllowedUseBy(res.locals.user)) {
        throw new ErrorMessage('您没有权限进行此操作。');
      }
    }

    await article.updateViews(res.locals.user);
    
    article.rendered_content = await syzoj.utils.markdown(article.content);

    res.render('article', {
      article: article,
      comments: comments,
      paginate: paginate,
      problem: problem,
      commentsCount: commentsCount,
      is_edit: false,
      contest: contest
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/article/:id/edit', async (req, res) => {
  try {
    if (!res.locals.user) throw new ErrorMessage('请登录后继续。', { '登录': syzoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });

    let id = parseInt(req.params.id);
    let article = await Article.findById(id);

    if (!article) {
      article = await Article.create();
      article.id = 0;
      article.allowedEdit = true;

      const { forum, problem_id } = req.query;

      if (!forums.includes(forum)) throw new ErrorMessage('无此版块。');
      article.forum = forum;

      if (problem_forums.includes(forum)) {
        let problem = await Problem.findById(problem_id);
        if (!problem) throw new ErrorMessage("无此题目。");
        if (!await problem.isAllowedUseBy(res.locals.user)) {
          throw new ErrorMessage('您没有权限进行此操作。');
        }
        article.problem_id = problem.id;
        article.problem = problem;
      }
    } else {
      article.allowedEdit = await article.isAllowedEditBy(res.locals.user);
      if (article.problem_id) {
        article.problem = await Problem.findById(article.problem_id);
      }
    }

    res.render('article_edit', {
      article: article,
      is_edit: true
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.post('/article/:id/edit', async (req, res) => {
  try {
    if (!res.locals.user) throw new ErrorMessage('请登录后继续。', { '登录': syzoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });

    let id = parseInt(req.params.id);
    let article = await Article.findById(id);

    let time = syzoj.utils.getCurrentDate();
    if (!article) {
      article = await Article.create();
      article.user_id = res.locals.user.id;
      article.public_time = article.sort_time = time;

      const { forum, problem_id } = req.query;
      if (!forums.includes(forum)) throw new ErrorMessage('无此版块。');

      article.forum = forum;

      if (problem_forums.includes(forum) && problem_id) {
        let problem = await Problem.findById(problem_id);
        if (!problem) throw new ErrorMessage('无此题目。');
        article.problem_id = problem.id;
      } else {
        article.problem_id = null;
      }

      if (article.forum === 'solutions' && await article.isSolAllowedPublicBy(res.locals.user))
        article.is_public = true;
    } else {
      if (!await article.isAllowedEditBy(res.locals.user)
        || (article.forum === 'solutions' && !await article.isSolAllowedEditBy(res.locals.user)))
        throw new ErrorMessage('您没有权限进行此操作。');
    }

    if (!req.body.title.trim()) throw new ErrorMessage('标题不能为空。');
    article.title = req.body.title;
    article.content = req.body.content;
    article.update_time = time;
    article.is_notice = (res.locals.user && res.locals.user.is_admin ? req.body.is_notice === 'on' : article.is_notice);

    await article.save();

    res.redirect(syzoj.utils.makeUrl(['article', article.id]));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.post('/article/:id/delete', async (req, res) => {
  try {
    if (!res.locals.user) throw new ErrorMessage('请登录后继续。', { '登录': syzoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });

    let id = parseInt(req.params.id);
    let article = await Article.findById(id);

    if (!article) {
      throw new ErrorMessage('无此帖子。');
    } else {
      if (!await article.isAllowedEditBy(res.locals.user)) throw new ErrorMessage('您没有权限进行此操作。');
    }

    await article.delete();

    res.redirect(syzoj.utils.makeUrl(['discussion', 'global']));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.post('/article/:id/comment', async (req, res) => {
  try {
    if (!res.locals.user) throw new ErrorMessage('请登录后继续。', { '登录': syzoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });

    let id = parseInt(req.params.id);
    let article = await Article.findById(id);

    if (!article) {
      throw new ErrorMessage('无此帖子。');
    } else {
      if (!await article.isAllowedCommentBy(res.locals.user)) throw new ErrorMessage('您没有权限进行此操作。');
    }

    let comment = await ArticleComment.create({
      content: req.body.comment,
      article_id: id,
      user_id: res.locals.user.id,
      public_time: syzoj.utils.getCurrentDate()
    });

    await comment.save();

    await article.resetReplyCountAndTime();

    res.redirect(syzoj.utils.makeUrl(['article', article.id]));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.post('/article/:article_id/comment/:id/delete', async (req, res) => {
  try {
    if (!res.locals.user) throw new ErrorMessage('请登录后继续。', { '登录': syzoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });

    let id = parseInt(req.params.id);
    let comment = await ArticleComment.findById(id);

    if (!comment) {
      throw new ErrorMessage('无此评论。');
    } else {
      if (!await comment.isAllowedEditBy(res.locals.user)) throw new ErrorMessage('您没有权限进行此操作。');
    }

    const article = await Article.findById(comment.article_id);

    await comment.destroy();

    await article.resetReplyCountAndTime();

    res.redirect(syzoj.utils.makeUrl(['article', comment.article_id]));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/api/article/:id/vote', async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) throw new ErrorMessage('无此帖子。');

    const result = await article.getVoteSummary(res.locals.user);

    res.send({
      error: null,
      result
    });
  } catch (e) {
    syzoj.log(e);
    res.send({
      error: e.message
    });
  }
});

app.post('/api/article/:id/vote/:vote', async (req, res) => {
  try {
    const { user } = res.locals;
    if (!user) throw new ErrorMessage('请登录后继续。', { '登录': syzoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });

    const article = await Article.findById(req.params.id);
    if (!article) throw new ErrorMessage('无此帖子。');

    const voteType = parseInt(req.params.vote);
    if (![1, -1, 0].includes(voteType)) throw new ErrorMessage('参数错误。');

    await article.setVoteBy(user, voteType ? voteType : null);

    const result = await article.getVoteSummary(user);

    res.send({
      error: null,
      result
    });
  } catch (e) {
    syzoj.log(e);
    res.send({
      error: e.message
    });
  }
});
