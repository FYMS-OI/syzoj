import * as TypeORM from "typeorm";
import Model from "./common";

import User from "./user";
import Problem from "./problem";
import ArticleComment from "./article-comment";
import ArticleUserView from "./article-user-view";
import ArticleUserVote from "./article-user-vote";
import { VoteType, VoteSummary } from "./interfaces";

declare var syzoj: any;

@TypeORM.Entity()
export default class Article extends Model {
  static cache = false;

  @TypeORM.PrimaryGeneratedColumn()
  id: number;

  @TypeORM.Column({ nullable: true, type: "varchar", length: 80 })
  title: string;

  @TypeORM.Column({ nullable: true, type: "mediumtext" })
  content: string;

  @TypeORM.Index()
  @TypeORM.Column({ nullable: true, type: "integer" })
  user_id: number;

  @TypeORM.Index()
  @TypeORM.Column({ nullable: true, type: "varchar", length: 31 })
  forum: string;

  @TypeORM.Index()
  @TypeORM.Column({ nullable: true, type: "integer" })
  problem_id: number;

  @TypeORM.Column({ nullable: true, type: "integer" })
  public_time: number;

  @TypeORM.Column({ nullable: true, type: "integer" })
  update_time: number;

  @TypeORM.Index()
  @TypeORM.Column({ nullable: true, type: "integer" })
  sort_time: number;

  @TypeORM.Column({ default: 0, type: "integer" })
  comments_num: number;

  @TypeORM.Column({ default: 0, type: "integer" })
  views: number;

  @TypeORM.Column({ default: true, type: "boolean" })
  allow_comment: boolean;

  @TypeORM.Index()
  @TypeORM.Column({ nullable: true, type: "boolean" })
  is_notice: boolean;

  @TypeORM.Index()
  @TypeORM.Column({ type: "integer", default: 0 })
  vote_up: number;

  @TypeORM.Column({ type: "integer", default: 0 })
  vote_down: number;

  @TypeORM.Column({ type: "integer", default: 0 })
  is_public: number;

  user?: User;
  problem?: Problem;

  async loadRelationships() {
    this.user = await User.findById(this.user_id);
  }

  async isAllowedEditBy(user) {
    return user && (user.is_admin || this.user_id === user.id);
  }

  async isSolAllowedEditBy(user) {
    if (!user) return false;
    if (await user.hasPrivilege('manage_solution')) return true;
    return user.is_admin || this.user_id === user.id;
  }

  async isSolAllowedPublicBy(user) {
    if (!user) return false;
    if (await user.hasPrivilege('manage_solution')) return true;
    return user.is_admin;
  }

  async isAllowedCommentBy(user) {
    return user && (this.allow_comment || user.is_admin || this.user_id === user.id);
  }

  async resetReplyCountAndTime() {
    await syzoj.utils.lock(['Article::resetReplyCountAndTime', this.id], async () => {
      this.comments_num = await ArticleComment.count({ article_id: this.id });
      if (this.comments_num === 0) {
        this.sort_time = this.public_time;
      } else {
        this.sort_time = (await ArticleComment.findOne({
          where: { article_id: this.id },
          order: { public_time: "DESC" }
        })).public_time;
      }
      await this.save();
    });
  }

  async updateViews(user: User) {
    if (!user) return;

    const data = {
      article_id: this.id,
      user_id: user.id
    };

    let userView = await ArticleUserView.findOne({ where: data });

    if (!userView) {
      userView = await ArticleUserView.create(data);
      this.views += 1;
      await this.save();
    }

    userView.time = new Date();
    await userView.save();
  }

  async getVoteBy(user: User): Promise<ArticleUserVote> {
    return await ArticleUserVote.findOne({
      article_id: this.id,
      user_id: user.id
    });
  }

  async setVoteBy(user: User, vote: VoteType) {
    let voteItem = await this.getVoteBy(user);

    if (vote) {
      if (voteItem) {
        voteItem.vote = vote;
      } else {
        voteItem = ArticleUserVote.create({
          article_id: this.id,
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
      [VoteType.up, VoteType.down].map(type => ArticleUserVote.count({
        article_id: this.id,
        vote: type
      })));
    await this.save();
  }

  async getVoteSummary(user: User): Promise<VoteSummary> {
    const voteItem = user && await this.getVoteBy(user);
    return {
      self: voteItem && voteItem.vote,
      total: {
        up: this.vote_up,
        down: this.vote_down
      }
    };
  }

  async delete() {
    await Promise.all((await ArticleComment.find({
      article_id: this.id
    })).map(comment => comment.destroy()));
    await ArticleUserView.delete({
      article_id: this.id
    });
    await ArticleUserVote.delete({
      article_id: this.id
    });
    await this.destroy();
  }
};
