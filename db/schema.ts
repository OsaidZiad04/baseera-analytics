import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const projects = sqliteTable('baseera_projects', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull(), name: text('name').notNull(),
  fileName: text('file_name').notNull(), objectKey: text('object_key').notNull(),
  version: integer('version').notNull(), revision: integer('revision').notNull(),
  rows: integer('rows').notNull(), sheets: integer('sheets').notNull(), bytes: integer('bytes').notNull(),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, table => [index('baseera_projects_owner').on(table.ownerId, table.updatedAt)]);
export const aiUsage = sqliteTable('baseera_ai_usage', { ownerId: text('owner_id').primaryKey(), window: integer('window').notNull(), count: integer('count').notNull() });
