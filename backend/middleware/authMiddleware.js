const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token)
    return res.status(401).json({ message: "Access denied. No token provided." });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "taskflow_secret_dev");
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};
