import * as TypeORM from "typeorm";
import Model from "./common";

@TypeORM.Entity()
export default class UserRestriction extends Model {
  @TypeORM.Index()
  @TypeORM.PrimaryColumn({ type: "integer" })
  user_id: number;

  @TypeORM.Index()
  @TypeORM.PrimaryColumn({ type: "varchar", length: 80 })
  restriction: string;

  @TypeORM.Column({ type: "tinytext" })
  reason: string;
}
