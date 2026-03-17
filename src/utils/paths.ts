import { homedir } from 'os';
import { join } from 'path';

export const DB_PATH = join(homedir(), '.claude-mem', 'claude-mem.db');
export const DATA_DIR = join(homedir(), '.claude-mem', 'data');

export function getDbPath(): string {
  return DB_PATH;
}
