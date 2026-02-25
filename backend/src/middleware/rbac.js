export function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    const role = req.user?.role || "public";
    if (!allowed.includes(role)) {
      return res.status(403).json({
        error: "forbidden",
        message: `This endpoint requires one of: ${allowed.join(", ")}`
      });
    }
    return next();
  };
}
