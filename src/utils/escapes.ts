const map: Record<string, string> = {
  "\0": "\\0",
  "\x08": "\\b",
  "\x09": "\\t",
  "\x1a": "\\z",
  "\n": "\\n",
  "\r": "\\r",
  '"': '""',
  "'": "''",
  "\\": "\\\\",
  "%": "\\%",
}

const regexTo = `(${Object.keys(map).map(el => `\\${el}`).join('|')})`
export function escapeSqlString(str: string): string {
  const result = str.replace(new RegExp(regexTo, "g"), function (char) {
    return map[char] ?? char;
  });
  return `"${result}"`;
}

const mapFrom = Object.entries(map).reduce<Record<string, string>>((acc, [from, to]) => {
  acc[to] = from;
  return acc;
}, {})
const regexFrom = `(${Object.keys(mapFrom).map(el => `\\${el}`).join('|')})`
export function unescapeSqlString(str: string): string {
  const result = str.replace(new RegExp(regexFrom, "g"), function (char) {
    return mapFrom[char] ?? char;
  });
  return `${result}`;
}
