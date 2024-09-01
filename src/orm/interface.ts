import {getDB} from "../utils/get-db";
import {escapeSqlString, unescapeSqlString} from "../utils/escapes";

export enum EDBFieldTypes {
  String = 'String',
  Integer = 'Integer',
  Date = 'Date',
}

type _DBFieldToTs<T extends EDBFieldTypes> = {
  [EDBFieldTypes.String]: string,
  [EDBFieldTypes.Integer]: number,
  [EDBFieldTypes.Date]: Date,
}[T];

type DBFieldToTs<
  T extends EDBFieldTypes,
  IsNullable extends boolean,
  SerdeValue extends unknown,
> =
  unknown extends SerdeValue
    ? true extends IsNullable
      ? _DBFieldToTs<T> | null
      : _DBFieldToTs<T>
    : true extends IsNullable
      ? SerdeValue | null
      : SerdeValue;

export interface IDBField<DB extends EDBFieldTypes> {
  dbType: DB,
  isNullable: boolean,
  isPrimaryKey?: true, // todo: add field to link foreign keys using this primaryKey to allow joining by this id
  foreignKey?: () => DBEntityManager<any, any>,
  variants?: string[],
  deserializeWith?: (value: _DBFieldToTs<DB>) => unknown,
  serializeWith?: (value: unknown) => _DBFieldToTs<DB>,
}

type TDBEntity = {
  [name: string]: IDBField<EDBFieldTypes.String>
    | IDBField<EDBFieldTypes.Integer>
    | IDBField<EDBFieldTypes.Date>,
}

type DBToTs<DB extends TDBEntity> = {
  [key in keyof DB]: DBFieldToTs<
    DB[key]['dbType'],
    DB[key]['isNullable'],
    DB[key]['deserializeWith'] extends (value: any) => infer SerdeValue
      ? SerdeValue
      : DB[key]['serializeWith'] extends (value: infer SerdeValue) => any
        ? SerdeValue
        : unknown
  >
}

type WhereClause<DB extends TDBEntity, TS extends DBToTs<DB>> = {
  [key in keyof TS]?: TS[key]
}

type _JoinableKeys<DB extends TDBEntity> = {
  [key in keyof DB]: undefined extends DB[key]['foreignKey']
    ? never
    : key
}[keyof DB];
type JoinableKeys<DB extends TDBEntity> = {
  [key in _JoinableKeys<DB>]?:
  DB[key]['foreignKey'] extends () => DBEntityManager<infer JDB, infer JTS>
    ? GetAll<JDB, JTS, Array<keyof JTS>, JoinableKeys<JDB>>
    : never
};
type Joinable<
  DB extends TDBEntity,
  Joined extends JoinableKeys<DB>
> = {
  // @ts-ignore // `DB[key]` key cannot map but it can - `Joined` is partial `keyof DB`
  [key in keyof Joined]: DB[key]['foreignKey'] extends () => DBEntityManager<infer JDB, infer JTS>
    ? undefined extends Joined[key]
      ? never
      : GetAllRes<
        JDB,
        JTS,
        undefined extends NonNullable<Joined[key]>['fields']
          ? Array<keyof JTS>
          : NonNullable<NonNullable<Joined[key]>['fields']>[number][]
        ,
        undefined extends NonNullable<Joined[key]>['join']
          ? never
          : NonNullable<NonNullable<Joined[key]>['join']>
      >[]
    : never
}

type GetAll<
  DB extends TDBEntity,
  TS extends DBToTs<DB>,
  Current extends Array<keyof TS>,
  Joined extends JoinableKeys<DB>,
> = {
  fields?: Current,
  where?: WhereClause<DB, TS>,
  limit?: number,
  join?: Joined,
}
type GetAllRes<
  DB extends TDBEntity,
  TS extends DBToTs<DB>,
  Current extends Array<keyof TS>,
  Joined extends JoinableKeys<DB>,
> = {
  current: {
    [key in NonNullable<Current>[number]]: TS[key]
  },
  joined: Joinable<DB, NonNullable<Joined>>,
}

export class DBEntityManager<
  DB extends TDBEntity,
  TS extends DBToTs<DB>,
> {
  private readonly primaryKey: keyof TS;

  public constructor (
    public readonly tableName: string,
    public readonly entity: DB,
  ) {
    let primaryKey: string | null = null;
    for (const fieldName in entity) {
      if (entity[fieldName].isPrimaryKey) {
        if (primaryKey) {
          throw new Error(`Can have only one primary key - but ${tableName} has ${primaryKey} and ${fieldName}`)
        }
        if (entity[fieldName].isNullable) {
          throw new Error(`Primary key cannot be nullable - but ${tableName} set ${fieldName} as nullable`);
        }
        primaryKey = fieldName;
      }
    }
    if (!primaryKey) {
      throw new Error(`Table has to have at least one primary key - but ${tableName} has none`);
    }
    this.primaryKey = primaryKey;
  }

  private fromDb (
    field: string,
    value: any,
  ): any {
    if (value !== null) {
      switch (this.entity[field].dbType) {
        case EDBFieldTypes.String: {
          value = unescapeSqlString(value as string)
          break;
        }
        case EDBFieldTypes.Integer: {
          // value = value
          break;
        }
        case EDBFieldTypes.Date: {
          value = new Date(value);
          break;
        }
      }

      const f = this.entity[field].deserializeWith;
      if (f) {
        // @ts-ignore
        value = f(value);
      }
    }

    return value;
  }
  private toDb (
    field: string,
    value: any,
  ): any {
    const isNull = [null, undefined].includes(value);
    if (!this.entity[field].isNullable && isNull) {
      throw new Error(`Field '${field}' is not nullable`)
    }

    if (!isNull) {
      const f = this.entity[field].serializeWith;
      if (f) {
        value = f(value);
      }

      switch (this.entity[field].dbType) {
        case EDBFieldTypes.String: {
          value = escapeSqlString(value as string);
          break;
        }
        case EDBFieldTypes.Integer: {
          value = String(value);
          break;
        }
        case EDBFieldTypes.Date: {
          value = String(value.getTime())
          break;
        }
      }
    } else {
      value = 'NULL';
    }

    return value;
  }

  private where (where: WhereClause<DB, TS>): string {
    const entries = Object.entries(where);
    if (entries.length === 0) {
      return '';
    }

    return `WHERE ${
      entries
        .map(([field, value]) => {
          return `${this.tableName}.${field} = ${this.toDb(field, value)}`
        })
        .join(' and ')
    }`;
  }

  private join (join: JoinableKeys<DB> | undefined): {
    selects: Array<{
      tableName: string
      joinedPath: string[],
      fields: (keyof TS)[],
    }>,
    joins: string[],
  } {
    if (join === undefined) {
      return {
        selects: [],
        joins: [],
      };
    }

    const selects: Array<{
      tableName: string
      joinedPath: string[],
      fields: (keyof TS)[],
    }> = [];
    const joins: string[] = [];

    const joinQueue = [{
      joinedPath: [] as string[],
      parentManager: this as DBEntityManager<any, any>,
      joinInfo: join,
    }];
    while (joinQueue.length > 0) {
      const data = joinQueue.pop()!;
      for (const join of Object.entries(data.joinInfo)) {
        const field = join[0];
        const options = join[1] as GetAll<DB, TS, (keyof TS)[], JoinableKeys<DB>>;
        const to = data.parentManager.entity[field].foreignKey!();

        const path = [...data.joinedPath, field];
        selects.push({
          tableName: to.tableName,
          joinedPath: path,
          fields: options.fields ?? Object.keys(to.entity),
        });

        joins.push(
          `INNER JOIN ${to.tableName} on ${to.tableName}.${to.primaryKey as string} = ${data.parentManager.tableName}.${field}`,
        );

        if (options.join) {
          joinQueue.push({
            joinedPath: path,
            parentManager: to,
            joinInfo: options.join,
          });
        }
      }
    }

    return {
      selects,
      joins,
    }
  }

  public async getAll<
    Selected extends Array<keyof TS>,
    Joined extends JoinableKeys<DB>,
  > (props: GetAll<DB, TS, Selected, Joined>): Promise<GetAllRes<DB, TS, Selected, Joined>[]> {
    const db = await getDB();

    const joinInfo = this.join(props.join);

    const fields = new Set(
      (props.fields ?? Object.keys(this.entity))
        .map(f => `${this.tableName}.${f as string}`) // SAFETY: never a symbol
    );
    for (const options of joinInfo.selects) {
      for (const f of options.fields) {
        fields.add(`${options.tableName}.${f as string}`); // SAFETY: never a symbol
      }
    }

    const query = `SELECT ${[...fields].join(',')}`
      + ` FROM ${this.tableName}`
      + ` ${joinInfo.joins.join(' ')}`
      + ` ${this.where(props.where ?? {})}`
      + ` ${props.limit ? `LIMIT ${props.limit}` : ""}`;

    const results = await db.all<any[]>(query);
    return results.map(r => {
      // parse query entities
      const entities: any = { // too many shenanigans for types
        [this.tableName]: {},
      };
      for (const o of joinInfo.selects) {
        entities[o.tableName] = {};
      }
      for (const [key, value] of Object.entries(r)) {
        const [table, field] = key.split('.');
        entities[table][field] = value; // todo: use this.fromDb
      }

      // map parsed entities to result
      const joined: any = {}; // too many shenanigans for types
      for (const selectedInfo of joinInfo.selects) {
        let j = joined;
        for (const p of selectedInfo.joinedPath) {
          if (!j[p]) {
            j[p] = {
              current: undefined,
              joined: {},
            };
          }
          j = j[p].joined;
        }
        j.current = entities[selectedInfo.tableName];
      }

      return {
        current: entities[this.tableName],
        joined,
      }
    });
  }

  public async insert (
    data: Partial<TS>,
  ): Promise<GetAllRes<DB, TS, (keyof DB)[], never>> {
    const results = await this.insertBulk([data]);
    return results[0];
  }

  public async insertBulk(
    bulk: Partial<TS>[],
  ): Promise<GetAllRes<DB, TS, (keyof DB)[], never>[]> {
    const db = await getDB();

    const tss: TS[] = [];

    const fields = Object.keys(this.entity)
      .filter(f => f !== this.primaryKey);

    const values = bulk
      .reduce<string[][]>((acc, data) => {
        const values: string[] = [];
        tss.push({} as any);

        for (const field of fields) {
          if (!this.entity[field].isNullable && ([undefined, null].includes(data[field] as any))) {
            throw new Error(`Field ${field} is not nullable`);
          }
          const value = data[field] ?? null;

          // @ts-ignore
          tss.at(-1)[field] = value;

          values.push(this.toDb(field, value));
        }

        acc.push(values);
        return acc;
      }, []);

    const query = `INSERT INTO`
      + ` ${this.tableName}(${fields.join(',')})`
      + ` VALUES (${values.map(v => v.join(',')).join('),(')})`
      + ` RETURNING ${this.primaryKey as string}`;
    const results = await db.all(query);

    return results
      .map((result, i) => {
        tss[i][this.primaryKey] = result[this.primaryKey];
        return {
          current: tss[i],
          joined: undefined as never,
        };
      });
  }

  public async update (props: {
    data: Partial<TS>,
    where: WhereClause<DB, TS>,
  }): Promise<number> {
    const db = await getDB();

    const updates = Object.entries(props.data)
      .reduce<string[]>((acc, [field, value]) => {
        if (
          !this.entity[field] // in case passed extra data
          || field === this.primaryKey // this key identifies entity
        ) {
          return acc;
        }

        acc.push(`${field} = ${this.toDb(field, value)}`);
        return acc;
      }, []);
    if (updates.length === 0) {
      return 0;
    }

    const query = `UPDATE ${this.tableName} SET`
      + ` ${updates.join(',')}`
      + ` ${this.where(props.where)}`;

    const stmt = await db.run(query);
    return stmt.changes ?? 0;
  }

  public async delete (props: {
    where: WhereClause<DB, TS>,
  }): Promise<number> {
    const db = await getDB();

    const query = `DELETE FROM ${this.tableName}`
      + ` ${this.where(props.where)}`;

    const stmt = await db.run(query);
    return stmt.changes ?? 0;
  }
}
