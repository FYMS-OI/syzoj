
const GradeCalc = {
  grades: [
    '高中毕业',
    '高三', '高二', '高一',
    '初三', '初二', '初一',
    '六年级', '五年级', '四年级', '三年级', '二年级', '一年级',
    '学龄前'
  ],

  getGrade(graduation_year, date) {
    date = date || new Date();
    let years = graduation_year - date.getFullYear();
    if (date.getMonth() + 1 < 9) ++years;
    return this.grades[Math.max(0, Math.min(this.grades.length - 1, years))];
  }
};
