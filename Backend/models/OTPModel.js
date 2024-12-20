import mongoose from "mongoose";

const OTPSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    otp: {
        type: Number,
        required: true
    }
})

const otpModel = mongoose.model("otp", OTPSchema)

export default otpModel