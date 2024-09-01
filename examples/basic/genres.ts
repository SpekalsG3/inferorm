import { DBEntityManager, EDBFieldTypes } from "../../src/orm/interface";

export const GenresDBManager = new DBEntityManager(
  "genres",
  {
    id: {
      dbType: EDBFieldTypes.Integer,
      isNullable: false,
      isPrimaryKey: true,
    },
    name: {
      dbType: EDBFieldTypes.String,
      isNullable: false,
    },
  },
);
