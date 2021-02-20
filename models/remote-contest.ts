import * as TypeORM from "typeorm";
import Model from "./common";
import User from "./user";

declare var syzoj, ErrorMessage: any;

@TypeORM.Entity()
export default class RemoteContest extends Model {
  static cache = true;

  @TypeORM.PrimaryGeneratedColumn()
  id: number;

  @TypeORM.Column({ type: "varchar", length: 80 })
  title: string;

  @TypeORM.Column({ type: "integer" })
  start_time: number;

  @TypeORM.Column({ type: "integer" })
  end_time: number;

  @TypeORM.Index()
  @TypeORM.Column({ type: "integer" })
  holder_id: number;

  @TypeORM.Column({ type: "text" })
  link: string;

  @TypeORM.Column({ nullable: true, type: "text" })
  passwd: string;

  holder?: User;

  async loadRelationships() {
    this.holder = await User.findById(this.holder_id);
  }

  isRunning(now?) {
    if (!now) now = syzoj.utils.getCurrentDate();
    return now >= this.start_time && now < this.end_time;
  }

  isEnded(now?) {
    if (!now) now = syzoj.utils.getCurrentDate();
    return now >= this.end_time;
  }
}