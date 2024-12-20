import jwt from 'jsonwebtoken';

const userAuth = (req, res, next) => {
    const { token } = req.headers; // Extract token from "Bearer token"

    console.log("inside auth")
    if (!token) {
        console.log("token required")
        return res.status(403).json({ success: false, message: 'Token is required' });
    }

    try {
        // Verify token without using the callback
        const decoded_token = jwt.verify(token, process.env.JWT_SECRET_KEY);

        // Set user ID or other payload data to request body or request object
        req.body.id = decoded_token.id;  // Assuming your token has an `id` field
        next();  // Proceed to the next middleware
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            console.log("session expired")
            return res.status(401).json({ success: false, message: 'Token has expired' });
        } else {
            return res.status(403).json({ success: false, message: 'Invalid token' });
        }
    }
};

export default userAuth;
