import { Router } from "express";
import { doctorLogin, doctorList, allAppointments, cancelAppointment, finishAppointment, getDashboardData, getprofile, updateProfile } from "../controllers/doctorController.js";
import doctorAuth from "../middlewares/doctorauth.js";

const doctorRouter = Router()

doctorRouter.get("/list", doctorList)
doctorRouter.post("/login", doctorLogin)
doctorRouter.get("/all-appointments", doctorAuth, allAppointments)
doctorRouter.patch("/cancel-appointment", doctorAuth, cancelAppointment)
doctorRouter.patch("/finish-appointment", doctorAuth, finishAppointment)

doctorRouter.get("/dashboard", doctorAuth, getDashboardData)
doctorRouter.get("/profile", doctorAuth, getprofile)
doctorRouter.put("/profile", doctorAuth, updateProfile)





export default doctorRouter