const Database = require("better-sqlite3");
const jwt = require("jsonwebtoken");
const db = new Database("data.db", {readonly:true});
const users = db.prepare("SELECT id, email, imieNazwisko FROM users").all();
console.log("USERS:", JSON.stringify(users));
if (users.length > 0) {
  const secret = process.env.JWT_SECRET || "bridge-agrowiec-secret-2026";
  const token = jwt.sign({id: users[0].id, email: users[0].email, imieNazwisko: users[0].imieNazwisko}, secret, {expiresIn: "30d"});
  console.log("TOKEN:", token);
}
