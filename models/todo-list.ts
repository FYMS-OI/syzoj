import * as TypeORM from "typeorm";
import Model from "./common";

@TypeORM.Entity()
export default class TodoList extends Model {
  @TypeORM.Index()
  @TypeORM.PrimaryColumn({ type: "integer" })
  user_id: number;

  @TypeORM.Index()
  @TypeORM.PrimaryColumn({ type: "integer" })
  problem_id: number;
}
