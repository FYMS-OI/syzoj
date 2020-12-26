app.get('/calendar', async (req, res) => {
  if (!syzoj.config.calendar.enabled) {
    res.render('error', {
      err: '未开启日历功能。'
    });
  } else if (!syzoj.config.calendar.api_url) {
    res.render('error', {
      err: '日历配置有误，请联系管理员。'
    });
  } else {
    try {
        res.render('calendar');
    } catch (err) {
      res.render('error', {
        err: err
      });
    }
  }
});
