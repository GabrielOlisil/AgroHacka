import { invoke } from "@tauri-apps/api/core";

export interface Backup {
  name: string;
  size: number;
}
export interface BackupService {
  create(): Promise<unknown>;
  list(): Promise<Backup[]>;
  restore(name: string): Promise<unknown>;
}
export const nativeBackups: BackupService = {
  create: () => invoke("create_backup"),
  list: () => invoke("list_backups"),
  restore: (name) => invoke("restore_backup", { name }),
};
