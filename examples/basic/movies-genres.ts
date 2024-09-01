import { DBEntityManager, EDBFieldTypes } from "../../src/orm/interface";
import {MoviesDBManager} from "./movies";
import {GenresDBManager} from "./genres";

export const MoviesGenresDBManager = new DBEntityManager(
  "movies_genres",
  {
    id: {
      dbType: EDBFieldTypes.Integer,
      isNullable: false,
      isPrimaryKey: true,
    },
    movie_id: {
      dbType: EDBFieldTypes.Integer,
      isNullable: false,
      foreignKey: () => MoviesDBManager,
    },
    genre_id: {
      dbType: EDBFieldTypes.Integer,
      isNullable: false,
      foreignKey: () => GenresDBManager,
    },
  },
);

// async function testTypeInference() {
//   const x = await MoviesGenresDBManager.getAll({
//     fields: ['id'],
//     join: {
//       id: {},
//       movie_id: {
//         fields: ['status', 'len_min'],
//         join: {
//           custom_id: {
//             fields: ['my_id'],
//           }
//         }
//       },
//     },
//   });
//   x[0].current.id;
//   x[0].current.movie_id;
//   x[0].joined.movie_id[0].current.status;
//   x[0].joined.movie_id[0].current.len_min;
//   x[0].joined.movie_id[0].current.score;
//   x[0].joined.movie_id[0].joined.fields;
//   x[0].joined.movie_id[0].joined.custom_id[0].current.my_id;
//   x[0].joined.movie_id[0].joined.custom_id[0].current.id;
//   x[0].joined.genre_id[0].current.id;
//   x[0].joined.id;
// }
