let Problem = syzoj.model('problem');
let JudgeState = syzoj.model('judge_state');
let Article = syzoj.model('article');
let Contest = syzoj.model('contest');
let User = syzoj.model('user');
let UserPrivilege = syzoj.model('user_privilege');
const RatingCalculation = syzoj.model('rating_calculation');
const RatingHistory = syzoj.model('rating_history');
let ContestPlayer = syzoj.model('contest_player');
const InvitationCode = syzoj.model('invitation_code');
const InvitationCodeUsername = syzoj.model('invitation_code_username');
const UserIdentity = syzoj.model('user-identity');
const Quote = syzoj.model('quote');
const calcRating = require('../libs/rating');

const TypeORM = require('typeorm');
const randomstring = require('randomstring');
const YAML = require('js-yaml');
const fs = require('fs-extra');

app.get('/admin/info', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('您没有权限进行此操作。');

    let allSubmissionsCount = await JudgeState.count();
    let todaySubmissionsCount = await JudgeState.count({
      submit_time: TypeORM.MoreThanOrEqual(syzoj.utils.getCurrentDate(true))
    });
    let problemsCount = await Problem.count();
    let articlesCount = await Article.count();
    let contestsCount = await Contest.count();
    let usersCount = await User.count();

    res.render('admin_info', {
      allSubmissionsCount: allSubmissionsCount,
      todaySubmissionsCount: todaySubmissionsCount,
      problemsCount: problemsCount,
      articlesCount: articlesCount,
      contestsCount: contestsCount,
      usersCount: usersCount
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

let configItems = {
  'title': { name: '站点标题', type: String },
  'google_analytics': { name: 'Google Analytics', type: String },
  '默认参数': null,
  'default.problem.time_limit': { name: '时间限制（单位：ms）', type: Number },
  'default.problem.memory_limit': { name: '空间限制（单位：MiB）', type: Number },
  '限制': null,
  'limit.time_limit': { name: '最大时间限制（单位：ms）', type: Number },
  'limit.memory_limit': { name: '最大空间限制（单位：MiB）', type: Number },
  'limit.data_size': { name: '所有数据包大小（单位：byte）', type: Number },
  'limit.testdata': { name: '测试数据大小（单位：byte）', type: Number },
  'limit.submit_code': { name: '代码长度（单位：byte）', type: Number },
  'limit.submit_answer': { name: '提交答案题目答案大小（单位：byte）', type: Number },
  'limit.custom_test_input': { name: '自定义测试输入文件大小（单位：byte）', type: Number },
  'limit.testdata_filecount': { name: '测试数据文件数量（单位：byte）', type: Number },
  '每页显示数量': null,
  'page.problem': { name: '题库', type: Number },
  'page.judge_state': { name: '提交记录', type: Number },
  'page.problem_statistics': { name: '题目统计', type: Number },
  'page.ranklist': { name: '排行榜', type: Number },
  'page.discussion': { name: '讨论', type: Number },
  'page.article_comment': { name: '评论', type: Number },
  'page.contest': { name: '比赛', type: Number }
};

app.get('/admin/config', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('您没有权限进行此操作。');

    for (let i in configItems) {
      if (!configItems[i]) continue;
      configItems[i].val = eval(`syzoj.config.${i}`);
    }

    res.render('admin_config', {
      items: configItems
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.post('/admin/config', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('您没有权限进行此操作。');

    for (let i in configItems) {
      if (!configItems[i]) continue;
      if (req.body[i]) {
        let val;
        if (configItems[i].type === Boolean) {
          val = req.body[i] === 'on';
        } else if (configItems[i].type === Number) {
          val = Number(req.body[i]);
        } else {
          val = req.body[i];
        }

        let f = new Function('val', `syzoj.config.${i} = val`);
        f(val);
      }
    }

    await syzoj.utils.saveConfig();

    res.redirect(syzoj.utils.makeUrl(['admin', 'config']));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.get('/admin/privilege', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('您没有权限进行此操作。');

    let a = await UserPrivilege.find();
    let users = {};
    for (let p of a) {
      if (!users[p.user_id]) {
        users[p.user_id] = {
          user: await User.findById(p.user_id),
          privileges: []
        };
      }

      users[p.user_id].privileges.push(p.privilege);
    }

    res.render('admin_privilege', {
      users: Object.values(users)
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.post('/admin/privilege', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('您没有权限进行此操作。');

    let data = JSON.parse(req.body.data);
    for (let id in data) {
      let user = await User.findById(id);
      if (!user) throw new ErrorMessage(`不存在 ID 为 ${id} 的用户。`);
      await user.setPrivileges(data[id]);
    }

    res.redirect(syzoj.utils.makeUrl(['admin', 'privilege']));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.get('/admin/rating', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('您没有权限进行此操作。');
    const contests = await Contest.find({
      order: {
        start_time: 'DESC'
      }
    });
    const calcs = await RatingCalculation.find({
      order: {
        id: 'DESC'
      }
    });
    for (const calc of calcs) await calc.loadRelationships();

    res.render('admin_rating', {
      contests: contests,
      calcs: calcs
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.post('/admin/rating/add', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('您没有权限进行此操作。');
    const contest = await Contest.findById(req.body.contest);
    if (!contest) throw new ErrorMessage('无此比赛');

    await contest.loadRelationships();
    const newcalc = await RatingCalculation.create({ contest_id: contest.id });
    await newcalc.save();

    if (!contest.ranklist || contest.ranklist.ranklist.player_num <= 1) {
      throw new ErrorMessage("比赛人数太少。");
    }

    const players = [];
    for (let i = 1; i <= contest.ranklist.ranklist.player_num; i++) {
      const player = await ContestPlayer.findById(contest.ranklist.ranklist[i]);
      if (player && player.is_official) {
        const user = await User.findById(player.user_id);
        players.push({
          user: user,
          rank: i,
          currentRating: user.rating
        });
      }
    }
    const newRating = calcRating(players);
    for (let i = 0; i < newRating.length; i++) {
      const user = newRating[i].user;
      const rating_after = Math.round(newRating[i].currentRating);
      user.rating = rating_after;
      user.is_rated = true;
      await user.save();
      const newHistory = await RatingHistory.create({
        rating_calculation_id: newcalc.id,
        user_id: user.id,
        rating_after: rating_after,
        rank: newRating[i].rank
      });
      await newHistory.save();
    }

    res.redirect(syzoj.utils.makeUrl(['admin', 'rating']));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.post('/admin/rating/delete', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('您没有权限进行此操作。');
    const calcList = await RatingCalculation.find({
      where: {
        id: TypeORM.MoreThanOrEqual(req.body.calc_id)
      },
      order: {
        id: 'DESC'
      }
    });
    if (calcList.length === 0) throw new ErrorMessage('ID 不正确');

    for (let i = 0; i < calcList.length; i++) {
      await calcList[i].delete();
    }

    res.redirect(syzoj.utils.makeUrl(['admin', 'rating']));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/admin/other', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('您没有权限进行此操作。');

    res.render('admin_other');
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.get('/admin/rejudge', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('您没有权限进行此操作。');

    res.render('admin_rejudge', {
      form: {},
      count: null
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.post('/admin/other', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('您没有权限进行此操作。');

    if (req.body.type === 'reset_count') {
      const problems = await Problem.find();
      for (const p of problems) {
        await p.resetSubmissionCount();
      }
    } else if (req.body.type === 'reset_discussion') {
      const articles = await Article.find();
      for (const a of articles) {
        await a.resetReplyCountAndTime();
      }
    } else if (req.body.type === 'reset_codelen') {
      const submissions = await JudgeState.find();
      for (const s of submissions) {
        if (s.type !== 'submit-answer') {
          s.code_length = Buffer.from(s.code).length;
          await s.save();
        }
      }
    } else if (req.body.type === 'reset_vote') {
      for (const quote of await Quote.find()) {
        await quote.updateVotes();
      }
      for (const article of await Article.find()) {
        await article.updateVotes();
      }
    } else {
      throw new ErrorMessage("操作类型不正确");
    }

    res.redirect(syzoj.utils.makeUrl(['admin', 'other']));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});
app.post('/admin/rejudge', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('您没有权限进行此操作。');

    let query = JudgeState.createQueryBuilder();

    let user = await User.fromName(req.body.submitter || '');
    if (user) {
      query.andWhere('user_id = :user_id', { user_id: user.id });
    } else if (req.body.submitter) {
      query.andWhere('user_id = :user_id', { user_id: 0 });
    }

    let minID = parseInt(req.body.min_id);
    if (!isNaN(minID)) query.andWhere('id >= :minID', { minID })
    let maxID = parseInt(req.body.max_id);
    if (!isNaN(maxID)) query.andWhere('id <= :maxID', { maxID })

    let minScore = parseInt(req.body.min_score);
    if (!isNaN(minScore)) query.andWhere('score >= :minScore', { minScore });
    let maxScore = parseInt(req.body.max_score);
    if (!isNaN(maxScore)) query.andWhere('score <= :maxScore', { maxScore });

    let minTime = syzoj.utils.parseDate(req.body.min_time);
    if (!isNaN(minTime)) query.andWhere('submit_time >= :minTime', { minTime: parseInt(minTime) });
    let maxTime = syzoj.utils.parseDate(req.body.max_time);
    if (!isNaN(maxTime)) query.andWhere('submit_time <= :maxTime', { maxTime: parseInt(maxTime) });

    if (req.body.language) {
      if (req.body.language === 'submit-answer') {
        query.andWhere(new TypeORM.Brackets(qb => {
          qb.orWhere('language = :language', { language: '' })
            .orWhere('language IS NULL');
        }));
      } else if (req.body.language === 'non-submit-answer') {
        query.andWhere('language != :language', { language: '' })
             .andWhere('language IS NOT NULL');;
      } else {
        query.andWhere('language = :language', { language: req.body.language });
      }
    }

    if (req.body.status) {
      query.andWhere('status = :status', { status: req.body.status });
    }

    if (req.body.problem_id) {
      query.andWhere('problem_id = :problem_id', { problem_id: parseInt(req.body.problem_id) || 0 })
    }

    let count = await JudgeState.countQuery(query);
    if (req.body.type === 'rejudge') {
      let submissions = await JudgeState.queryAll(query);
      for (let submission of submissions) {
        await submission.rejudge();
      }
    }

    res.render('admin_rejudge', {
      form: req.body,
      count: count
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.get('/admin/links', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('您没有权限进行此操作。');

    res.render('admin_links', {
      links: syzoj.config.links || []
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.post('/admin/links', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('您没有权限进行此操作。');

    syzoj.config.links = JSON.parse(req.body.data);
    await syzoj.utils.saveConfig();

    res.redirect(syzoj.utils.makeUrl(['admin', 'links']));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.get('/admin/raw', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('您没有权限进行此操作。');

    res.render('admin_raw', {
      data: JSON.stringify(syzoj.config, null, 2)
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.post('/admin/raw', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('您没有权限进行此操作。');

    syzoj.config = JSON.parse(req.body.data);
    await syzoj.utils.saveConfig();

    res.redirect(syzoj.utils.makeUrl(['admin', 'raw']));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.post('/admin/restart', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('您没有权限进行此操作。');

    syzoj.restart();

    res.render('admin_restart', {
      data: JSON.stringify(syzoj.config, null, 2)
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.get('/admin/serviceID', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('您没有权限进行此操作。');

    res.send({
        serviceID: syzoj.serviceID
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.get('/admin/invitation_code', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('您没有权限进行此操作。');

    let codes = await InvitationCode.find();
    await codes.forEachAsync(async (code) => {
      await code.loadRelationships();
      await code.loadUsernames();
    });

    res.render('admin_invitation_code', {
      codes: codes
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.post('/api/admin/invitation_code/create', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('您没有权限进行此操作。');

    let usernames = req.body.usernames;
    if (!Array.isArray(usernames)) throw new ErrorMessage("参数错误");

    usernames = usernames.filter((username) => username);
    if (!usernames.length) throw new ErrorMessage("至少要填写一个用户名");

    await usernames.forEachAsync(async (username, index) => {
      if (typeof username !== 'string') throw new ErrorMessage("参数错误");
      if (!syzoj.utils.isValidUsername(username)) throw new ErrorMessage(username + " 不是一个合法的用户名");
      if (index !== usernames.indexOf(username)) throw new ErrorMessage("用户名不能相同");
      if (await User.fromName(username)) throw new ErrorMessage("用户 " + username + " 已存在");
    });

    let code = await InvitationCode.create({
      code: randomstring.generate(8),
      creator_id: res.locals.user.id,
      creation_time: new Date(),
      usage_count: 0,
      enabled: true
    });
    await code.save();

    await usernames.forEachAsync(async (username) => {
      let item = await InvitationCodeUsername.create({
        code: code.code,
        username: username,
        used: false
      });
      await item.save();
    });

    res.send({
      error: '',
      result: { code: code.code }
    });

  } catch (e) {
    syzoj.log(e);
    res.send({
      error: e.message
    });
  }
});

app.post('/api/admin/invitation_code/:code/:action', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('您没有权限进行此操作。');

    let code = await InvitationCode.fromCode(req.params.code);
    if (!code) throw new ErrorMessage("错误的邀请码。");

    switch (req.params.action) {
      case 'delete':
        await code.delete();
        break;
      case 'enable':
        code.enabled = true;
        await code.save();
        break;
      case 'disable':
        code.enabled = false;
        await code.save();
        break;
      default:
        throw new ErrorMessage("未知操作");
    }

    res.send({ error: null });

  } catch (e) {
    syzoj.log(e);
    res.send({
      error: e.message
    });
  }
});

app.get('/admin/bulk_register', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('您没有权限进行此操作。');
    res.render('admin_bulk_register');
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.post('/admin/bulk_register', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('您没有权限进行此操作。');

    var users = req.body.users;
    await users.forEachAsync(async (info, index) => {
      var username = info.username;
      if (typeof username !== 'string') throw new ErrorMessage("参数错误");
      if (!syzoj.utils.isValidUsername(username)) throw new ErrorMessage(username + " 不是一个合法的用户名");
      if (index !== users.findIndex((a) => a.username === username)) throw new ErrorMessage("用户名不能相同");
      if (await User.fromName(username)) throw new ErrorMessage("用户 " + username + " 已存在");
      if (typeof info.email !== 'string' || !info.email) throw new ErrorMessage("参数错误");
      if (typeof info.password !== 'string' || !/^[0-9a-fA-F]{32}$/.test(info.password)) throw new ErrorMessage("参数错误");
    });

    var currentTime = parseInt((new Date()).getTime() / 1000);
    for (let i = 0; i < users.length; ++i) {
      let info = users[i];
      var user = await User.create({
        username: info.username,
        password: info.password,
        email: info.email,
        is_show: syzoj.config.default.user.show,
        is_rated: false,
        rating: syzoj.config.default.user.rating,
        register_time: currentTime
      });
      await user.save();
    }

    res.send({ error: null });

  } catch (e) {
    syzoj.log(e);
    res.send({
      error: e.message
    });
  }
});

app.get('/admin/bulk_public', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('您没有权限进行此操作。');
    res.render('admin_bulk_public', {
      status: null
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.post('/admin/bulk_public', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('您没有权限进行此操作。');

    let num_min = parseInt(req.body.number_min),
        num_max = parseInt(req.body.number_max),
        is_public = req.body.is_public === 'on',
        is_data_public = req.body.is_data_public === 'on';

    if (isNaN(num_min) || isNaN(num_max) || num_min > num_max) throw new ErrorMessage("参数错误");

    let problems = await Problem.find({
      where: { id: TypeORM.Between(num_min, num_max) }
    });
    console.log(`${num_min} - ${num_max}`, problems);
    if (!problems.length) throw new ErrorMessage("没有符合要求的题目");

    let now = new Date();
    await problems.forEachAsync(async (problem) => {
      problem.is_public = is_public;
      problem.is_data_public = is_data_public;
      if (is_public) {
        problem.publicizer_id = res.locals.user.id;
        problem.publicize_time = now;
      }
      await problem.save();
    });

    let query = JudgeState.createQueryBuilder()
                          .update()
                          .set({ is_public: is_public })
                          .where({ problem_id: TypeORM.Between(num_min, num_max) });
    query.execute();

    res.render('admin_bulk_public', {
      error_info: '操作成功，一共更改了 ' + problems.length + ' 道题目。',
      status: 'success'
    });
  } catch (e) {
    syzoj.log(e);
    res.render('admin_bulk_public', {
      error_info: e.message,
      status: 'failed'
    });
  }
});

app.get('/admin/user_verify', async (req, res) => {
  try {
    if (!res.locals.user || !await res.locals.user.hasPrivilege('manage_user')) throw new ErrorMessage('您没有权限进行此操作。');

    res.render('admin_user_verify');
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.get('/api/admin/user_verify', async (req, res) => {
  try {
    if (!res.locals.user || !await res.locals.user.hasPrivilege('manage_user')) throw new ErrorMessage('您没有权限进行此操作。');

    let items = await UserIdentity.find({ where: '`status` IN ("pending", "rejected")' });

    res.send({
      items: await items.mapAsync(async identity => {
        await identity.loadRelationships();
        return identity.toJSON();
      }),
      stat: await UserIdentity.getStatistics()
    });
  } catch (e) {
    syzoj.log(e);
    res.send({ error: e.message });
  }
});
