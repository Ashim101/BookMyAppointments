import { Router } from "express";
import { bookAppointment, cancelAppointment, generateOtp, getProfile, googleAuth, listAppointments, registerUser, updateProfile, userLogin, verifyOtp } from "../controllers/userController.js";
import upload from "../middlewares/multer.js";
import userAuth from "../middlewares/userAuth.js";


const userRoute = Router()


userRoute.post("/register", registerUser)
userRoute.post("/login", userLogin)
userRoute.get("/profile", userAuth, getProfile)
userRoute.patch("/update-profile", upload.single("image"), userAuth, updateProfile)
userRoute.post("/book-appointment", userAuth, bookAppointment)
userRoute.get("/appointments", userAuth, listAppointments)
userRoute.delete("/cancel-appointment", userAuth, cancelAppointment)
userRoute.post("/google-auth", googleAuth)
userRoute.post("/generate-otp", generateOtp)
userRoute.post("/verify-otp", verifyOtp)





export default userRoute