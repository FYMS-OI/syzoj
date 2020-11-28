let User = syzoj.model('user');
let Problem = syzoj.model('problem');
const RatingCalculation = syzoj.model('rating_calculation');
const RatingHistory = syzoj.model('rating_history');
const Contest = syzoj.model('contest');
const ContestPlayer = syzoj.model('contest_player');
const UserIdentity = syzoj.model('user-identity');

const { assert } = syzoj.utils;

// Ranklist
app.get('/ranklist', async (req, res) => {
  try {
    const sort = req.query.sort || syzoj.config.sorting.ranklist.field;
    const order = req.query.order || syzoj.config.sorting.ranklist.order;
    if (!['ac_num', 'rating', 'id', 'username'].includes(sort) || !['asc', 'desc'].includes(order)) {
      throw new ErrorMessage('错误的排序参数。');
    }
    let where = { is_show: true };
    if (syzoj.config.ranklist_rated_only) where.is_rated = true;
    let paginate = syzoj.utils.paginate(await User.countForPagination(where), req.query.page, syzoj.config.page.ranklist);
    let ranklist = await User.queryPage(paginate, where, { [sort]: order.toUpperCase() });
    await ranklist.forEachAsync(async x => x.renderInformation());

    res.render('ranklist', {
      ranklist: ranklist,
      paginate: paginate,
      curSort: sort,
      curOrder: order === 'asc'
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/find_user', async (req, res) => {
  try {
    let user = await User.fromName(req.query.nickname);
    if (!user) throw new ErrorMessage('无此用户。');
    res.redirect(syzoj.utils.makeUrl(['user', user.id]));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/api/user/search', async (req, res) => {
  try {
    const users = await User.createQueryBuilder()
      .where("username LIKE :name", {
        name: '%' + (req.query.q || '') + '%'
      })
      .limit(5)
      .getMany();

      res.send({
        error: null,
        data: users.map(({ id, username }) => ({ id, username }))
      });
  } catch (e) {
    syzoj.log(e);
    res.send({
      error: e.message
    });
  }
});

// Login
app.get('/login', async (req, res) => {
  if (res.locals.user) {
    res.render('error', {
      err: new ErrorMessage('您已经登录了，请先注销。', { '注销': syzoj.utils.makeUrl(['logout'], { 'url': req.originalUrl }) })
    });
  } else {
    res.render('login');
  }
});

// Sign up
app.get('/sign_up', async (req, res) => {
  if (res.locals.user) {
    res.render('error', {
      err: new ErrorMessage('您已经登录了，请先注销。', { '注销': syzoj.utils.makeUrl(['logout'], { 'url': req.originalUrl }) })
    });
  } else {
    res.render('sign_up');
  }
});

// Logout
app.post('/logout', async (req, res) => {
  req.session.user_id = null;
  res.clearCookie('login');
  res.redirect(req.query.url || '/');
});

// User page
app.get('/user/:id', async (req, res) => {
  try {
    let id = parseInt(req.params.id);
    let user = await User.findById(id);
    if (!user) throw new ErrorMessage('无此用户。');
    user.ac_problems = await user.getACProblems();
    user.articles = await user.getArticles();
    for (let article of user.articles) {
      if (article.problem_id) {
        article.problem = await Problem.findById(article.problem_id);
        article.allowedVisit = await article.problem.isAllowedUseBy(user);
      } else {
        article.allowedVisit = true;
      }
    }
    user.shown_articles = user.articles.filter(article => article.allowedVisit);
    user.allowedEdit = await user.isAllowedEditBy(res.locals.user);

    let statistics = await user.getStatistics();
    await user.renderInformation();
    user.emailVisible = user.public_email || user.allowedEdit;

    const ratingHistoryValues = await RatingHistory.find({
      where: { user_id: user.id },
      order: { rating_calculation_id: 'ASC' }
    });
    const ratingHistories = [{
      contestName: "初始积分",
      value: syzoj.config.default.user.rating,
      delta: null,
      rank: null
    }];

    for (const history of ratingHistoryValues) {
      const contest = await Contest.findById((await RatingCalculation.findById(history.rating_calculation_id)).contest_id);
      ratingHistories.push({
        contestName: contest.title,
        value: history.rating_after,
        delta: history.rating_after - ratingHistories[ratingHistories.length - 1].value,
        rank: history.rank,
        participants: await ContestPlayer.count({ contest_id: contest.id })
      });
    }
    ratingHistories.reverse();

    res.render('user', {
      show_user: user,
      statistics: statistics,
      ratingHistories: ratingHistories
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/user/:id/edit', async (req, res) => {
  try {
    let id = parseInt(req.params.id);
    let user = await User.findById(id);
    if (!user) throw new ErrorMessage('无此用户。');

    let allowedEdit = await user.isAllowedEditBy(res.locals.user);
    if (!allowedEdit) {
      throw new ErrorMessage('您没有权限进行此操作。');
    }

    user.privileges = await user.getPrivileges();
    user.identity = await user.getIdentity();

    res.locals.user.allowedManage = await res.locals.user.hasPrivilege('manage_user');

    res.render('user_edit', {
      edited_user: user,
      error_info: null
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/forget', async (req, res) => {
  res.render('forget');
});

app.get('/user/:id/verify', async (req, res) => {
  try {
    let id = parseInt(req.params.id);
    let user = await User.findById(id);
    if (!user) throw new ErrorMessage('无此用户。');

    let allowedEdit = await user.isAllowedEditBy(res.locals.user);
    if (!allowedEdit) {
      throw new ErrorMessage('您没有权限进行此操作。');
    }

    let identity = await user.getIdentity(true);

    res.render('user_verify', {
      edited_user: user,
      identity: identity,
      allowedManage: await res.locals.user.hasPrivilege('manage_user')
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.post('/api/user/:id/verify', async (req, res) => {
  try {
    let id = parseInt(req.params.id);
    let user = await User.findById(id);
    if (!user) throw new ErrorMessage('无此用户。');

    let allowedEdit = await user.isAllowedEditBy(res.locals.user);
    if (!allowedEdit) throw new ErrorMessage('您没有权限进行此操作。');

    let identity = await user.getIdentity(true);

    let allowedManage = await res.locals.user.hasPrivilege('manage_user');

    if (identity.status === 'approved' && !allowedManage) {
      throw new ErrorMessage('您已经进行了实名认证。');
    }

    assert(['student', 'teacher', 'other'].includes(req.body.role), `找不到 ${req.body.role} 对应的角色。`);
    identity.role = req.body.role;

    assert(req.body.real_name, '真实姓名不能为空。');
    identity.real_name = req.body.real_name;

    switch (identity.role) {
      case 'student': {
        let year = parseInt(req.body.graduation_year);
        assert(Number.isInteger(year), '高中毕业年份必须是整数。');
        identity.graduation_year = year;
        break;
      }
      case 'teacher': break;
      case 'other': break;
    }

    identity.update_time = new Date();

    if (allowedManage) {
      identity.status = 'approved';
      identity.review_time = new Date();
    } else {
      identity.status = 'pending';
      identity.review_time = null;
    }

    await identity.save();

    await user.updateVerifyStatus(identity.status === 'approved');

    res.send({ error: null, identity: identity.toJSON() });
  } catch (e) {
    syzoj.log(e);
    res.send({ error: e.message });
  }
});

app.post('/api/user/:id/verify/:action', async (req, res) => {
  try {
    let id = parseInt(req.params.id);
    let user = await User.findById(id);
    if (!user) throw new ErrorMessage('无此用户。');
    
    if (!await res.locals.user.hasPrivilege('manage_user')) throw new ErrorMessage('您没有权限进行此操作。');

    let identity = await user.getIdentity();
    if (!identity) throw new ErrorMessage('用户尚未进行实名认证。');

    switch (req.params.action) {
      case 'approve': identity.status = 'approved'; break;
      case 'reject': identity.status = 'rejected'; break;
      default: throw new ErrorMessage('参数错误。');
    }

    identity.review_time = new Date();

    await identity.save();

    await user.updateVerifyStatus(identity.status === 'approved');

    res.send({ error: null, identity: identity.toJSON() });
  } catch (e) {
    syzoj.log(e);
    res.send({ error: e.message });
  }
});


app.post('/user/:id/edit', async (req, res) => {
  let user;
  try {
    let id = parseInt(req.params.id);
    user = await User.findById(id);
    if (!user) throw new ErrorMessage('无此用户。');

    let allowedEdit = await user.isAllowedEditBy(res.locals.user);
    if (!allowedEdit) throw new ErrorMessage('您没有权限进行此操作。');

    if (req.body.old_password && req.body.new_password) {
      if (user.password !== req.body.old_password && !await res.locals.user.hasPrivilege('manage_user')) throw new ErrorMessage('旧密码错误。');
      user.password = req.body.new_password;
    }

    if (res.locals.user && await res.locals.user.hasPrivilege('manage_user')) {
      if (!syzoj.utils.isValidUsername(req.body.username)) throw new ErrorMessage('无效的用户名。');
      user.username = req.body.username;
      user.email = req.body.email;
    }

    if (res.locals.user && res.locals.user.is_admin) {
      if (!req.body.privileges) {
        req.body.privileges = [];
      } else if (!Array.isArray(req.body.privileges)) {
        req.body.privileges = [req.body.privileges];
      }

      let privileges = req.body.privileges;
      await user.setPrivileges(privileges);
    }

    let allowedManage = await res.locals.user.hasPrivilege('manage_user');

    if (allowedManage) {
      user.tg_color = req.body.tagcolor;
      user.tg_name = req.body.tagname;
    }

    user.information = req.body.information;
    user.sex = req.body.sex;
    user.public_email = (req.body.public_email === 'on');
    user.prefer_formatted_code = (req.body.prefer_formatted_code === 'on');
    user.auto_spacing_page = (req.body.auto_spacing_page === 'on');

    await user.save();

    if (user.id === res.locals.user.id) res.locals.user = user;

    user.privileges = await user.getPrivileges();
    user.identity = await user.getIdentity();
    res.locals.user.allowedManage = allowedManage;

    res.render('user_edit', {
      edited_user: user,
      error_info: ''
    });
  } catch (e) {
    user.privileges = await user.getPrivileges();
    user.identity = await user.getIdentity();
    res.locals.user.allowedManage = await res.locals.user.hasPrivilege('manage_user');

    res.render('user_edit', {
      edited_user: user,
      error_info: e.message
    });
  }
});
