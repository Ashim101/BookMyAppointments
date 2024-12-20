import express from 'express'
import upload from '../middlewares/multer.js'
import { addDoctor, adminLogin, allAppointments, allDoctors, cancelAppointment, changeAvailability, getDashboardData } from '../controllers/adminController.js'
import adminAuth from '../middlewares/adminauth.js'


const adminRouter = express.Router()


adminRouter.post('/add-doctor', adminAuth, upload.single('image'), addDoctor)
adminRouter.post('/login', adminLogin)
adminRouter.get('/all-doctors', adminAuth, allDoctors)
adminRouter.patch("/change-availability", adminAuth, changeAvailability)
adminRouter.get("/all-appointments", adminAuth, allAppointments)
adminRouter.patch("/cancel-appointment", adminAuth, cancelAppointment)
adminRouter.get("/get-dashboard-data", adminAuth, getDashboardData)








export default adminRouter