import * as TypeORM from "typeorm";
import Model from "./common";

@TypeORM.Entity()
export default class QuoteFrom extends Model {
  @TypeORM.PrimaryColumn({ type: "integer" })
  quote_id: number;

  @TypeORM.PrimaryColumn({ type: "varchar", length: 60 })
  from: string;
}
