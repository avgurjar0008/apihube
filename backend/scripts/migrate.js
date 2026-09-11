import "dotenv/config"; import fs from "fs/promises"; import { database } from "../src/db.js";
const db=database(); if(!db) throw new Error("DATABASE_URL is required to run migrations.");
await db.query(await fs.readFile(new URL("../migrations/001_initial.sql",import.meta.url),"utf8")); console.log("Database migration complete."); await db.end();
