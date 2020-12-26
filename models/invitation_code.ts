import * as TypeORM from "typeorm";
import Model from "./common";

declare var syzoj: any;

import User from "./user";
import InvitationCodeUsername from "./invitation_code_username"

@TypeORM.Entity()
export default class InvitationCode extends Model {

  @TypeORM.PrimaryColumn({ type: 'varchar', length: 40 })
  code: string;

  @TypeORM.Column({ nullable: true, type: 'integer' })
  creator_id: number;

  @TypeORM.Column({ nullable: true, type: 'datetime' })
  creation_time: Date;

  @TypeORM.Column({ nullable: true, type: 'integer' })
  usage_count: number;

  @TypeORM.Column({ nullable: true, type: 'boolean' })
  enabled: boolean;

  creator?: User;
  usernames?: InvitationCodeUsername[];

  static async fromCode(code): Promise<InvitationCode> {
    return await InvitationCode.findOne({
      where: { code: code }
    });
  }

  async loadRelationships(): Promise<void> {
    this.creator = await User.findById(this.creator_id);
  }

  async loadUsernames(): Promise<void> {
    this.usernames = await InvitationCodeUsername.find({
      where: { code: this.code }
    });
  }

  async delete(): Promise<void> {
    await InvitationCodeUsername.createQueryBuilder()
      .delete()
      .where("`code` = :code", { code: this.code })
      .execute();
    await this.destroy();
  }

}