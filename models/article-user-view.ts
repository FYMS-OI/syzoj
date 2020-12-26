import * as TypeORM from "typeorm";
import Model from "./common";

@TypeORM.Entity()
export default class ArticleUserView extends Model {
  @TypeORM.Index()
  @TypeORM.PrimaryColumn({ type: "integer" })
  article_id: number;

  @TypeORM.Index()
  @TypeORM.PrimaryColumn({ type: "integer" })
  user_id: number;

  @TypeORM.Column({ nullable: true, type: "datetime" })
  time: Date;
};
