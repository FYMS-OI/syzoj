const svgCaptcha = require("svg-captcha");

app.get('/captcha', (req, res) => {
    let captcha = svgCaptcha.create({
        size: 4,
        noise: Math.floor(Math.random() * 2) + 1,
        color: true,
        background: '#f7f7f7',
        width: 95,
        height: 40,
        fontSize: 45
    });
    req.session.captcha = captcha.text;
    res.setHeader("Cache-Control", "no-store");
    res.type('svg').send(captcha.data);
});