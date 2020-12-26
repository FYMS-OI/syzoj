import * as TypeORM from "typeorm";
import Model from "./common";
import User from "./user";

declare var syzoj: any;

enum UserRole {
  teacher = "teacher",
  student = "student",
  other = "other"
}

enum ReviewStatus {
  pending = "pending",
  approved = "approved",
  rejected = "rejected"
}

interface UserIdentityDto {
  user: {
    id: number;
    username: string;
  };
  role: UserRole;
  real_name: string;
  graduation_year: number;
  oierdb_id: number;
  status: ReviewStatus;
  creation_time: string;
  update_time: string;
  review_time: string;
}

interface UserIdentityStatDto {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

function date2str(date: Date): string {
  return date && syzoj.utils.formatDate(date.getTime() / 1000);
}

@TypeORM.Entity()
export default class UserIdentity extends Model {
  static cache = false;
  
  @TypeORM.PrimaryColumn({ type: "integer" })
  user_id: number;

  @TypeORM.Column({ type: "enum", enum: UserRole })
  role: UserRole;

  @TypeORM.Column({ type: "varchar", length: 20 })
  real_name: string;

  @TypeORM.Column({ nullable: true, type: "integer" })
  graduation_year: number;

  @TypeORM.Column({ nullable: true, type: "integer" })
  oierdb_id: number;

  @TypeORM.Index()
  @TypeORM.Column({ type: "enum", enum: ReviewStatus, default: ReviewStatus.pending })
  status: ReviewStatus;

  @TypeORM.Column({ type: "datetime" })
  creation_time: Date;

  @TypeORM.Column({ type: "datetime" })
  update_time: Date;

  @TypeORM.Column({ nullable: true, type: "datetime" })
  review_time: Date;

  user?: User;

  async loadRelationships() {
    this.user = await User.findById(this.user_id);
  }

  toJSON(): UserIdentityDto {
    return {
      user: {
        id: this.user.id,
        username: this.user.username
      },
      role: this.role,
      real_name: this.real_name,
      graduation_year: this.graduation_year,
      oierdb_id: this.oierdb_id,
      status: this.status,
      creation_time: date2str(this.creation_time),
      update_time: date2str(this.update_time),
      review_time: date2str(this.review_time)
    };
  }

  static async getStatistics(): Promise<UserIdentityStatDto> {
    return {
      pending: await this.count({ where: { status: ReviewStatus.pending } }),
      approved: await this.count({ where: { status: ReviewStatus.approved } }),
      rejected: await this.count({ where: { status: ReviewStatus.rejected } }),
      total: await User.count()
    };
  }
}
