import {integer, text, blob, sqliteTable} from "drizzle-orm/sqlite-core";
import { ulid } from 'ulidx';

export const user = sqliteTable("user", {
    id: text('id').primaryKey().$defaultFn(() => ulid()),
    name: text("name").notNull(),
    privkey: text('privkey'),
    pubkey: text('pubkey'),
    webfinger: text('webfinger'),
    actor: text('actor'),
    apikey: text('apikey'),
    followers: text('followers'),
    messages: text('messages'),
})

export const message = sqliteTable("message", {
    id: text('id').primaryKey().$defaultFn(() => ulid()),
    message: text("message"),
})
