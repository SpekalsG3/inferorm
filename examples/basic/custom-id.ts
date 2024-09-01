import {DBEntityManager, EDBFieldTypes} from "../../src/orm/interface";

export const CustomIdDBManager = new DBEntityManager(
  "custom_id",
  {
    id: {
      dbType: EDBFieldTypes.Integer,
      isPrimaryKey: true,
      isNullable: false,
    },
    my_id: {
      dbType: EDBFieldTypes.String,
      isNullable: false,
    }
  },
);
