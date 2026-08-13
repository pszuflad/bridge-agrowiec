
require("dotenv").config();
const jwt=require("jsonwebtoken");
const secret=process.env.JWT_SECRET||"bridge-agrowiec-secret-2026";
const Database=require("better-sqlite3");const db=new Database("./data.db");
const u=db.prepare("SELECT id,email,imie_nazwisko FROM users WHERE id=1").get();db.close();
const payload={id:u.id,email:u.email,imieNazwisko:u.imie_nazwisko};
const token=jwt.sign(payload,secret,{expiresIn:"30d"});
console.log("TOKEN="+token);
