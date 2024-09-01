import { DBEntityManager, EDBFieldTypes } from "../../src/orm/interface";
import {CustomIdDBManager} from "./custom-id";

export enum EStatus {
  Watched = 'Watched',
  Planned = 'Planned',
}

export const MoviesDBManager = new DBEntityManager(
  "movies",
  {
    id: {
      dbType: EDBFieldTypes.Integer,
      isPrimaryKey: true,
      isNullable: false,
    },
    custom_id: {
      dbType: EDBFieldTypes.Integer,
      isNullable: false,
      foreignKey: () => CustomIdDBManager,
    },
    status: {
      dbType: EDBFieldTypes.String,
      isNullable: false,
      deserializeWith: (s) => {
        if (!Object.values(EStatus).includes(s as any)) {
          throw new Error('Unknown status')
        }
        return s as EStatus;
      }
    },
    score: {
      dbType: EDBFieldTypes.Integer,
      isNullable: true,
    },
    len_min: {
      dbType: EDBFieldTypes.Integer,
      isNullable: false,
    },
    created_at: {
      dbType: EDBFieldTypes.Date,
      isNullable: false,
      deserializeWith: (s) => s.getTime(),
      serializeWith: (s) => new Date(s as number),
    },
  },
);
