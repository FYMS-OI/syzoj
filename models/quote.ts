import * as TypeORM from "typeorm";
import Model from "./common";
import User from "./user";
import QuoteFrom from "./quote-from";
import QuoteUserVote from "./quote-user-vote";
import { QuoteType, HitokotoQuoteContent, ImageQuoteContent, VoteSummary, VoteType, UserQuote, DialogItem } from "./interfaces";

import * as fs from "fs-extra";
import * as pathlib from "path";

declare var syzoj: any;

const assert: (flag: any, message?: string) => void = syzoj.utils.assert;

function exists(path: string): Promise<boolean> {
  return new Promise(resolve => {
    fs.access(path, fs.constants.F_OK, err => resolve(!err));
  });
}

interface LeaderBoardItem {
  from: string;
  quote_count: number;
  vote_up_sum: number;
}

@TypeORM.Entity()
export default class Quote extends Model {
  static cache = true;
  static cacheAll = true;

  static baseDir = syzoj.utils.resolvePath(syzoj.config.upload_dir, 'quote_image');

  @TypeORM.PrimaryGeneratedColumn()
  id: number;

  @TypeORM.Column({ type: "enum", enum: QuoteType })
  type: QuoteType;

  @TypeORM.Column({ default: JSON.stringify({}), type: "json" })
  content: HitokotoQuoteContent | ImageQuoteContent;

  @TypeORM.Column({ type: "integer" })
  provider_id: number;

  @TypeORM.Column({ default: 1, type: "double" })
  weight: number;

  @TypeORM.Column({ type: "datetime" })
  creation_time: Date;

  @TypeORM.Column({ type: 'datetime' })
  update_time: Date;

  @TypeORM.Index()
  @TypeORM.Column({ type: "integer", default: 0 })
  vote_up: number;

  @TypeORM.Column({ type: "integer", default: 0 })
  vote_down: number;

  provider?: User;
  from?: string[];

  static isValidImageExt(ext: string): boolean {
    return /^\.(png|jpg|gif)$/i.test(ext);
  }

  static getSavePath(filename: string): string {
    return pathlib.join(this.baseDir, filename);
  }

  static getBackupSavePath(filename: string): string {
    return this.getSavePath('deleted.' + filename);
  }

  async loadRelationships() {
    this.provider = await User.findById(this.provider_id);
    this.from = (await QuoteFrom.find({
      where: { quote_id: this.id }
    })).map(item => item.from);
  }

  async isAllowedManageBy(user: User): Promise<boolean> {
    return user && (this.provider_id === user.id || await user.hasPrivilege('manage_quote'));
  }

  static async pickAll(where): Promise<Quote[]> {
    where = where || {};

    let quotes: Quote[];
    if (where.from) {
      const quoteIds = (await QuoteFrom.find({
        where: { from: where.from }
      })).map(({ quote_id }) => quote_id);
      quotes = await Promise.all(quoteIds.map(quoteId => Quote.findById(quoteId)));
      quotes = quotes.filter(quote => !!quote);
    } else {
      quotes = (await this.findAll()) as Quote[];
    }

    type FilterCallback = (quote: Quote) => boolean;
    const fn: FilterCallback[] = [];
    for (const key of ['type', 'provider_id']) {
      if (key in where && where[key] !== null)
        fn.push((quote: Quote) => quote[key] === where[key]);
    }
    if (fn.length) quotes = quotes.filter(quote => fn.every(cb => cb(quote)));

    return quotes;
  }

  static async pickOne(where): Promise<Quote> {
    const quotes = await this.pickAll(where);
    if (!quotes.length) return null;

    const total = quotes.map(({ weight }) => weight).reduce((a, b) => a + b);

    let current = Math.random() * total;
    for (const quote of quotes) {
      current -= quote.weight;
      if (current < 0) return quote;
    }
    return quotes[quotes.length - 1];
  }

  static async getLeaderboards(): Promise<LeaderBoardItem[]> {
    const query = QuoteFrom.createQueryBuilder()
      .select('`from`')
      .addSelect('COUNT(*)', 'quote_count')
      .addSelect('SUM(vote_up)', 'vote_up_sum')
      .innerJoin(qb => {
        return qb.from(Quote, "quote")
          .select(["id", "vote_up"]);
      }, "q", "q.id = quote_id")
      .groupBy("`from`")
      .orderBy("quote_count", "DESC")
      .addOrderBy("vote_up_sum", "DESC");

    const results = await query.getRawMany();

    return results.map(item => ({
      from: item.from,
      quote_count: parseInt(item.quote_count),
      vote_up_sum: parseInt(item.vote_up_sum || 0)
    }));
  }

  async getVoteBy(user: User): Promise<QuoteUserVote> {
    return await QuoteUserVote.findOne({
      quote_id: this.id,
      user_id: user.id
    });
  }

  async setVoteBy(user: User, vote: VoteType) {
    let voteItem = await this.getVoteBy(user);

    if (vote) {
      if (voteItem) {
        voteItem.vote = vote;
      } else {
        voteItem = QuoteUserVote.create({
          quote_id: this.id,
          user_id: user.id,
          vote: vote
        });
      }
      await voteItem.save();
    } else {
      if (voteItem) {
        await voteItem.destroy();
      }
    }

    await this.updateVotes();
  }

  async updateVotes() {
    [this.vote_up, this.vote_down] = await Promise.all(
      [VoteType.up, VoteType.down].map(type => QuoteUserVote.count({
        quote_id: this.id,
        vote: type
      })));
    await this.save();
  }

  async getVoteSummary(user: User): Promise<VoteSummary> {
    const voteItem = await this.getVoteBy(user);
    return {
      self: voteItem && voteItem.vote,
      total: {
        up: this.vote_up,
        down: this.vote_down
      }
    };
  }

  async render() {
    switch (this.type) {
      case QuoteType.hitokoto: {
        const content = this.content as HitokotoQuoteContent;
        if (!content.is_dialog || !await renderDialog(content)) {
          content.html = await syzoj.utils.markdown(content.hitokoto);
        }
        break;
      }

      case QuoteType.image: {
        const content = this.content as ImageQuoteContent;
        content.url = syzoj.utils.makeUrl(['quote-image', content.filename]);
        break;
      }
    }
  }

  async setImage(file: { filename: string, path: string, size: number }) {
    assert(file.size > 0, "图片不能为空");
    assert(file.size < 1048576, "图片大小超过限制");

    const extname = pathlib.extname(file.filename);
    assert(Quote.isValidImageExt(extname), "图片扩展名不合法");

    const buffer = await fs.readFile(file.path);
    const md5 = syzoj.utils.md5(buffer);
    const filename = md5 + extname;
    const savePath = Quote.getSavePath(filename);
    const backupPath = Quote.getBackupSavePath(filename);

    await syzoj.utils.lock(['Quote::Image'], async () => {
      assert(!await exists(savePath), "图片已存在");
      await fs.rename(file.path, savePath);
      try {
        await fs.unlink(backupPath);
      } catch (err) {}
    });

    const content = this.content as ImageQuoteContent;
    content.filename = filename;
    content.size = file.size;
  }

  async setFrom(from: string[], isNew: boolean) {
    const fromList = new Set(from);
  
    if (!isNew) {
      const items = await QuoteFrom.find({
        where: { quote_id: this.id }
      });

      await Promise.all(items.map(item => {
        if (fromList.has(item.from)) {
          fromList.delete(item.from);
        } else {
          return item.destroy();
        }
      }));
    }

    for (const from of fromList) {
      const item = QuoteFrom.create({
        quote_id: this.id, from
      });
      await item.save();
    }
  }

  async delete() {
    await QuoteFrom.createQueryBuilder()
      .delete()
      .where("quote_id = :id", { id: this.id })
      .execute();

    await QuoteUserVote.createQueryBuilder()
      .delete()
      .where("quote_id = :id", { id: this.id })
      .execute();

    if (this.type === QuoteType.image) {
      const filename = (this.content as ImageQuoteContent).filename;
      const path = Quote.getSavePath(filename);
      const pathNew = Quote.getBackupSavePath(filename);

      await syzoj.utils.lock(['Quote::Image'], () => fs.rename(path, pathNew));
    }

    await this.destroy();
  }

  toJSON(privileged = false) {
    let result: UserQuote = {
      id: this.id,
      type: this.type,
      content: JSON.parse(JSON.stringify(this.content)),
      from: this.from.slice(0),
      creation_time: syzoj.utils.formatDate(this.creation_time.getTime() / 1000),
      update_time: syzoj.utils.formatDate(this.update_time.getTime() / 1000)
    };
    if (privileged) {
      result = { ...result,
        provider: {
          id: this.provider.id,
          username: this.provider.username
        },
        weight: this.weight
      };
    }
    return result;
  }
}

async function renderDialog(content: HitokotoQuoteContent): Promise<boolean> {
  let lines = content.hitokoto.trim().split(/  \n|<br>\n|\n\n/);
  if (lines.length <= 1) return false;

  let items: DialogItem[] = [];

  for (const line of lines) {
    let result = line.match(/^((.+?)(:|：))(.+)$/);
    if (!result) return false;
    items.push({ from: result[1], content: result[4] });
  }

  await Promise.all(items.map(async item => {
    item.content = await syzoj.utils.markdown(item.content);
  }));

  content.dialog = items;
  return true;
}
