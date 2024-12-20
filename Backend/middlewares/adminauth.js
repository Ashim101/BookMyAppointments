import jwt from 'jsonwebtoken'


const adminAuth = (req, res, next) => {

    const { atoken } = req.headers
    console.log("auth verigied", atoken)
    try {


        const decoded_token = jwt.verify(atoken, process.env.JWT_SECRET_KEY)

        if (decoded_token.email === process.env.ADMIN_EMAIL && decoded_token.password === process.env.ADMIN_PASSWORD) {
            next();
        }
        else {
            return res.json({ success: false, message: "invalid credentials" })
        }
    } catch (e) {
        return res.json({ success: false, error: e })

    }
}

export default adminAuth