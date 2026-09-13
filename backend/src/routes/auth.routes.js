import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { database } from "../db.js";
import { requireUser, sessionCookie } from "../middleware/auth.js";
const router = Router();
const validEmail = email => /^\S+@\S+\.\S+$/.test(email);
const profile = row => ({
  id: row.id,
  email: row.email,
  name: row.name || (row.email ? row.email.split("@")[0] : "Developer"),
  createdAt: row.created_at
});
router.post("/signup", async (req,res) => {
  const email=String(req.body?.email||"").trim().toLowerCase(), password=String(req.body?.password||"");
  const name=String(req.body?.name||"").trim().slice(0, 100);
  if(!validEmail(email)||password.length<8) return res.status(400).json({success:false,message:"Use a valid email and a password of at least 8 characters."});
  try {
    const user={id:crypto.randomUUID(),email,passwordHash:await bcrypt.hash(password,12),name:name||null};
    const r=await database().query("INSERT INTO users(id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id,email,name,created_at",[user.id,user.email,user.passwordHash,user.name]);
    sessionCookie(res,jwt.sign({sub:user.id},process.env.JWT_SECRET,{expiresIn:"7d"}));
    res.status(201).json({success:true,user:profile(r.rows[0])});
  } catch(e){
    console.error("[Auth Signup Error]:", e.message);
    let msg = "Unable to create account.";
    if (e.code === "23505") {
      msg = "An account with that email already exists.";
    } else if (e.message?.includes("tenant") || e.message?.includes("ENOTFOUND") || process.env.DATABASE_URL?.includes("YOUR_PROJECT_REF")) {
      msg = "Database not connected. Please put your real Supabase DATABASE_URL in backend/.env";
    } else if (e.code === "42P01") {
      msg = "Database tables missing. Please run backend/supabase_schema.sql in Supabase SQL Editor.";
    } else {
      msg = "Database error: " + e.message;
    }
    res.status(e.code==="23505"?409:500).json({success:false,message:msg});
  }
});
router.post("/signin", async (req,res) => {
  const email=String(req.body?.email||"").trim().toLowerCase(), password=String(req.body?.password||"");
  try {
    const r=await database().query("SELECT id,email,name,password_hash,created_at FROM users WHERE email=$1",[email]);
    if(!r.rowCount||!await bcrypt.compare(password,r.rows[0].password_hash)) return res.status(401).json({success:false,message:"Invalid email or password."});
    sessionCookie(res,jwt.sign({sub:r.rows[0].id},process.env.JWT_SECRET,{expiresIn:"7d"}));
    res.json({success:true,user:profile(r.rows[0])});
  } catch(e) {
    console.error("[Auth Signin Error]:", e.message);
    res.status(500).json({success:false,message:"Database error: " + (process.env.DATABASE_URL?.includes("YOUR_PROJECT_REF") ? "Please set your real Supabase connection string in backend/.env" : e.message)});
  }
});
router.post("/signout", (req,res)=>{res.clearCookie("apihub_session",{path:"/"});res.json({success:true});});
router.get("/me",requireUser,async(req,res)=>{const r=await database().query("SELECT id,email,name,created_at FROM users WHERE id=$1",[req.user.sub]); if(!r.rowCount)return res.status(401).json({success:false,message:"Session is invalid."});res.json({success:true,user:profile(r.rows[0])});});
export default router;
