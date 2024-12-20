import jwt from 'jsonwebtoken'


const doctorAuth = (req, res, next) => {
    console.log("inside auth")

    const { dtoken } = req.headers
    if (!dtoken) {
        return res.json({ success: false, message: "Unauthorized please login again" })
    }
    console.log(" doctor auth verigied", dtoken)
    try {


        const decoded_token = jwt.verify(dtoken, process.env.JWT_SECRET_KEY)

        console.log("the decoded id is ", decoded_token.id)
        req.body.docId = decoded_token.id
        next();


    } catch (e) {
        return res.json({ success: false, error: e })

    }
}

export default doctorAuth