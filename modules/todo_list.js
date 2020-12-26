
const User = syzoj.model('user');
const Problem = syzoj.model('problem');
const TodoList = syzoj.model('todo-list');

app.post('/api/todo_list/:action/:problem_id', async (req, res) => {
  try {
    if (!res.locals.user) throw new ErrorMessage("请先登录");

    let problem_id = parseInt(req.params.problem_id);
    if (!Number.isSafeInteger(problem_id)) throw new ErrorMessage("你确定这是个题目编号？");
    
    let data = {
      user_id: res.locals.user.id,
      problem_id: problem_id
    };

    switch (req.params.action) {
      case 'add': {
        let count = await Problem.count({ where: { id: problem_id } });
        if (!count) throw new ErrorMessage("题目不存在");
        let item = await TodoList.findOne(data);
        if (!item) {
          item = await TodoList.create(data);
          await item.save();
        }
        break;
      }
      case 'remove': {
        let item = await TodoList.findOne(data);
        if (item) {
          await item.destroy();
        }
        break;
      }
      default:
        throw new ErrorMessage("参数错误");
    }

    res.send({
      error: null
    });
  } catch (e) {
    syzoj.log(e);
    res.send({
      error: e.message
    });
  }
});
