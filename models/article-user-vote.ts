import * as TypeORM from "typeorm";
import Model from "./common";
import { VoteType } from "./interfaces";

@TypeORM.Entity()
export default class ArticleUserVote extends Model {
  @TypeORM.PrimaryColumn({ type: "integer" })
  article_id: number;

  @TypeORM.PrimaryColumn({ type: "integer" })
  user_id: number;

  @TypeORM.Column({ type: "integer" })
  vote: VoteType;
}
