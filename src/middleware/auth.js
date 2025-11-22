//src/middleware/auth.js

const authenticateToken = (jwtUtils) => {
  return (req, res, next) => {
    // Try to get token from Authorization header first
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    // If no token in header, try to get from cookie
    if (!token && req.cookies) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access token required' 
      });
    }

    try {
      const user = jwtUtils.verifyAccessToken(token);
      req.user = user;
      next();
    } catch (error) {
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }
  };
};

const optionalAuth = (jwtUtils) => {
  return (req, res, next) => {
    // Try to get token from Authorization header first
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];

    // If no token in header, try to get from cookie
    if (!token && req.cookies) {
      token = req.cookies.accessToken;
    }

    if (token) {
      try {
        const user = jwtUtils.verifyAccessToken(token);
        req.user = user;
      } catch (error) {
        // Continue without user data
      }
    }
    next();
  };
};

module.exports = { authenticateToken, optionalAuth };