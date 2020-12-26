import * as TypeORM from "typeorm";
import Model from "./common";

declare var syzoj: any;

import User from "./user";

@TypeORM.Entity()
export default class InvitationCodeUsername extends Model {

  @TypeORM.Index()
  @TypeORM.PrimaryColumn({ type: 'varchar', length: 40 })
  code: string;

  @TypeORM.PrimaryColumn({ type: 'varchar', length: 80 })
  username: string;

  @TypeORM.Column({ nullable: true, type: 'integer' })
  user_id: number;

  @TypeORM.Column({ nullable: true, type: 'boolean' })
  used: boolean;

  user?: User;

  async loadRelationships(): Promise<void> {
    this.user = await User.findById(this.user_id);
  }

}